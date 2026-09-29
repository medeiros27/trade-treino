# -*- coding: utf-8 -*-
"""
BACKTESTER HONESTO  -  dados brutos da Binance, indicadores calculados em codigo.
-------------------------------------------------------------------------------
O objetivo deste script NAO e te dar um robo magico. E te PROVAR, com dados reais
e sem gastar 1 centavo, se uma regra de trade tem (ou nao) vantagem de verdade.

Regra de ouro: o codigo executa a estrategia com perfeicao -- mas se a estrategia
nao tem vantagem, o robo so vai perder dinheiro com mais eficiencia. O dificil
nunca foi programar; e achar uma regra com lucro POSITIVO depois de TAXA e SLIPPAGE.

Como rodar:
    pip install pandas numpy
    python backtest.py

Mexa nos parametros abaixo (ativo, timeframe, regra) e repare como o resultado MUDA.
Se muda muito, o "bom resultado" era sorte/curva ajustada -- nao vantagem real.
"""
import urllib.request, json, time
import numpy as np
import pandas as pd

# ===================== CONFIG (edite a vontade) =====================
SYMBOL     = "BTCUSDT"
INTERVAL   = "1h"     # 1m,5m,15m,1h,4h,1d
CANDLES    = 3000     # quantos candles de historico baixar
FEE        = 0.001    # 0.1% por execucao (taker Binance). NAO ignore isso.
SLIPPAGE   = 0.0005   # 0.05% de escorregamento estimado por execucao
RSI_PERIOD = 14
RSI_BUY    = 30       # compra quando RSI cai abaixo disso
RSI_SELL   = 55       # vende quando RSI sobe acima disso
BASE       = "https://data-api.binance.vision/api/v3/klines"
# ====================================================================


def fetch(symbol, interval, total):
    """Baixa candles reais da Binance, paginando (max 1000 por chamada)."""
    rows, end = [], None
    while len(rows) < total:
        url = f"{BASE}?symbol={symbol}&interval={interval}&limit=1000"
        if end is not None:
            url += f"&endTime={end}"
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.loads(r.read().decode())
        if not data:
            break
        rows = data + rows          # prepende os mais antigos
        end = data[0][0] - 1
        if len(data) < 1000:
            break
        time.sleep(0.2)
    rows = rows[-total:]
    df = pd.DataFrame(rows, columns=["t","o","h","l","c","v","ct","qv","n","tb","tq","ig"])
    df = df.astype({"o":float,"h":float,"l":float,"c":float,"v":float})
    df["dt"] = pd.to_datetime(df["t"], unit="ms", utc=True)
    return df[["dt","o","h","l","c","v"]].reset_index(drop=True)


# ---------- indicadores sobre DADOS BRUTOS (nao pixels) ----------
def rsi(close, period):
    d = close.diff()
    gain = d.clip(lower=0)
    loss = -d.clip(upper=0)
    ag = gain.ewm(alpha=1/period, adjust=False, min_periods=period).mean()
    al = loss.ewm(alpha=1/period, adjust=False, min_periods=period).mean()
    return 100 - 100/(1 + ag/al)

def macd(close):
    e12 = close.ewm(span=12, adjust=False).mean()
    e26 = close.ewm(span=26, adjust=False).mean()
    line = e12 - e26
    sig  = line.ewm(span=9, adjust=False).mean()
    return line, sig, line - sig

def bollinger(close, period=20, mult=2):
    mid = close.rolling(period).mean()
    sd  = close.rolling(period).std(ddof=0)
    return mid, mid + mult*sd, mid - mult*sd


def run():
    print(f"Baixando {CANDLES} candles de {SYMBOL} {INTERVAL}...")
    df = fetch(SYMBOL, INTERVAL, CANDLES)
    print(f"OK: {len(df)} candles, de {df.dt.iloc[0]:%Y-%m-%d} ate {df.dt.iloc[-1]:%Y-%m-%d}")

    df["rsi"] = rsi(df.c, RSI_PERIOD)
    df["macd"], df["sig"], df["hist"] = macd(df.c)
    df["bb_mid"], df["bb_up"], df["bb_low"] = bollinger(df.c)

    # ================= ESTRATEGIA (mexa aqui) =================
    # Exemplo: reversao a media com RSI, SOMENTE COMPRA (spot, SEM alavancagem).
    # Sinal no FECHAMENTO da barra i -> execucao na ABERTURA da barra i+1.
    # (executar na proxima barra evita "look-ahead bias": trapacear olhando o futuro)
    cash, units, buy_cost = 1.0, 0.0, 0.0
    equity, trades = [], []
    for i in range(len(df) - 1):
        equity.append(cash + units * df.c.iloc[i])   # marca o capital na barra atual
        r = df.rsi.iloc[i]
        if np.isnan(r):
            continue
        px = df.o.iloc[i + 1]                         # preco de execucao = abertura seguinte
        if units == 0.0 and r < RSI_BUY:             # ---- COMPRA ----
            buy_price = px * (1 + SLIPPAGE)
            units = cash * (1 - FEE) / buy_price
            buy_cost, cash = cash, 0.0
        elif units > 0.0 and r > RSI_SELL:           # ---- VENDE ----
            sell_price = px * (1 - SLIPPAGE)
            cash = units * sell_price * (1 - FEE)
            trades.append(cash / buy_cost - 1)       # lucro/prejuizo LIQUIDO do trade
            units = 0.0
    # =========================================================

    final = cash + units * df.c.iloc[-1]             # fecha a mercado no fim
    equity.append(final)
    eq = pd.Series(equity)

    strat_ret = final - 1
    bh_ret    = df.c.iloc[-1] / df.c.iloc[0] - 1     # comprar e segurar (referencia)
    dd        = (eq / eq.cummax() - 1).min()         # pior queda do capital
    winrate   = (len([t for t in trades if t > 0]) / len(trades)) if trades else 0

    print("\n================ RESULTADO ================")
    print(f"Regra: compra RSI<{RSI_BUY} / vende RSI>{RSI_SELL}  (so-compra, sem alavancagem)")
    print(f"Custos: taxa {FEE*100:.2f}%/execucao + slippage {SLIPPAGE*100:.3f}%/execucao")
    print(f"Operacoes: {len(trades)}   |   Taxa de acerto: {winrate*100:.1f}%")
    print(f"Retorno da ESTRATEGIA : {strat_ret*100:+.2f}%")
    print(f"Retorno BUY & HOLD    : {bh_ret*100:+.2f}%   <- so comprar e nao fazer nada")
    print(f"Pior queda (drawdown) : {dd*100:.2f}%")
    print("===========================================")
    if strat_ret < bh_ret:
        print("VEREDITO: a estrategia PERDEU do simples 'comprar e segurar'.")
        print("Todo esse trabalho rendeu MENOS do que nao fazer nada.")
    else:
        print("VEREDITO: a estrategia bateu o buy & hold NESTE periodo/ativo.")
        print("CUIDADO: ganhar no passado NAO garante o futuro (overfitting).")
    print("\nTeste: troque SYMBOL/INTERVAL e rode de novo. Se o resultado vira de cabeca")
    print("pra baixo, o 'bom numero' era sorte -- nao vantagem real e repetivel.")

    df["equity"] = eq.values
    df.to_csv("resultado_backtest.csv", index=False)
    print("\nCurva de capital salva em: resultado_backtest.csv")


if __name__ == "__main__":
    run()
