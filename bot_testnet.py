# -*- coding: utf-8 -*-
"""
BOT DE TESTE (TESTNET) - automacao real, dinheiro FAKE.
-------------------------------------------------------------------------------
Sinal calculado sobre DADOS BRUTOS (klines publicos da Binance), execucao via API.
Dois modos:
  * SOMBRA  : sem chaves. So mostra o que FARIA. Rode agora, sem cadastrar nada.
  * TESTNET : com chaves de teste (gratis). Manda ordens reais com dinheiro FAKE.

Para virar TESTNET:
  1) Entre em  https://testnet.binance.vision/  e logue com GitHub.
  2) Gere uma API Key + Secret de teste (recebe saldo fake automaticamente).
  3) Defina as variaveis de ambiente (PowerShell):
        $env:BINANCE_TESTNET_KEY    = "sua_key"
        $env:BINANCE_TESTNET_SECRET = "seu_secret"
  4) pip install ccxt   (so necessario para o modo TESTNET)
  5) python bot_testnet.py

Parar: crie um arquivo vazio chamado STOP.txt nesta pasta, ou aperte Ctrl+C.

>>> Este bot NUNCA opera dinheiro real. Ir para real exige passar antes pelo
    teste de robustez e semanas de testnet -- e mudar codigo de proposito. <<<
"""
import os, sys, json, time, signal, urllib.request
import numpy as np
import pandas as pd

# ============================ CONFIG (edite) ============================
SYMBOL           = "BTC/USDT"   # formato ccxt
TIMEFRAME        = "15m"        # 1m,5m,15m,1h,4h,1d
RSI_PERIOD       = 14
RSI_BUY          = 30           # compra quando RSI < isto
RSI_SELL         = 55           # vende quando RSI > isto
TRADE_QUOTE      = 1000.0       # USDT (fake) por compra
STOP_LOSS_PCT    = 0.05         # vende se cair 5% da entrada (protecao)
MAX_DRAWDOWN_PCT = 0.20         # KILL SWITCH: para se o capital cair 20% do pico
POLL_SECONDS     = 30           # de quanto em quanto tempo checa
ALLOW_REAL_MONEY = False        # TRAVA. Manter False. (dinheiro real = NAO)
# =======================================================================

BINANCE_SYMBOL = SYMBOL.replace("/", "")           # BTCUSDT
BASE, QUOTE    = SYMBOL.split("/")                  # BTC , USDT
KLINES_URL     = "https://data-api.binance.vision/api/v3/klines"
STATE_FILE     = "bot_state.json"
TRADES_CSV     = "bot_trades.csv"
KEYS_FILE      = os.path.join(os.path.expanduser("~"), "trade_chaves.txt")
_stop          = {"flag": False}


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            return json.load(open(STATE_FILE))
        except Exception:
            pass
    return {"in_position": False, "entry_price": 0.0, "base_amount": 0.0, "peak_equity": None}


def save_state(st):
    json.dump(st, open(STATE_FILE, "w"), indent=2)


def record_trade(side, price, amount, reason):
    new = not os.path.exists(TRADES_CSV)
    with open(TRADES_CSV, "a", encoding="utf-8") as f:
        if new:
            f.write("datetime,side,price,amount,reason\n")
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')},{side},{price},{amount},{reason}\n")


# --------- dados brutos (publico, sem chave) ---------
def fetch_closed_ohlcv(limit=200):
    url = f"{KLINES_URL}?symbol={BINANCE_SYMBOL}&interval={TIMEFRAME}&limit={limit}"
    with urllib.request.urlopen(url, timeout=20) as r:
        data = json.loads(r.read().decode())
    # o ultimo candle ainda esta se formando -> descarta para evitar "repaint"
    closed = data[:-1]
    df = pd.DataFrame(closed, columns=["t","o","h","l","c","v","ct","qv","n","tb","tq","ig"])
    df = df.astype({"o":float,"h":float,"l":float,"c":float})
    return df


def rsi(close, period):
    d = close.diff()
    ag = d.clip(lower=0).ewm(alpha=1/period, adjust=False, min_periods=period).mean()
    al = (-d.clip(upper=0)).ewm(alpha=1/period, adjust=False, min_periods=period).mean()
    return 100 - 100/(1 + ag/al)


# --------- exchange (so no modo TESTNET) ---------
def _valid(v):
    return bool(v) and "cole" not in v.lower()

