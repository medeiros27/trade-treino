# App de Treino de Trade — Especificação de Design

**Data:** 2026-06-27
**Projeto:** `C:\Dev\trade-dashboard` (repo `medeiros27/trade-treino`, GitHub Pages)
**Autor:** Bruno (medeiros27) + Claude
**Status:** Aprovado para implementação

---

## 1. Objetivo

Transformar o `treino.html` atual (paper trading simples) num **app de treino completo para iniciante absoluto**, rodando no **iPhone 14 (iOS Safari, como PWA)**, com dinheiro 100% fake. O foco é **aprender a operar com disciplina**, não enriquecer. O app é um simulador educativo.

Quatro pilares (todos escolhidos pelo usuário):
1. **Gráfico melhor** — zoom, arrastar e marcações.
2. **Missões guiadas** — curso passo-a-passo (espinha do app).
3. **Análise de progresso** — estatísticas, curva de capital, relatório de aptidão.
4. **Guardrails de disciplina** — risco×retorno, limite diário, pausa pós-perda, avisos.

## 2. Não-objetivos (YAGNI — deliberadamente FORA)

- ❌ Dinheiro real / conexão com corretora.
- ❌ Alavancagem e venda a descoberto (short). **Somente compra à vista (long-only).**
- ❌ Login / conta / backend. Tudo local (localStorage).
- ❌ Notificações push (não confiáveis no iOS web).
- ❌ Framework/build (React etc.). Arquivos estáticos puros.
- ❌ Múltiplos usuários, social, ranking.

## 3. Princípio honesto (não negociável)

É um **simulador de aprendizado**. Passar nas missões e no medidor de aptidão é necessário, mas **não garante sucesso com dinheiro real** (psicologia e slippage mudam tudo). O veredito final de aptidão é **humano** (Claude), via diário exportado — o medidor automático é só um indicador.

---

## 4. Arquitetura

**Abordagem escolhida:** arquivos estáticos modulares, **sem etapa de build**, hospedados no GitHub Pages. ES Modules (`<script type="module">`).

### Estrutura de arquivos
```
trade-dashboard/
  index.html            # estrutura + navegação por abas (app principal)
  treino.html           # redirect para index.html (preserva o ícone JÁ instalado no iPhone do Bruno)
  css/
    estilo.css          # todo o estilo (tema escuro, mobile-first, safe-area)
  js/
    estado.js           # carregar/salvar tudo em localStorage (fonte única de estado)
    dados.js            # fetch candles Binance (data-api.binance.vision) + RSI/MACD/EMA + suporte/resistência
    grafico.js          # lightweight-charts: candles, EMAs, zoom/pan, marcações (setas, linhas stop/take/S-R)
    trade.js            # motor de paper trading: caixa, posição, taxa 0,1%, stop/take automáticos
    guardrails.js       # risco×retorno, limite/dia, cooldown pós-perda, avisos (RSI alto, posição grande)
    missoes.js          # currículo (lista de missões) + detecção automática de conclusão
    progresso.js        # cálculo de estatísticas, curva de capital, medidor de aptidão
    aprender.js         # glossário + tutorial inicial + textos de explicação dos indicadores
    app.js              # cola tudo: navegação de abas, loop de atualização (a cada 20s), eventos
  icons/
    icon-180.png        # apple-touch-icon
    icon-512.png        # manifest
  manifest.json         # PWA
  docs/superpowers/specs/...
```

> Nota: o `treino.html` atual será refatorado para `index.html` + módulos. A URL do app passa a ser a raiz: `https://medeiros27.github.io/trade-treino/`. O arquivo `treino.html` vira um **redirect** para a raiz (`<meta http-equiv="refresh">`), assim o ícone que o Bruno já instalou no iPhone (que aponta para `/treino.html`) continua abrindo o app normalmente.

### Regras de design de código
- Cada módulo tem **uma responsabilidade** e expõe funções nomeadas.
- `estado.js` é a **única** fonte de verdade do estado; outros módulos leem/escrevem por ele.
- Nenhum módulo acessa o DOM de outro; `app.js` orquestra.

---

## 5. Modelo de estado (localStorage, chave `treino_v2`)

