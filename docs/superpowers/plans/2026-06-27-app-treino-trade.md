# App de Treino de Trade — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o `treino.html` num app de treino de trade modular, completo e mobile-first (iPhone 14/PWA), com gráfico (zoom+marcações), curso de missões, progresso e guardrails de disciplina.

**Architecture:** Arquivos estáticos puros (sem build), ES Modules. `index.html` carrega `css/estilo.css` e módulos `js/*`. Estado único em localStorage via `estado.js`. Hospedado no GitHub Pages (`medeiros27/trade-treino`). Spec: `docs/superpowers/specs/2026-06-27-app-treino-trade-design.md`.

**Tech Stack:** HTML5, CSS3, JavaScript (ES Modules), lightweight-charts 4.1.3 (CDN), API pública Binance (`data-api.binance.vision`), localStorage, PWA.

---

## Abordagem de testes (importante)

Não há test runner (é app de navegador estático, conforme spec §12). Cada passo de **Verificação** significa: servir a pasta (`python -m http.server 8000` em `C:\Dev\trade-dashboard`) e abrir `http://localhost:8000/` no navegador (ou usar o preview), e conferir o comportamento descrito. Manter mudanças pequenas e verificar após cada uma. Console do navegador deve ficar **sem erros**.

## Mapa de arquivos (responsabilidade única por arquivo)

| Arquivo | Responsabilidade | Exporta |
|---|---|---|
| `index.html` | Estrutura, abas no rodapé, containers das 4 telas | — |
| `treino.html` | Redirect p/ `/` (preserva ícone instalado) | — |
| `css/estilo.css` | Tema escuro, mobile-first, safe-area, abas, cards | — |
| `js/estado.js` | Carregar/salvar/migrar estado (localStorage `treino_v2`) | `carregar, salvar, padrao` |
| `js/dados.js` | Buscar candles + indicadores (EMA/RSI/MACD) + suporte/resistência | `buscarCandles, ema, rsi, macdHist, suporteResistencia` |
| `js/grafico.js` | lightweight-charts: candles, EMAs, zoom/pan, marcadores, linhas | `criar` (retorna API: `atualizar, marcadores, linhasStopTake, linhasSR`) |
| `js/trade.js` | Motor paper trading: comprar/vender/auto-saída/patrimônio | `comprar, vender, checarAutoSaida, patrimonio` |
| `js/guardrails.js` | risco×retorno, limite/dia, cooldown, avisos | `riscoRetorno, podeComprar, avisosCompra, registrarTrade, registrarPerda` |
| `js/missoes.js` | Currículo + avaliação de conclusão | `LISTA, avaliar` |
| `js/progresso.js` | Estatísticas, curva, aptidão, exportar diário | `estatisticas, curva, aptidao, exportarTexto` |
| `js/aprender.js` | Glossário + explicações dos indicadores | `GLOSSARIO, explicacao` |
| `js/app.js` | Orquestra: navegação de abas, loop 20s, eventos, render | — (entrypoint) |
| `manifest.json` | PWA (já existe; ajustar ícones) | — |
| `icons/icon-180.png`, `icons/icon-512.png` | Ícones PWA/apple-touch | — |

## Esquema de estado (localStorage `treino_v2`)

```js
{
  versao: 2,
  config: { saldoInicial: 10000, maxTradesDia: 10, cooldownMin: 3 },
  carteira: { caixa: 10000, qty: 0, avg: 0, stopPct: 5, tpPct: 10, stopPrice: 0, tpPrice: 0, aberturaTs: 0 },
  mercado: { symbol: "BTCUSDT", interval: "5m" },
  diario: [], // { t, ts, side, price, usdt, qty, pnl, note, equity, motivo }
  missoes: { atual: "m01", concluidas: [], conquistas: [] },
  limites: { dia: "", tradesHoje: 0, ultimaPerdaTs: 0 },
  tutorialFeito: false,
  flags: { recusouCompraCaro: false } // p/ missão m10
}
```

---

## Fase 0 — Refatorar preservando comportamento

Objetivo: quebrar o `treino.html` atual nos módulos, sem mudar o que o app faz hoje (chart, RSI/MACD/EMA, paper trading, stop/take, diário, export, seletores).

### Task 0.1: Esqueleto de arquivos e estado