def load_keys():
    """Le as chaves do ambiente OU de ~/trade_chaves.txt (fora da pasta servida na rede)."""
    key = os.environ.get("BINANCE_TESTNET_KEY")
    sec = os.environ.get("BINANCE_TESTNET_SECRET")
    if not (_valid(key) and _valid(sec)) and os.path.exists(KEYS_FILE):
        vals = {}
        for line in open(KEYS_FILE, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                vals[k.strip()] = v.strip()
        if not _valid(key): key = vals.get("BINANCE_TESTNET_KEY")
        if not _valid(sec): sec = vals.get("BINANCE_TESTNET_SECRET")
    return (key if _valid(key) else None), (sec if _valid(sec) else None)

def make_exchange():
    key, sec = load_keys()
    if not key or not sec:
        log(f"Sem chaves validas -> MODO SOMBRA. Preencha: {KEYS_FILE}")
        return None  # modo SOMBRA
    if ALLOW_REAL_MONEY:
        log("ERRO: ALLOW_REAL_MONEY=True nao e permitido por este bot. Saindo.")
        sys.exit(1)
    import ccxt
    ex = ccxt.binance({
        "apiKey": key, "secret": sec,
        "enableRateLimit": True,
        "options": {
            "defaultType": "spot",
            "createMarketBuyOrderRequiresPrice": False,
            "adjustForTimeDifference": True,   # corrige relogio fora de hora (erro -1021)
            "recvWindow": 10000,
        },
    })
    ex.set_sandbox_mode(True)   # <<< aponta para a TESTNET (dinheiro fake)
    ex.load_markets()
    try:
        ex.load_time_difference()   # sincroniza o horario com o servidor da Binance
    except Exception as e:
        log(f"aviso: nao sincronizou horario ({e})")
    return ex


def equity_and_balances(ex, price):
    bal = ex.fetch_balance()
    usdt = float(bal["free"].get(QUOTE, 0))
    base = float(bal["free"].get(BASE, 0))
    return usdt + base * price, usdt, base


def do_buy(ex, price, st):
    if ex is None:
        log(f"SOMBRA: COMPRARIA ~{TRADE_QUOTE:.0f} {QUOTE} de {BASE} a ~{price:.2f}")
        st.update(in_position=True, entry_price=price, base_amount=TRADE_QUOTE/price)
        record_trade("BUY(shadow)", price, st["base_amount"], "rsi")
        return
    o = ex.create_market_buy_order(SYMBOL, TRADE_QUOTE)   # gasta TRADE_QUOTE em USDT
    filled = float(o.get("filled") or 0)
    avg = float(o.get("average") or price)
    st.update(in_position=True, entry_price=avg, base_amount=filled)
    log(f"TESTNET: COMPROU {filled:.6f} {BASE} a ~{avg:.2f}")
    record_trade("BUY", avg, filled, "rsi")


def do_sell(ex, price, st, reason):
    if ex is None:
        pnl = (price/st["entry_price"] - 1)*100 if st["entry_price"] else 0
        log(f"SOMBRA: VENDERIA {st['base_amount']:.6f} {BASE} a ~{price:.2f} ({reason}) | P&L ~{pnl:+.2f}%")
        record_trade("SELL(shadow)", price, st["base_amount"], reason)
        st.update(in_position=False, entry_price=0.0, base_amount=0.0)
        return
    free = float(ex.fetch_balance()["free"].get(BASE, 0))
    amt = float(ex.amount_to_precision(SYMBOL, min(st["base_amount"], free)))
    if amt <= 0:
        log("AVISO: nada para vender.")
        st.update(in_position=False, entry_price=0.0, base_amount=0.0)
        return
    o = ex.create_market_sell_order(SYMBOL, amt)
    avg = float(o.get("average") or price)
    pnl = (avg/st["entry_price"] - 1)*100 if st["entry_price"] else 0
    log(f"TESTNET: VENDEU {amt:.6f} {BASE} a ~{avg:.2f} ({reason}) | P&L {pnl:+.2f}%")
    record_trade("SELL", avg, amt, reason)
    st.update(in_position=False, entry_price=0.0, base_amount=0.0)


def cycle(ex, st):
    df = fetch_closed_ohlcv()
    df["rsi"] = rsi(df.c, RSI_PERIOD)
    price = float(df.c.iloc[-1])
    r = float(df.rsi.iloc[-1])
    pos = "POSICIONADO" if st["in_position"] else "fora"
    log(f"{SYMBOL} {TIMEFRAME} | preco {price:.2f} | RSI {r:.1f} | {pos}")

    # ----- kill switch por drawdown (so testnet, precisa de saldo) -----
    if ex is not None:
        eq, _, _ = equity_and_balances(ex, price)
        if st["peak_equity"] is None:
            st["peak_equity"] = eq
        st["peak_equity"] = max(st["peak_equity"], eq)
        dd = eq/st["peak_equity"] - 1
        if dd <= -MAX_DRAWDOWN_PCT:
            log(f"!!! KILL SWITCH: drawdown {dd*100:.1f}% <= -{MAX_DRAWDOWN_PCT*100:.0f}%. Encerrando.")
            if st["in_position"]:
                do_sell(ex, price, st, "killswitch")
            save_state(st); _stop["flag"] = True; return

    # ----- stop-loss por operacao -----
    if st["in_position"] and price <= st["entry_price"] * (1 - STOP_LOSS_PCT):
        do_sell(ex, price, st, "stop-loss"); save_state(st); return

    # ----- sinal da estrategia -----
    if not st["in_position"] and r < RSI_BUY:
        do_buy(ex, price, st); save_state(st)
    elif st["in_position"] and r > RSI_SELL:
        do_sell(ex, price, st, "rsi"); save_state(st)


def main():
    run_once = "--once" in sys.argv
    ex = make_exchange()
    mode = "TESTNET (dinheiro FAKE)" if ex else "SOMBRA (nenhuma ordem enviada)"
    print("=" * 60)
    print(f"  BOT INICIADO  |  MODO: {mode}")
    print(f"  {SYMBOL} {TIMEFRAME}  |  compra RSI<{RSI_BUY} / vende RSI>{RSI_SELL}")
    print(f"  stop-loss {STOP_LOSS_PCT*100:.0f}%  |  kill switch drawdown {MAX_DRAWDOWN_PCT*100:.0f}%")
    print(f"  parar: crie STOP.txt nesta pasta, ou Ctrl+C")
    print("=" * 60)

    st = load_state()
    signal.signal(signal.SIGINT, lambda *a: _stop.update(flag=True))

    while not _stop["flag"]:
        if os.path.exists("STOP.txt"):
            log("STOP.txt encontrado. Encerrando com seguranca.")
            break
        try:
            cycle(ex, st)
        except Exception as e:
            log(f"erro no ciclo (continua): {e}")
        if run_once:
            break
        for _ in range(POLL_SECONDS):
            if _stop["flag"] or os.path.exists("STOP.txt"):
                break
            time.sleep(1)

    save_state(st)
    log("Bot finalizado.")


if __name__ == "__main__":
    main()