```js
{
  versao: 2,
  config: { saldoInicial: 10000, maxTradesDia: 10, cooldownMin: 3 },
  carteira: { caixa, qty, avg, stopPct, tpPct, stopPrice, tpPrice, aberturaTs },
  mercado: { symbol: "BTCUSDT", interval: "5m" },
  diario: [ { t, side, price, usdt, qty, pnl?, note, equity, motivo, missao? } ],
  missoes: { atual: "m01", concluidas: ["m01",...], conquistas: [...] },
  limites: { dia: "AAAA-MM-DD", tradesHoje: 0, ultimaPerdaTs: 0 },
  tutorialFeito: false
}
```
Migração: se existir estado antigo (`treino`), importar caixa/diário para `treino_v2`.

---

## 6. Aba TREINAR (tela principal)

### Gráfico (`grafico.js`)
- Candles + EMA 9/21 (como hoje).
- **Zoom**: habilitar `handleScroll` e `handleScale` (pinça + arrastar no touch).
- **Marcações:**
  - **Setas de compra/venda**: `setMarkers` na série de candles — seta verde "▲ comprou" embaixo do candle da compra; seta vermelha "▼ vendeu" em cima do candle da venda. Lidas do `diario`.
  - **Linha de stop-loss** (vermelha tracejada) e **take-profit** (verde tracejada): `createPriceLine` enquanto há posição aberta.
  - **Suporte/Resistência**: linha do menor mínimo e do maior máximo dos últimos ~50 candles fechados (faint), rotuladas "suporte"/"resistência". Recalcula a cada atualização.

### Indicadores (badges)
- RSI, Tendência, Momentum (como hoje). **Tocar** num badge abre um cartão com a explicação simples (texto vindo de `aprender.js`).

### Card de posição
- Mostra entrada, P&L aberto, 🛡️ stop e 🎯 take (como hoje), + tempo segurando.

### Controles de compra + Guardrails (`guardrails.js`)
- Campos: motivo (texto), valor (USDT), botões 25/50/Tudo, stop %, take %.
- **Antes de comprar**, mostrar em tempo real:
  - **Risco × retorno**: "arrisca R$ X pra ganhar R$ Y — proporção Z:1". Realça verde se Z ≥ 2, amarelo se 1–2, vermelho se < 1.
- **Bloqueios/avisos ao tocar COMPRAR:**
  - Se `tradesHoje >= maxTradesDia` → bloqueia: "Você já operou demais hoje. Descanse." 
  - Se dentro do cooldown pós-perda → bloqueia com contagem regressiva: "Respire. Volte em Xs."
  - Se RSI > 70 → confirma: "RSI alto, você pode estar comprando caro. Comprar mesmo assim?"
  - Se valor > 25% do patrimônio → confirma: "Posição grande demais para iniciante. Tem certeza?"
- VENDER TUDO: como hoje. Stop/take continuam automáticos (`trade.js` no loop).

---

## 7. Aba MISSÕES (`missoes.js`)

Currículo ordenado. Cada missão: `{ id, titulo, ensina (texto), objetivo (função que checa o estado/diário), conquista }`. A missão **atual** aparece também como faixa na aba Treinar. Conclusão é **detectada automaticamente** após cada trade/ação; ao concluir → toast + conquista 🏅 + libera a próxima.

### Lista de missões (v1)
1. **m01 · O que é o RSI** — ler o cartão e tocar "entendi".
2. **m02 · O que é Tendência e Momentum** — ler e tocar "entendi".
3. **m03 · Seu primeiro trade** — fazer 1 compra e 1 venda.
4. **m04 · Sempre com rede** — fechar 1 trade que tinha stop-loss definido.
5. **m05 · Alvo definido** — fechar 1 trade com stop **e** take-profit definidos.
6. **m06 · Risco × retorno** — fazer 1 trade com take ≥ 2× o stop.
7. **m07 · Deixe o plano trabalhar** — sair por stop OU take automático (não manual) ao menos 1 vez.
8. **m08 · Pare o impulso** — segurar um trade por ≥ 10 min antes de sair.
9. **m09 · Tamanho consistente** — fazer 3 trades seguidos com o mesmo tamanho (±10%).
10. **m10 · Não opere caro** — recusar (cancelar) uma compra com RSI > 70 quando avisado.
11. **m11 · Sobreviva a 10 trades** — completar 10 trades mantendo patrimônio ≥ 9.500.
12. **m12 · Diário do trader** — exportar o diário ao menos 1 vez.