**Files:**
- Create: `js/estado.js`, `js/dados.js`, `js/trade.js`, `js/app.js`, `css/estilo.css`, `index.html`
- Reference: `treino.html` (origem do código atual)

- [ ] **Step 1: Criar `js/estado.js`** com o estado e migração do estado antigo (`treino`).

```js
const CHAVE = "treino_v2";
export function padrao() {
  return {
    versao: 2,
    config: { saldoInicial: 10000, maxTradesDia: 10, cooldownMin: 3 },
    carteira: { caixa: 10000, qty: 0, avg: 0, stopPct: 5, tpPct: 10, stopPrice: 0, tpPrice: 0, aberturaTs: 0 },
    mercado: { symbol: "BTCUSDT", interval: "5m" },
    diario: [], missoes: { atual: "m01", concluidas: [], conquistas: [] },
    limites: { dia: "", tradesHoje: 0, ultimaPerdaTs: 0 },
    tutorialFeito: false, flags: { recusouCompraCaro: false },
  };
}
export function carregar() {
  try {
    const novo = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (novo) return Object.assign(padrao(), novo);
    const antigo = JSON.parse(localStorage.getItem("treino") || "null"); // migração
    const base = padrao();
    if (antigo) {
      base.carteira.caixa = antigo.cash ?? 10000;
      base.carteira.qty = antigo.qty ?? 0;
      base.carteira.avg = antigo.avg ?? 0;
      base.diario = (antigo.journal || []).map(j => ({ t: j.t, ts: 0, side: j.side, price: j.price, usdt: j.usdt, qty: j.qty, pnl: j.pnl ?? null, note: j.note || "", equity: j.equity ?? 10000, motivo: j.note || "" }));
      base.mercado.symbol = antigo.symbol || "BTCUSDT";
      base.mercado.interval = antigo.interval || "5m";
    }
    return base;
  } catch (e) { return padrao(); }
}
export function salvar(S) { localStorage.setItem(CHAVE, JSON.stringify(S)); }
```

- [ ] **Step 2: Criar `js/dados.js`** movendo as funções de indicadores já existentes (`ema`, `rsi`, `macdHist`) do `treino.html` e adicionando `buscarCandles` e `suporteResistencia`.

```js
const BASE = "https://data-api.binance.vision/api/v3";
export async function buscarCandles(symbol, interval, limite = 200) {
  const r = await fetch(`${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limite}`);
  const raw = await r.json();
  return raw.map(k => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
}
export function ema(v, p) { /* copiar do treino.html */ }
export function rsi(v, p = 14) { /* copiar do treino.html */ }
export function macdHist(v) { /* copiar do treino.html */ }
export function suporteResistencia(candles, n = 50) {
  const slice = candles.slice(-n);
  return { suporte: Math.min(...slice.map(c => c.low)), resistencia: Math.max(...slice.map(c => c.high)) };
}
```

- [ ] **Step 3: Criar `js/trade.js`** movendo a lógica de `buy`/`sell`/`equity` do `treino.html`, parametrizada por estado (sem tocar no DOM).

```js
const FEE = 0.001;
export function patrimonio(S, preco) { return S.carteira.caixa + S.carteira.qty * preco; }
export function comprar(S, preco, valorUSDT, stopPct, tpPct, motivo) {
  const c = S.carteira; let amt = Math.min(valorUSDT || c.caixa, c.caixa);
  if (amt < 1) return { ok: false, msg: "Sem caixa" };
  const fee = amt * FEE, q = (amt - fee) / preco;
  c.avg = c.qty > 0 ? (c.qty * c.avg + q * preco) / (c.qty + q) : preco;
  c.qty += q; c.caixa -= amt; c.stopPct = stopPct; c.tpPct = tpPct;
  c.stopPrice = c.avg * (1 - stopPct / 100); c.tpPrice = tpPct ? c.avg * (1 + tpPct / 100) : 0;
  c.aberturaTs = Date.now();
  S.diario.push({ t: new Date().toLocaleString("pt-BR"), ts: Date.now(), side: "COMPRA", price: preco, usdt: amt, qty: q, pnl: null, note: motivo || "", motivo: motivo || "", equity: patrimonio(S, preco) });
  return { ok: true };
}
export function vender(S, preco, motivo) {
  const c = S.carteira; if (c.qty <= 0) return { ok: false };
  const proceeds = c.qty * preco, fee = proceeds * FEE, pnl = (preco - c.avg) * c.qty - fee;
  c.caixa += proceeds - fee;
  const note = motivo === "stop-loss" ? "🛡️ STOP-LOSS" : motivo === "take-profit" ? "🎯 TAKE-PROFIT" : "manual";
  S.diario.push({ t: new Date().toLocaleString("pt-BR"), ts: Date.now(), side: "VENDA", price: preco, usdt: proceeds - fee, qty: c.qty, pnl, note, motivo: note, equity: c.caixa });
  c.qty = 0; c.avg = 0; c.stopPrice = 0; c.tpPrice = 0; c.aberturaTs = 0;
  return { ok: true, pnl, motivo };
}
export function checarAutoSaida(S, preco) {
  const c = S.carteira; if (c.qty <= 0) return null;
  if (c.stopPrice && preco <= c.stopPrice) return vender(S, preco, "stop-loss");
  if (c.tpPrice && preco >= c.tpPrice) return vender(S, preco, "take-profit");
  return null;
}
```

