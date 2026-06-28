// aprender.js — glossário de termos + explicações dos indicadores (linguagem leiga).

export const GLOSSARIO = {
  RSI: "Um velocímetro do preço, de 0 a 100. Acima de 70 o preço subiu rápido demais (caro, cuidado pra não comprar no topo). Abaixo de 30 caiu demais (pode estar barato).",
  "Tendência": "A direção geral do preço. Se vem fazendo topos e fundos cada vez mais altos, é tendência de alta; o contrário é de baixa. Operar a favor da tendência costuma ser mais seguro.",
  Momentum: "Mostra quem está com a força agora: o comprador ou o vendedor. Quando o comprador domina, o preço tende a subir; quando o vendedor domina, tende a cair.",
  "Stop-loss": "Uma saída automática que vende se o preço cair X%. Serve pra limitar a perda quando você erra — é o seu cinto de segurança.",
  "Take-profit": "Uma saída automática que vende se o preço subir X%. Garante o lucro antes que o mercado vire e tire o que você já ganhou.",
  "Suporte/Resistência": "Regiões onde o preço costuma parar e voltar. Suporte é um 'chão' onde tende a parar de cair; resistência é um 'teto' onde tende a parar de subir.",
  "Risco × Retorno": "Compara quanto você pode perder com quanto pode ganhar numa operação. O ideal pra iniciante é mirar ganhar pelo menos 2× o que arrisca (2:1).",
  Drawdown: "A maior queda do seu patrimônio do pico até o fundo no caminho. Mede o tombo que você aguentou — quanto menor, mais saudável é a sua gestão de risco.",
  Taxa: "O custo de cada operação, aqui simulado em 0,1%. Parece pouco, mas se você operar muitas vezes ao dia, essas taxas se somam e corroem o seu resultado.",
};

export function explicacao(ind) {
  return GLOSSARIO[ind] || "";
}
