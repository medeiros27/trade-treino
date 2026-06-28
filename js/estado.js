// estado.js — fonte única de verdade do estado (localStorage `treino_v2`)
const CHAVE = "treino_v2";

export function padrao() {
  return {
    versao: 2,
    config: { saldoInicial: 10000, maxTradesDia: 10, cooldownMin: 3 },
    carteira: { caixa: 10000, qty: 0, avg: 0, stopPct: 5, tpPct: 10, stopPrice: 0, tpPrice: 0, aberturaTs: 0 },
    mercado: { symbol: "BTCUSDT", interval: "5m" },
    diario: [],
    missoes: { atual: "m01", concluidas: [], conquistas: [] },
    limites: { dia: "", tradesHoje: 0, ultimaPerdaTs: 0 },
    tutorialFeito: false,
    flags: { recusouCompraCaro: false },
  };
}

export function carregar() {
  try {
    const novo = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (novo) return Object.assign(padrao(), novo);
    const antigo = JSON.parse(localStorage.getItem("treino") || "null"); // migração do estado antigo
    const base = padrao();
    if (antigo) {
      base.carteira.caixa = antigo.cash ?? 10000;
      base.carteira.qty = antigo.qty ?? 0;
      base.carteira.avg = antigo.avg ?? 0;
      base.diario = (antigo.journal || []).map(j => ({
        t: j.t, ts: 0, side: j.side, price: j.price, usdt: j.usdt, qty: j.qty,
        pnl: j.pnl ?? null, note: j.note || "", equity: j.equity ?? 10000, motivo: j.note || "",
      }));
      base.mercado.symbol = antigo.symbol || "BTCUSDT";
      base.mercado.interval = antigo.interval || "5m";
    }
    return base;
  } catch (e) {
    return padrao();
  }
}

export function salvar(S) {
  localStorage.setItem(CHAVE, JSON.stringify(S));
}