- [ ] **Step 4: Criar `css/estilo.css`** movendo todo o `<style>` do `treino.html` e adicionando a barra de abas no rodapé (`.tabbar`, `.tab`, `.tela`).

- [ ] **Step 5: Criar `index.html`** com as 4 telas (`<section class="tela" id="tela-treinar">` … missoes/progresso/aprender), a `.tabbar` no rodapé, `<link rel="manifest">`, metas iOS já existentes, e `<script type="module" src="js/app.js">`. A tela Treinar contém todo o conteúdo atual do `treino.html` (chart, badges, posição, controles, diário).

- [ ] **Step 6: Verificação** — servir e abrir `http://localhost:8000/`. A aba Treinar deve mostrar gráfico, RSI/MACD, comprar/vender, stop/take e diário funcionando **igual ao treino.html atual**. Console sem erros. As outras 3 abas podem estar vazias por enquanto.

- [ ] **Step 7: Commit**
```bash
git add index.html css/ js/ ; git commit -m "Fase 0: refatora treino em modulos (comportamento preservado)"
```

### Task 0.2: `js/app.js` orquestrando + redirect do treino.html

**Files:** Create: `js/grafico.js`; Modify: `treino.html`, `js/app.js`

- [ ] **Step 1: Criar `js/grafico.js`** encapsulando a criação do chart (mover de `treino.html`), expondo `criar(el)` que retorna `{ atualizar({candles,ema9,ema21}), marcadores(trades), linhasStopTake(sp,tp), linhasSR(s,r), resize() }`. Na Fase 0, implementar só `atualizar` e `resize` (mesma aparência atual).

- [ ] **Step 2: Escrever `js/app.js`**: importar módulos, `const S = Estado.carregar()`, criar gráfico, função `loop()` que busca candles, calcula indicadores, atualiza chart/badges/posição/diário, e `setInterval(loop, 20000)`. Ligar eventos (símbolo, velocidade, stop, take, comprar, vender, export). Navegação: clique numa `.tab` mostra a `.tela` correspondente.

- [ ] **Step 3: Transformar `treino.html` em redirect:**
```html
<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./">
<title>Redirecionando…</title><a href="./">Abrir o app</a>
```

- [ ] **Step 4: Verificação** — abrir `/treino.html` redireciona para `/`. Trocar abas funciona. Loop atualiza preço a cada 20s. Comprar/vender/stop/take/diário OK.

- [ ] **Step 5: Commit**
```bash
git add js/app.js js/grafico.js treino.html ; git commit -m "Fase 0: app.js orquestra + treino.html vira redirect"
```

---

## Fase 1 — Gráfico: zoom/pan + marcações

### Task 1.1: Zoom e arrastar

**Files:** Modify: `js/grafico.js`

- [ ] **Step 1:** Em `criar`, configurar o chart com `handleScroll: true, handleScale: true` (remover os `false` atuais) e `kineticScroll: { touch: true }`.
- [ ] **Step 2: Verificação** — no iPhone (ou DevTools touch), a pinça aproxima e o arrastar move o histórico.
- [ ] **Step 3: Commit** `git commit -am "Fase 1: zoom e arrastar no grafico"`

