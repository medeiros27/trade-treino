// missoes.js — currículo guiado (12 missões) + avaliação de conclusão.
const vendas = S => S.diario.filter(d => d.side === "VENDA");

export const LISTA = [
  { id:"m01", titulo:"O que é o RSI", ensina:"O RSI é um velocímetro de 0 a 100. Acima de 70 = o preço subiu rápido demais (caro, cuidado). Abaixo de 30 = caiu demais (barato). No meio = neutro. Toque em 'Entendi' quando captar.", objetivo:S=>S.missoes.conquistas.includes("leu_rsi"), conquista:"🏅 Aprendiz do RSI" },
  { id:"m02", titulo:"Tendência e Momentum", ensina:"Tendência é a direção geral do preço (Alta ou Baixa). Momentum é quem está empurrando AGORA: comprador ou vendedor. Juntos, te dão o clima do mercado. Toque em 'Entendi'.", objetivo:S=>S.missoes.conquistas.includes("leu_tm"), conquista:"🏅 Leitor de mercado" },
  { id:"m03", titulo:"Seu primeiro trade", ensina:"Compre e venda uma vez.", objetivo:S=>vendas(S).length >= 1, conquista:"🏅 Primeiro trade" },
  { id:"m04", titulo:"Sempre com rede", ensina:"Opere com stop-loss.", objetivo:S=>vendas(S).some(v=>v.note?.includes("STOP")||S.diario.some(d=>d.side==="COMPRA")) , conquista:"🏅 Com rede" },
  { id:"m05", titulo:"Alvo definido", ensina:"Defina stop E take.", objetivo:S=>vendas(S).some(v=>v.note?.includes("TAKE")), conquista:"🏅 Com alvo" },
  { id:"m06", titulo:"Risco × retorno", ensina:"Take ao menos 2× o stop.", objetivo:S=> S.carteira.tpPct >= 2*S.carteira.stopPct && vendas(S).length>=1, conquista:"🏅 2 pra 1" },
  { id:"m07", titulo:"Deixe o plano trabalhar", ensina:"Saia por stop/take automático.", objetivo:S=>vendas(S).some(v=>v.note?.includes("STOP")||v.note?.includes("TAKE")), conquista:"🏅 Disciplina" },
  { id:"m08", titulo:"Pare o impulso", ensina:"Segure ≥10 min.", objetivo:S=>S.diario.some((d,i)=>d.side==="VENDA" && S.diario.slice(0,i).reverse().find(x=>x.side==="COMPRA") && (d.ts - (S.diario.slice(0,i).reverse().find(x=>x.side==="COMPRA").ts||d.ts)) >= 600000), conquista:"🏅 Paciência" },
  { id:"m09", titulo:"Tamanho consistente", ensina:"3 compras de tamanho parecido.", objetivo:S=>{ const c=S.diario.filter(d=>d.side==="COMPRA").slice(-3); return c.length===3 && c.every(x=>Math.abs(x.usdt-c[0].usdt)<=0.1*c[0].usdt); }, conquista:"🏅 Constante" },
  { id:"m10", titulo:"Não opere caro", ensina:"Recuse comprar com RSI>70.", objetivo:S=>S.flags.recusouCompraCaro, conquista:"🏅 Comprador esperto" },
  { id:"m11", titulo:"Sobreviva a 10 trades", ensina:"10 trades mantendo ≥9500.", objetivo:S=>vendas(S).length>=10 && S.carteira.caixa + (S.carteira.qty*S.carteira.avg) >= 9500, conquista:"🏅 Sobrevivente" },
  { id:"m12", titulo:"Diário do trader", ensina:"Exporte seu diário.", objetivo:S=>S.missoes.conquistas.includes("exportou"), conquista:"🏅 Diarista" },
];

export function avaliar(S) {
  const novas = [];
  for (const m of LISTA) {
    if (!S.missoes.concluidas.includes(m.id) && m.objetivo(S)) {
      S.missoes.concluidas.push(m.id); S.missoes.conquistas.push(m.conquista); novas.push(m);
    }
  }
  const prox = LISTA.find(m => !S.missoes.concluidas.includes(m.id));
  S.missoes.atual = prox ? prox.id : "fim";
  return novas;
}
