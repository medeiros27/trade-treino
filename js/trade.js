// trade.js — motor de paper trading (taxa 0,1%, stop/take). NÃO toca no DOM.
const FEE = 0.001;

export function patrimonio(S, preco) {
  return S.carteira.caixa + S.carteira.qty * preco;
}

export function comprar(S, preco, valorUSDT, stopPct, tpPct, motivo) {
  const c = S.carteira;
  let amt = Math.min(valorUSDT || c.caixa, c.caixa);
  if (amt < 1) return { ok: false, msg: "Sem caixa" };
  const fee = amt * FEE, q = (amt - fee) / preco;
  c.avg = c.qty > 0 ? (c.qty * c.avg + q * preco) / (c.qty + q) : preco;
  c.qty += q; c.caixa -= amt; c.stopPct = stopPct; c.tpPct = tpPct;
  c.stopPrice = c.avg * (1 - stopPct / 100);
  c.tpPrice = tpPct ? c.avg * (1 + tpPct / 100) : 0;
  c.aberturaTs = Date.now();
  S.diario.push({
    t: new Date().toLocaleString("pt-BR"), ts: Date.now(), side: "COMPRA",
    price: preco, usdt: amt, qty: q, pnl: null, note: motivo || "", motivo: motivo || "",
    equity: patrimonio(S, preco),
  });
  return { ok: true };
}

export function vender(S, preco, motivo) {
  const c = S.carteira;
  if (c.qty <= 0) return { ok: false };
  const proceeds = c.qty * preco, fee = proceeds * FEE, pnl = (preco - c.avg) * c.qty - fee;
  c.caixa += proceeds - fee;
  const note = motivo === "stop-loss" ? "🛡️ STOP-LOSS" : motivo === "take-profit" ? "🎯 TAKE-PROFIT" : "manual";
  S.diario.push({
    t: new Date().toLocaleString("pt-BR"), ts: Date.now(), side: "VENDA",
    price: preco, usdt: proceeds - fee, qty: c.qty, pnl, note, motivo: note, equity: c.caixa,
  });
  c.qty = 0; c.avg = 0; c.stopPrice = 0; c.tpPrice = 0; c.aberturaTs = 0;
  return { ok: true, pnl, motivo };
}

export function checarAutoSaida(S, preco) {
  const c = S.carteira;
  if (c.qty <= 0) return null;
  if (c.stopPrice && preco <= c.stopPrice) return vender(S, preco, "stop-loss");
  if (c.tpPrice && preco >= c.tpPrice) return vender(S, preco, "take-profit");
  return null;
}