### Task 1.2: Marcadores de compra/venda

**Files:** Modify: `js/grafico.js`, `js/app.js`

- [ ] **Step 1:** Implementar `marcadores(trades)` usando `candleSeries.setMarkers(...)`:
```js
marcadores(trades) {
  candleSeries.setMarkers(trades.map(t => ({
    time: Math.floor((t.ts || Date.now()) / 1000),
    position: t.side === "COMPRA" ? "belowBar" : "aboveBar",
    color: t.side === "COMPRA" ? "#22c55e" : "#ef4444",
    shape: t.side === "COMPRA" ? "arrowUp" : "arrowDown",
    text: t.side === "COMPRA" ? "comprou" : "vendeu",
  })));
}
```
- [ ] **Step 2:** Em `app.js`, após cada `loop()`/trade, chamar `grafico.marcadores(S.diario)`.
- [ ] **Step 3: Verificação** — fazer uma compra e uma venda; as setas verde/vermelha aparecem no gráfico no tempo certo.
- [ ] **Step 4: Commit** `git commit -am "Fase 1: marcadores de compra/venda no grafico"`

### Task 1.3: Linhas de stop/take e suporte/resistência

**Files:** Modify: `js/grafico.js`, `js/app.js`

- [ ] **Step 1:** Implementar `linhasStopTake(sp, tp)` e `linhasSR(s, r)` com `candleSeries.createPriceLine(...)`, guardando referências p/ remover as antigas antes de recriar (evitar acúmulo):
```js
let plStop, plTp, plS, plR;
function limpa(l){ if(l) candleSeries.removePriceLine(l); }
api.linhasStopTake = (sp, tp) => {
  limpa(plStop); limpa(plTp); plStop = plTp = null;
  if (sp) plStop = candleSeries.createPriceLine({ price: sp, color:"#ef4444", lineStyle:2, title:"stop" });
  if (tp) plTp = candleSeries.createPriceLine({ price: tp, color:"#22c55e", lineStyle:2, title:"alvo" });
};
api.linhasSR = (s, r) => {
  limpa(plS); limpa(plR);
  plS = candleSeries.createPriceLine({ price: s, color:"#3b82f6", lineStyle:1, title:"suporte" });
  plR = candleSeries.createPriceLine({ price: r, color:"#eab308", lineStyle:1, title:"resistencia" });
};
```
- [ ] **Step 2:** Em `app.js`/loop: chamar `linhasSR` com `dados.suporteResistencia(candles)` sempre; `linhasStopTake(carteira.stopPrice, carteira.tpPrice)` quando há posição (senão `linhasStopTake(0,0)`).
- [ ] **Step 3: Verificação** — com posição aberta, linhas stop(vermelha)/alvo(verde) aparecem; linhas suporte/resistência sempre visíveis e atualizam.
- [ ] **Step 4: Commit** `git commit -am "Fase 1: linhas stop/take e suporte-resistencia"`

### Task 1.4: Deploy Fase 1
- [ ] `git push origin main` ; verificar no iPhone via Pages.

---

## Fase 2 — Guardrails de disciplina

### Task 2.1: `js/guardrails.js`

**Files:** Create: `js/guardrails.js`

- [ ] **Step 1:** Implementar:
```js
export function riscoRetorno(valor, stopPct, tpPct) {
  const risco = valor * (stopPct/100), retorno = valor * (tpPct/100);
  return { risco, retorno, ratio: risco > 0 ? retorno / risco : 0 };
}
export function podeComprar(S) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  if (S.limites.dia !== hoje) { S.limites.dia = hoje; S.limites.tradesHoje = 0; }
  if (S.limites.tradesHoje >= S.config.maxTradesDia) return { ok: false, msg: "Você já operou demais hoje. Descanse 😌" };
  const restante = S.config.cooldownMin*60000 - (Date.now() - S.limites.ultimaPerdaTs);
  if (S.limites.ultimaPerdaTs && restante > 0) return { ok: false, msg: `Respire. Volte em ${Math.ceil(restante/1000)}s.` };
  return { ok: true };
}
export function avisosCompra(S, preco, valor, rsiVal) {
  const avisos = [];
  if (rsiVal > 70) avisos.push("RSI alto (>70): você pode estar comprando caro.");
  if (valor > 0.25 * (S.carteira.caixa + S.carteira.qty*preco)) avisos.push("Posição grande demais para iniciante (>25%).");
  return avisos;
}
export function registrarTrade(S) { S.limites.tradesHoje = (S.limites.tradesHoje||0) + 1; }
export function registrarPerda(S, ts) { S.limites.ultimaPerdaTs = ts; }
```