> Conjunto inicial; fácil adicionar mais depois. Conclusão de cada uma é uma função pura sobre o estado.

---

## 8. Aba PROGRESSO (`progresso.js`)

### Estatísticas (calculadas do `diario`)
- Nº de trades; nº de vendas; **acerto %** (vendas com pnl>0 ÷ vendas).
- **Ganho médio** × **perda média**; **fator de lucro** (Σ ganhos ÷ |Σ perdas|); **expectativa** (pnl médio por venda).
- **Pior queda (drawdown)** da curva de patrimônio; **melhor**/**pior** trade.
- **Tempo médio segurando** (compra→venda); **% de trades com stop** definido.

### Curva de capital
- Mini gráfico de linha do patrimônio ao longo dos trades (lightweight-charts line series), usando o campo `equity` do diário.

### Medidor "Você está apto?" (automático, provisório)
Pontua critérios objetivos (cada um vale pontos, total 0–100):
- Usa stop em ≥ 80% dos trades.
- Risco:retorno médio ≥ 1,5.
- Fator de lucro ≥ 1,2.
- Não estourou o limite diário com frequência.
- Resultado ≥ break-even em ≥ 30 trades.
Exibe nota + status ("Em treino" / "Promissor" / "Pronto pra próxima etapa") **com aviso**: "isto é automático; o veredito real é do Claude — exporte seu diário". Botão **Exportar diário** mantido.

---

## 9. Aba APRENDER (`aprender.js`)

- **Glossário** (linguagem de leigo): RSI, MACD, Tendência, Momentum, Stop-loss, Take-profit, Suporte/Resistência, Risco×Retorno, Drawdown, Taxa.
- **Rever tutorial** inicial (overlay de boas-vindas mostrado no 1º acesso; `tutorialFeito` controla).
- Os textos do glossário alimentam também os cartões ao tocar nos indicadores na aba Treinar (fonte única).

---

## 10. Fonte de dados e indicadores (`dados.js`)

- Candles públicos: `https://data-api.binance.vision/api/v3/klines` (sem chave). Símbolo sem barra (BTCUSDT), intervalo do seletor de velocidade.
- Indicadores calculados em JS (mesma lógica já validada): EMA, RSI (Wilder), MACD, suporte/resistência (máx/mín de N candles).
- Atualização a cada 20s (`app.js`).

## 11. Específicos de iOS / PWA

- `manifest.json` com `display: standalone`, ícones 180/512, tema escuro.
- `apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover`, respeitar safe-area.
- Gráfico com pinça/zoom touch habilitado.
- localStorage persiste o treino entre sessões.
- Navegação por **abas fixas no rodapé** (Treinar / Missões / Progresso / Aprender), alvos de toque ≥ 44px.

## 12. Plano de testes (manual — app pessoal, sem framework)

- Claude testa no navegador/preview local: cada aba abre, trades simulados funcionam, stop/take disparam, missões completam, estatísticas batem, estado persiste após recarregar.
- Bruno testa no iPhone via URL do Pages (instalar na tela inicial).
- Sem testes automatizados (overkill para o escopo).

## 13. Fases de implementação (para o plano)

- **Fase 0 — Refatorar** o `treino.html` atual para `index.html` + módulos, **preservando o comportamento atual** (chart, indicadores, paper trading, stop/take, diário, export).
- **Fase 1 — Gráfico**: zoom/pan + marcações (setas, linhas stop/take, suporte/resistência).
- **Fase 2 — Guardrails**: risco×retorno ao vivo, limite/dia, cooldown pós-perda, avisos.
- **Fase 3 — Missões**: motor + currículo + aba + detecção de conclusão + faixa na aba Treinar.
- **Fase 4 — Progresso**: estatísticas + curva de capital + medidor de aptidão.
- **Fase 5 — Aprender**: glossário + tutorial + cartões nos indicadores.
- **Fase 6 — PWA/iOS**: ícones, abas no rodapé, safe-area, deploy no Pages.

Cada fase termina com deploy (`git push`) e o app continua funcional entre fases.
