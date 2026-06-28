// guardrails.js — disciplina: risco×retorno, limite/dia, cooldown, avisos de compra.

export function riscoRetorno(valor, stopPct, tpPct) {
  const risco = valor * (stopPct / 100), retorno = valor * (tpPct / 100);
  return { risco, retorno, ratio: risco > 0 ? retorno / risco : 0 };
}

export function podeComprar(S) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  if (S.limites.dia !== hoje) { S.limites.dia = hoje; S.limites.tradesHoje = 0; }
  if (S.limites.tradesHoje >= S.config.maxTradesDia) return { ok: false, msg: "Você já operou demais hoje. Descanse 😌" };
  const restante = S.config.cooldownMin * 60000 - (Date.now() - S.limites.ultimaPerdaTs);
  if (S.limites.ultimaPerdaTs && restante > 0) return { ok: false, msg: `Respire. Volte em ${Math.ceil(restante / 1000)}s.` };
  return { ok: true };
}

export function avisosCompra(S, preco, valor, rsiVal) {
  const avisos = [];
  if (rsiVal > 70) avisos.push("RSI alto (>70): você pode estar comprando caro.");
  if (valor > 0.25 * (S.carteira.caixa + S.carteira.qty * preco)) avisos.push("Posição grande demais para iniciante (>25%).");
  return avisos;
}

export function registrarTrade(S) { S.limites.tradesHoje = (S.limites.tradesHoje || 0) + 1; }

export function registrarPerda(S, ts) { S.limites.ultimaPerdaTs = ts; }