- [ ] **Step 2: Verificação** — `import` no console: `riscoRetorno(1000,5,10)` retorna ratio 2. Sem erros.
- [ ] **Step 3: Commit** `git commit -am "Fase 2: modulo guardrails"`

### Task 2.2: Integrar guardrails na aba Treinar

**Files:** Modify: `js/app.js`, `index.html`, `css/estilo.css`

- [ ] **Step 1:** Adicionar no `index.html` (controles) uma linha de risco×retorno: `<div id="rr"></div>`. Em `app.js`, ao mudar valor/stop/take, atualizar com `riscoRetorno(...)`, colorindo verde(≥2)/amarelo(1–2)/vermelho(<1).
- [ ] **Step 2:** No clique COMPRAR: chamar `podeComprar(S)`; se `!ok`, `alert(msg)` e abortar. Depois `avisosCompra(...)`: se houver, `confirm(avisos.join("\n")+"\nComprar mesmo assim?")`; se cancelar e havia aviso de RSI>70, setar `S.flags.recusouCompraCaro = true` (p/ missão m10). Se confirmar, prosseguir com `trade.comprar`, depois `registrarTrade(S)`.
- [ ] **Step 3:** Em `vender`, quando `pnl < 0`, chamar `registrarPerda(S, Date.now())`.
- [ ] **Step 4: Verificação** — risco×retorno aparece e muda de cor; comprar 10× bloqueia; após perda, cooldown bloqueia; RSI>70 pede confirmação.
- [ ] **Step 5: Commit + push** `git commit -am "Fase 2: guardrails integrados na tela Treinar" && git push`

---

## Fase 3 — Missões (curso guiado)

### Task 3.1: `js/missoes.js`

**Files:** Create: `js/missoes.js`

- [ ] **Step 1:** Definir `LISTA` e `avaliar`. Cada missão tem `objetivo(S)` puro. Helpers internos usam `S.diario`.
```js
const vendas = S => S.diario.filter(d => d.side === "VENDA");
export const LISTA = [
  { id:"m01", titulo:"O que é o RSI", ensina:"O RSI vai de 0 a 100...", objetivo:S=>S.missoes.conquistas.includes("leu_rsi"), conquista:"🏅 Aprendiz do RSI" },
  { id:"m02", titulo:"Tendência e Momentum", ensina:"Tendência é a direção geral...", objetivo:S=>S.missoes.conquistas.includes("leu_tm"), conquista:"🏅 Leitor de mercado" },
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
```

- [ ] **Step 2: Verificação** — no console, simular um diário e `avaliar(S)` marca as missões certas. Sem erros.
- [ ] **Step 3: Commit** `git commit -am "Fase 3: motor e curriculo de missoes"`

### Task 3.2: Aba Missões + faixa na Treinar + gatilhos

**Files:** Modify: `index.html`, `js/app.js`, `css/estilo.css`

- [ ] **Step 1:** Em `index.html`, tela `#tela-missoes`: lista renderizada por `app.js` (✅ concluída / 👉 atual / 🔒 bloqueada, com `titulo` e `ensina`). Botões "Entendi" nas missões m01/m02 setam `conquistas.push("leu_rsi"/"leu_tm")`.
- [ ] **Step 2:** Faixa na tela Treinar: `<div id="missaoAtual"></div>` mostra a missão atual.
- [ ] **Step 3:** Em `app.js`, após cada trade/ação e ao exportar diário (`conquistas.push("exportou")`), chamar `missoes.avaliar(S)`; se retornar novas, `toast("Missão concluída: "+m.conquista)` e re-render. Salvar estado.
- [ ] **Step 4: Verificação** — fazer o 1º trade conclui m03; ler m01 conclui m01; faixa e lista atualizam; toast aparece.
- [ ] **Step 5: Commit + push** `git commit -am "Fase 3: aba Missoes + faixa + gatilhos" && git push`

