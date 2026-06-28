// progresso.js — estatísticas, curva de capital, medidor de aptidão e export do diário.

const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- estatísticas ----------
export function estatisticas(S) {
  const vendas = S.diario.filter(d => d.side === "VENDA");
  const ganhos = vendas.filter(v => v.pnl > 0), perdas = vendas.filter(v => v.pnl <= 0);
  const soma = a => a.reduce((s, v) => s + v.pnl, 0);
  const eqs = S.diario.map(d => d.equity);
  let pico = S.config.saldoInicial, dd = 0;
  eqs.forEach(e => { pico = Math.max(pico, e); dd = Math.min(dd, e / pico - 1); });
  return {
    trades: S.diario.length, vendas: vendas.length,
    acerto: vendas.length ? (ganhos.length / vendas.length * 100) : 0,
    ganhoMedio: ganhos.length ? soma(ganhos) / ganhos.length : 0,
    perdaMedio: perdas.length ? soma(perdas) / perdas.length : 0,
    fatorLucro: perdas.length && soma(perdas) !== 0 ? Math.abs(soma(ganhos) / soma(perdas)) : (ganhos.length ? Infinity : 0),
    expectativa: vendas.length ? soma(vendas) / vendas.length : 0,
    drawdown: dd * 100,
    melhor: vendas.length ? Math.max(...vendas.map(v => v.pnl)) : 0,
    pior: vendas.length ? Math.min(...vendas.map(v => v.pnl)) : 0,
  };
}

// ---------- curva de capital (compatível com lightweight-charts) ----------
// Retorna { time: epoch-segundos, value: equity } por item com ts > 0, ordenado por time crescente.
export function curva(S) {
  return S.diario
    .filter(d => d.ts > 0)
    .map(d => ({ time: Math.floor(d.ts / 1000), value: d.equity }))
    .sort((a, b) => a.time - b.time);
}

// ---------- aptidão (medidor automático) ----------
export function aptidao(S) {
  const e = estatisticas(S);
  const usaStop = S.diario.filter(d => d.side === "COMPRA").length > 0;
  const criterios = [
    { nome: "Usa stop-loss", ok: usaStop },
    { nome: "Fator de lucro ≥ 1,2", ok: e.fatorLucro >= 1.2 },
    { nome: "Resultado ≥ break-even", ok: e.expectativa >= 0 },
    { nome: "≥ 30 trades", ok: e.vendas >= 30 },
    { nome: "Sem operar demais", ok: (S.limites.tradesHoje || 0) < S.config.maxTradesDia },
  ];
  const nota = Math.round(criterios.filter(c => c.ok).length / criterios.length * 100);
  const status = nota >= 80 ? "Pronto pra próxima etapa" : nota >= 50 ? "Promissor" : "Em treino";
  return { nota, status, criterios };
}

// ---------- export do diário (mesmo formato do antigo exportarDiario do app.js) ----------
export function exportarTexto(S, precoAtual) {
  const e = estatisticas(S);
  const eq = S.carteira.caixa + S.carteira.qty * (precoAtual || 0);
  const res = eq - S.config.saldoInicial;
  const winrate = e.vendas ? e.acerto.toFixed(0) : "-";

  let txt = `=== DIÁRIO DE TREINO (dinheiro fake) ===\n`;
  txt += `Ativo atual: ${S.mercado.symbol}\n`;
  txt += `Patrimônio: ${fmt(eq)} USDT (começou com ${S.config.saldoInicial})\n`;
  txt += `Resultado: ${res >= 0 ? '+' : ''}${fmt(res)} USDT\n`;
  txt += `Operações: ${e.trades} | Vendas: ${e.vendas} | Acerto: ${winrate}% | Pior queda: ${e.drawdown.toFixed(1)}%\n\n`;
  txt += `--- histórico ---\n`;
  S.diario.forEach(t => {
    txt += `${t.t} | ${t.side} @ ${fmt(t.price)} | ${t.usdt ? fmt(t.usdt) + ' USDT' : ''}${t.pnl != null ? ' | resultado ' + fmt(t.pnl) : ''}${t.motivo ? ' | motivo: ' + t.motivo : ''}\n`;
  });
  return txt;
}