---

## Fase 4 — Progresso

### Task 4.1: `js/progresso.js`

**Files:** Create: `js/progresso.js`

- [ ] **Step 1:** Implementar estatísticas, curva, aptidão e exportar:
```js
export function estatisticas(S) {
  const vendas = S.diario.filter(d => d.side === "VENDA");
  const ganhos = vendas.filter(v=>v.pnl>0), perdas = vendas.filter(v=>v.pnl<=0);
  const soma = a => a.reduce((s,v)=>s+v.pnl,0);
  const eqs = S.diario.map(d=>d.equity); let pico=S.config.saldoInicial, dd=0;
  eqs.forEach(e=>{ pico=Math.max(pico,e); dd=Math.min(dd, e/pico-1); });
  const comStop = S.diario.filter(d=>d.side==="COMPRA");
  return {
    trades: S.diario.length, vendas: vendas.length,
    acerto: vendas.length ? (ganhos.length/vendas.length*100) : 0,
    ganhoMedio: ganhos.length ? soma(ganhos)/ganhos.length : 0,
    perdaMedio: perdas.length ? soma(perdas)/perdas.length : 0,
    fatorLucro: perdas.length && soma(perdas)!==0 ? Math.abs(soma(ganhos)/soma(perdas)) : (ganhos.length?Infinity:0),
    expectativa: vendas.length ? soma(vendas)/vendas.length : 0,
    drawdown: dd*100,
    melhor: vendas.length ? Math.max(...vendas.map(v=>v.pnl)) : 0,
    pior: vendas.length ? Math.min(...vendas.map(v=>v.pnl)) : 0,
  };
}
export function curva(S) { return S.diario.map((d,i)=>({ x:i+1, equity:d.equity })); }
export function aptidao(S) {
  const e = estatisticas(S);
  const usaStop = S.diario.filter(d=>d.side==="COMPRA").length>0; // refinar: % com stop
  const criterios = [
    { nome:"Usa stop-loss", ok: usaStop },
    { nome:"Fator de lucro ≥ 1,2", ok: e.fatorLucro>=1.2 },
    { nome:"Resultado ≥ break-even", ok: e.expectativa>=0 },
    { nome:"≥ 30 trades", ok: e.vendas>=30 },
    { nome:"Sem operar demais", ok: (S.limites.tradesHoje||0) < S.config.maxTradesDia },
  ];
  const nota = Math.round(criterios.filter(c=>c.ok).length / criterios.length * 100);
  const status = nota>=80?"Pronto pra próxima etapa":nota>=50?"Promissor":"Em treino";
  return { nota, status, criterios };
}
export function exportarTexto(S) { /* mesmo formato do export atual, lendo S.diario + estatisticas */ }
```

- [ ] **Step 2: Verificação** — console: `estatisticas(S)` bate com o diário manual. Sem erros.
- [ ] **Step 3: Commit** `git commit -am "Fase 4: modulo progresso"`

### Task 4.2: Aba Progresso (UI + curva)

**Files:** Modify: `index.html`, `js/app.js`

- [ ] **Step 1:** Tela `#tela-progresso`: cards de estatísticas, um container de curva de capital (line series do lightweight-charts a partir de `curva(S)`), o medidor de aptidão (nota + status + lista de critérios ✓/✗ + aviso "veredito real é do Claude") e o botão "Exportar diário" (usa `exportarTexto`, e seta `conquistas.push("exportou")` + `avaliar`).
- [ ] **Step 2: Verificação** — após alguns trades, estatísticas e curva aparecem; medidor calcula; export abre o texto.
- [ ] **Step 3: Commit + push** `git commit -am "Fase 4: aba Progresso" && git push`

---

## Fase 5 — Aprender + cartões nos indicadores

### Task 5.1: `js/aprender.js` + tela + cartões

**Files:** Create: `js/aprender.js`; Modify: `index.html`, `js/app.js`

- [ ] **Step 1:** `aprender.js`:
```js
export const GLOSSARIO = {
  RSI:"Velocímetro 0–100. >70 caro, <30 barato.",
  Tendência:"Direção geral do preço (alta/baixa).",
  Momentum:"Quem empurra agora: comprador ou vendedor.",
  "Stop-loss":"Saída automática se cair X% — limita a perda.",
  "Take-profit":"Saída automática se subir X% — garante o lucro.",
  "Suporte/Resistência":"Regiões onde o preço costuma parar e voltar.",
  "Risco × Retorno":"Quanto arrisca vs quanto pode ganhar (ideal ≥ 2:1).",
  Drawdown:"A maior queda do seu patrimônio no caminho.",
  Taxa:"Custo de 0,1% por operação — some rápido se operar muito.",
};
export function explicacao(ind) { return GLOSSARIO[ind] || ""; }
```
- [ ] **Step 2:** Tela `#tela-aprender`: lista do glossário + botão "Rever tutorial". Tutorial = overlay mostrado quando `!S.tutorialFeito` (4 passos simples), botão "Começar" seta `tutorialFeito=true`.
- [ ] **Step 3:** Na aba Treinar, tornar os badges RSI/Tendência/Momentum clicáveis → abrir cartão com `explicacao(...)`. Ler m01/m02 pode acontecer aqui também (botão "entendi" no cartão do RSI seta `leu_rsi`).
- [ ] **Step 4: Verificação** — glossário abre; tutorial aparece no 1º acesso e não repete; tocar no RSI mostra explicação.
- [ ] **Step 5: Commit + push** `git commit -am "Fase 5: aba Aprender, glossario, tutorial, cartoes" && git push`

---

## Fase 6 — PWA/iOS + deploy final

### Task 6.1: Ícones, manifest, polish iOS

**Files:** Create: `icons/icon-180.png`, `icons/icon-512.png`; Modify: `manifest.json`, `index.html`, `css/estilo.css`

- [ ] **Step 1:** Gerar 2 ícones PNG simples (fundo escuro + "📈"/letra). Referenciar em `manifest.json` (512) e `<link rel="apple-touch-icon" href="icons/icon-180.png">` no `index.html`.
- [ ] **Step 2:** Conferir `viewport-fit=cover` + `padding: env(safe-area-inset-*)` na `.tabbar` e no topo (notch do iPhone 14).
- [ ] **Step 3:** Garantir alvos de toque ≥44px nas abas e botões.
- [ ] **Step 4: Verificação** — instalar na tela inicial do iPhone: ícone correto, abre em tela cheia, abas não ficam atrás da barra de gestos.
- [ ] **Step 5: Commit + push** `git commit -am "Fase 6: PWA icones + safe-area iOS" && git push`

### Task 6.2: Verificação final ponta-a-ponta
- [ ] Rodar pelo iPhone: criar do zero (limpar localStorage), passar pelo tutorial, completar missões m01–m05, ver marcações no gráfico, disparar stop/take, ver progresso/curva, exportar diário. Sem erros no console. Confirmar que `/treino.html` redireciona.

---

## Self-Review (cobertura da spec)

- §4 arquitetura modular → Fase 0 (Tasks 0.1/0.2). ✓
- §5 estado → `estado.js` (Task 0.1). ✓
- §6 gráfico/zoom/marcações/guardrails → Fases 1 e 2. ✓
- §7 missões (12) → Fase 3. ✓
- §8 progresso/estatísticas/curva/aptidão → Fase 4. ✓
- §9 aprender/glossário/tutorial → Fase 5. ✓
- §10 dados/indicadores → `dados.js` (Task 0.1). ✓
- §11 iOS/PWA → Fase 6. ✓
- §12 testes manuais → seção "Abordagem de testes" + passos de Verificação. ✓
- §13 fases → 0–6 mapeadas. ✓

Consistência de nomes: `comprar/vender/checarAutoSaida/patrimonio` (trade.js), `riscoRetorno/podeComprar/avisosCompra/registrarTrade/registrarPerda` (guardrails.js), `LISTA/avaliar` (missoes.js), `estatisticas/curva/aptidao/exportarTexto` (progresso.js), `GLOSSARIO/explicacao` (aprender.js), `buscarCandles/ema/rsi/macdHist/suporteResistencia` (dados.js), `carregar/salvar/padrao` (estado.js), `criar`→`{atualizar,marcadores,linhasStopTake,linhasSR,resize}` (grafico.js). Usados de forma consistente entre tarefas. ✓
