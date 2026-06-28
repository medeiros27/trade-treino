// app.js — orquestra módulos, loop de atualização, eventos e navegação de abas.
import * as Estado from "./estado.js";
import * as dados from "./dados.js";
import * as trade from "./trade.js";
import * as grafico from "./grafico.js";
import * as guardrails from "./guardrails.js";
import * as missoes from "./missoes.js";
import * as progresso from "./progresso.js";
import * as aprender from "./aprender.js";

const $ = id => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const S = Estado.carregar();
let G;                    // API do gráfico
let last = { price: 0 };  // último preço conhecido
let curvaChart = null, curvaSerie = null; // gráfico da curva de capital (aba Progresso)

// ---------- render (espelha o treino.html, usando estrutura treino_v2) ----------
function render() {
  const c = S.carteira;
  const preco = last.price;
  const START = S.config.saldoInicial;

  $("cash").textContent = fmt(c.caixa);
  const eq = trade.patrimonio(S, preco);
  $("equity").textContent = fmt(eq);
  const res = eq - START, pct = res / START * 100;
  $("pnl").innerHTML = `<span class="${res >= 0 ? 'up' : 'down'}">${res >= 0 ? '+' : ''}${fmt(res)} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)</span>`;

  if (c.qty > 0) {
    $("posCard").style.display = "block";
    $("posQty").textContent = c.qty.toFixed(6) + " " + S.mercado.symbol.replace("USDT", "");
    const op = (preco - c.avg) * c.qty, opp = (preco / c.avg - 1) * 100;
    $("posPnl").innerHTML = `<span class="${op >= 0 ? 'up' : 'down'}">${op >= 0 ? '+' : ''}${fmt(op)} (${opp >= 0 ? '+' : ''}${opp.toFixed(1)}%)</span>`;
    $("stopInfo").innerHTML = (c.stopPrice || c.tpPrice)
      ? `entrada <b>${fmt(c.avg)}</b><br>🛡️ Stop-loss: <b>${c.stopPrice ? fmt(c.stopPrice) : '—'}</b> (sai se cair)<br>🎯 Take-profit: <b>${c.tpPrice ? fmt(c.tpPrice) : '—'}</b> (sai se subir)`
      : "";
  } else {
    $("posCard").style.display = "none";
  }

  $("btnSell").disabled = c.qty <= 0;
  $("btnBuy").disabled = c.caixa <= 1;

  const j = S.diario.slice().reverse().slice(0, 15);
  $("jcount").textContent = S.diario.length;
  $("journal").innerHTML = j.length ? j.map(t => `<div class="jrow">
    <span class="s ${t.side === 'COMPRA' ? 'up' : 'down'}">${t.side}</span>
    <span>${fmt(t.price)}</span>
    <span>${t.usdt ? fmt(t.usdt) + ' USDT' : ''} ${t.pnl != null ? `<b class="${t.pnl >= 0 ? 'up' : 'down'}">${t.pnl >= 0 ? '+' : ''}${fmt(t.pnl)}</b>` : ''}</span>
    </div>`).join("") : '<small>Nenhuma operação ainda.</small>';
}

function toast(m) {
  const t = $("toast");
  t.textContent = m;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

// ---------- missões ----------
function renderMissoes() {
  const el = $("listaMissoes");
  if (!el) return;
  el.innerHTML = missoes.LISTA.map(m => {
    const feita = S.missoes.concluidas.includes(m.id);
    const atual = m.id === S.missoes.atual;
    const cls = feita ? "feita" : atual ? "atual" : "bloq";
    const ico = feita ? "✅" : atual ? "👉" : "🔒";
    const mostraBtn = (m.id === "m01" || m.id === "m02") && !feita && atual;
    const btn = mostraBtn ? `<button class="btn-entendi" data-missao="${m.id}">Entendi 👍</button>` : "";
    return `<div class="missao-item ${cls}">
      <span class="ico">${ico}</span>
      <div class="corpo">
        <div class="tit">${m.titulo}</div>
        <div class="ens">${m.ensina}</div>
        ${btn}
      </div>
    </div>`;
  }).join("");
}

function renderFaixa() {
  const el = $("missaoAtual");
  if (!el) return;
  if (S.missoes.atual === "fim") {
    el.textContent = "🏆 Você concluiu todas as missões!";
    return;
  }
  const m = missoes.LISTA.find(x => x.id === S.missoes.atual);
  el.textContent = m ? `👉 Missão: ${m.titulo}` : "";
}

function checarMissoes() {
  const novas = missoes.avaliar(S);
  novas.forEach(nova => toast("✅ Missão concluída: " + nova.conquista));
  renderMissoes();
  renderFaixa();
  Estado.salvar(S);
}

// ---------- progresso ----------
function renderProgresso() {
  const e = progresso.estatisticas(S);
  const fl = e.fatorLucro;
  const flTxt = (!isFinite(fl) || fl === 0) ? "—" : fmt(fl, 2);
  const sinal = n => (n >= 0 ? "+" : "") + fmt(n);

  const est = $("estatisticas");
  if (est) {
    const stat = (l, v, cls = "") => `<div class="stat"><div class="l">${l}</div><div class="v${cls ? ' ' + cls : ''}">${v}</div></div>`;
    est.innerHTML = [
      stat("Acerto", e.vendas ? e.acerto.toFixed(0) + "%" : "—"),
      stat("Ganho médio", e.ganhoMedio ? sinal(e.ganhoMedio) : "—", e.ganhoMedio > 0 ? "up" : ""),
      stat("Perda média", e.perdaMedio ? sinal(e.perdaMedio) : "—", e.perdaMedio < 0 ? "down" : ""),
      stat("Fator de lucro", flTxt),
      stat("Pior queda", e.vendas || e.trades ? e.drawdown.toFixed(1) + "%" : "—", e.drawdown < 0 ? "down" : ""),
      stat("Melhor", e.vendas ? sinal(e.melhor) : "—", e.melhor > 0 ? "up" : ""),
      stat("Pior", e.vendas ? sinal(e.pior) : "—", e.pior < 0 ? "down" : ""),
    ].join("");
  }

  const apEl = $("aptidao");
  if (apEl) {
    const a = progresso.aptidao(S);
    const crit = a.criterios.map(c =>
      `<div class="criterio"><span class="mark ${c.ok ? 'ok' : 'no'}">${c.ok ? '✓' : '✗'}</span><span>${c.nome}</span></div>`
    ).join("");
    apEl.innerHTML = `<div class="aptidao-nota">${a.nota}<span style="font-size:18px;color:var(--muted)">/100</span></div>
      <div class="aptidao-status">${a.status}</div>
      ${crit}
      <div class="aviso-aptidao">Isto é automático. O veredito real é do Claude — exporte seu diário.</div>`;
  }

  const cEl = $("curvaChart");
  if (cEl && typeof LightweightCharts !== "undefined") {
    if (!curvaChart) {
      curvaChart = LightweightCharts.createChart(cEl, {
        height: 160,
        layout: { background: { color: "transparent" }, textColor: "#8b97a7", fontSize: 10 },
        grid: { vertLines: { color: "#1b222c" }, horzLines: { color: "#1b222c" } },
        rightPriceScale: { borderColor: "#232b36" },
        timeScale: { borderColor: "#232b36" },
      });
      curvaSerie = curvaChart.addLineSeries({ color: "#3b82f6", lineWidth: 2 });
    }
    curvaSerie.setData(progresso.curva(S));
    curvaChart.timeScale().fitContent();
    curvaChart.applyOptions({ width: cEl.clientWidth });
  }
}

// ---------- aprender (glossário, cartões, tutorial) ----------
let cartaoConquista = null; // conquista a creditar quando tocar "Entendi" no cartão atual

function renderGlossario() {
  const el = $("glossario");
  if (!el) return;
  el.innerHTML = Object.entries(aprender.GLOSSARIO).map(([termo, txt]) =>
    `<div class="termo"><div class="tt">${termo}</div><div class="tx">${txt}</div></div>`
  ).join("");
}

function abrirCartao(titulo, texto, conquista) {
  $("cartaoTitulo").textContent = titulo;
  $("cartaoTexto").textContent = texto;
  cartaoConquista = conquista || null;
  $("cartao").classList.add("show");
}

function fecharCartao() {
  $("cartao").classList.remove("show");
}

function cartaoEntendi() {
  if (cartaoConquista && !S.missoes.conquistas.includes(cartaoConquista)) {
    S.missoes.conquistas.push(cartaoConquista);
    checarMissoes();
  }
  fecharCartao();
}

function mostrarTutorial() {
  $("tutorialTexto").innerHTML = `<ul>
    <li>💵 É dinheiro <b>100% FAKE</b> — treine à vontade, sem risco nenhum.</li>
    <li>📊 Lá embaixo tem <b>4 abas</b>: Treinar, Missões, Progresso e Aprender.</li>
    <li>🛒 Pra operar, digite <b>quanto investir</b> e toque em Comprar ou Vender.</li>
    <li>🛡️🎯 O <b>stop</b> e o <b>alvo</b> saem sozinhos pra te proteger e garantir lucro.</li>
    <li>🎯 Siga as <b>Missões</b> — elas te ensinam um passo de cada vez.</li>
  </ul>`;
  $("tutorial").classList.add("show");
}

// ---------- risco × retorno (guardrails) ----------
function atualizarRR() {
  const valor = parseFloat($("amount").value) || 0;
  const stopPct = parseFloat($("stop").value) || 5;
  const tpPct = parseFloat($("tp").value) || 0;
  const el = $("rr");
  if (!el) return;
  if (valor <= 0) {
    el.textContent = "Digite o valor pra ver risco × retorno";
    el.style.color = "var(--muted)";
    return;
  }
  const { risco, retorno, ratio } = guardrails.riscoRetorno(valor, stopPct, tpPct);
  el.textContent = `Você arrisca R$ ${fmt(risco)} pra ganhar R$ ${fmt(retorno)} — proporção ${ratio.toFixed(1)}:1`;
  el.style.color = ratio >= 2 ? "#22c55e" : ratio >= 1 ? "#eab308" : "#ef4444";
}

// registra perda no guardrail (cooldown) quando o resultado é negativo
function registrarSePerda(pnl) {
  if (pnl < 0) { guardrails.registrarPerda(S, Date.now()); Estado.salvar(S); }
}

// ---------- loop de atualização ----------
async function loop() {
  try {
    const candles = await dados.buscarCandles(S.mercado.symbol, S.mercado.interval, 200);
    const closes = candles.map(x => x.close);
    const e9 = dados.ema(closes, 9), e21 = dados.ema(closes, 21);
    const rs = dados.rsi(closes, 14), mh = dados.macdHist(closes);
    last.price = closes[closes.length - 1];

    G.atualizar({ candles, ema9: e9, ema21: e21 });

    const sr = dados.suporteResistencia(candles);
    G.linhasSR(sr.suporte, sr.resistencia);
    const c = S.carteira;
    G.linhasStopTake(c.qty > 0 ? c.stopPrice : 0, c.qty > 0 ? c.tpPrice : 0);
    G.marcadores(S.diario);

    const rv = rs[rs.length - 1];
    last.rsi = rv;
    $("price").textContent = fmt(last.price);
    $("rsiTxt").textContent = "RSI " + rv.toFixed(0);
    // badge RSI
    let rstate = "neutro", rcls = "neu";
    if (rv > 70) { rstate = "esticado ↑"; rcls = "down"; }
    else if (rv < 30) { rstate = "barato ↓"; rcls = "up"; }
    $("bRsi").innerHTML = `<span class="${rcls}">${rv.toFixed(0)} · ${rstate}</span>`;
    // tendência
    const up = last.price > e21[e21.length - 1];
    $("bTrend").innerHTML = up ? `<span class="up">Alta</span>` : `<span class="down">Baixa</span>`;
    // momentum
    $("bMacd").innerHTML = mh >= 0 ? `<span class="up">Comprador</span>` : `<span class="down">Vendedor</span>`;

    // auto-saída (stop/take)
    const saida = trade.checarAutoSaida(S, last.price);
    if (saida && saida.ok) {
      registrarSePerda(saida.pnl);
      if (saida.motivo === "stop-loss") toast("🛡️ Stop-loss disparou! Saiu pra te proteger (" + fmt(saida.pnl) + " USDT)");
      else if (saida.motivo === "take-profit") toast("🎯 Take-profit! Lucro garantido: +" + fmt(saida.pnl) + " USDT 🎉");
      checarMissoes();
    }

    render();
    Estado.salvar(S);
  } catch (e) {
    $("rsiTxt").textContent = "erro ao atualizar";
  }
}

// ---------- ações ----------
function comprar() {
  if (!last.price) { toast("Aguarde o preço carregar"); return; }
  const valor = parseFloat($("amount").value) || 0;
  const stopPct = parseFloat($("stop").value) || 5;
  const tpPct = parseFloat($("tp").value) || 0;
  const motivo = $("motivo").value || "";

  const pode = guardrails.podeComprar(S);
  if (!pode.ok) { Estado.salvar(S); toast(pode.msg); return; }

  const avisos = guardrails.avisosCompra(S, last.price, valor, last.rsi || 0);
  if (avisos.length) {
    if (!confirm(avisos.join("\n") + "\n\nComprar mesmo assim?")) {
      if (last.rsi > 70) { S.flags.recusouCompraCaro = true; Estado.salvar(S); }
      return;
    }
  }

  const r = trade.comprar(S, last.price, valor, stopPct, tpPct, motivo);
  if (!r.ok) { toast(r.msg || "Sem caixa suficiente"); return; }
  guardrails.registrarTrade(S);
  $("motivo").value = ""; $("amount").value = "";
  Estado.salvar(S); render();
  atualizarRR();
  const c = S.carteira;
  G.marcadores(S.diario);
  G.linhasStopTake(c.qty > 0 ? c.stopPrice : 0, c.qty > 0 ? c.tpPrice : 0);
  toast("Comprou (fake) ✅ · stop " + fmt(c.stopPrice) + " · alvo " + (c.tpPrice ? fmt(c.tpPrice) : "—"));
  checarMissoes();
}

function venderTudo() {
  if (S.carteira.qty <= 0) return;
  const r = trade.vender(S, last.price, "manual");
  if (r.ok) registrarSePerda(r.pnl);
  $("motivo").value = "";
  Estado.salvar(S); render();
  G.marcadores(S.diario);
  G.linhasStopTake(S.carteira.qty > 0 ? S.carteira.stopPrice : 0, S.carteira.qty > 0 ? S.carteira.tpPrice : 0);
  if (r.ok) toast((r.pnl >= 0 ? "Lucro" : "Prejuízo") + " fake: " + fmt(r.pnl) + " USDT");
  checarMissoes();
}

function exportarDiario() {
  $("exportText").value = progresso.exportarTexto(S, last.price);
  $("modal").classList.add("show");
  if (!S.missoes.conquistas.includes("exportou")) S.missoes.conquistas.push("exportou");
  checarMissoes();
}

// ---------- navegação de abas ----------
function trocarTela(idTela) {
  document.querySelectorAll(".tela").forEach(s => s.classList.toggle("ativa", s.id === idTela));
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("ativa", b.dataset.tela === idTela));
  if (idTela === "tela-treinar" && G) G.resize();
  if (idTela === "tela-missoes") renderMissoes();
  if (idTela === "tela-progresso") renderProgresso();
  if (idTela === "tela-aprender") renderGlossario();
}

// ---------- eventos ----------
function ligarEventos() {
  document.querySelectorAll(".pct").forEach(b => b.onclick = () => {
    $("amount").value = (S.carteira.caixa * parseFloat(b.dataset.p)).toFixed(2);
    atualizarRR();
  });
  ["amount", "stop", "tp"].forEach(id => $(id).addEventListener("input", atualizarRR));
  $("btnBuy").onclick = comprar;
  $("btnSell").onclick = venderTudo;
  $("symbol").onchange = () => { S.mercado.symbol = $("symbol").value; Estado.salvar(S); loop(); };
  $("speed").onchange = () => { S.mercado.interval = $("speed").value; Estado.salvar(S); loop(); };
  $("stop").onchange = () => { S.carteira.stopPct = parseFloat($("stop").value) || 5; Estado.salvar(S); };
  $("tp").onchange = () => { S.carteira.tpPct = parseFloat($("tp").value) || 0; Estado.salvar(S); };
  $("export").onclick = exportarDiario;
  $("exportProg").onclick = exportarDiario;
  $("copy").onclick = () => {
    const t = $("exportText"); t.select();
    try { navigator.clipboard.writeText(t.value); } catch (e) { document.execCommand("copy"); }
    toast("Copiado!");
  };
  $("closeModal").onclick = () => $("modal").classList.remove("show");
  $("reset").onclick = () => {
    if (confirm("Zerar todo o treino e voltar pra 10.000 USDT fake?")) {
      const base = Estado.padrao();
      Object.assign(S, base);
      Estado.salvar(S); loop(); render();
    }
  };
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => trocarTela(b.dataset.tela));

  // badges clicáveis → cartão de explicação (e completam m01/m02)
  $("bRsi").closest(".badge").onclick = () => abrirCartao("RSI", aprender.explicacao("RSI"), "leu_rsi");
  $("bTrend").closest(".badge").onclick = () => abrirCartao("Tendência", aprender.explicacao("Tendência"), "leu_tm");
  $("bMacd").closest(".badge").onclick = () => abrirCartao("Momentum", aprender.explicacao("Momentum"), "leu_tm");

  // cartão de explicação
  $("cartaoEntendi").onclick = cartaoEntendi;
  $("cartaoFechar").onclick = fecharCartao;

  // tutorial
  $("tutorialOk").onclick = () => { S.tutorialFeito = true; Estado.salvar(S); $("tutorial").classList.remove("show"); };
  $("reverTutorial").onclick = mostrarTutorial;

  // delegação: botões "Entendi" das missões m01/m02 (sobrevivem a re-render)
  const lista = $("listaMissoes");
  if (lista) lista.addEventListener("click", e => {
    const btn = e.target.closest(".btn-entendi");
    if (!btn) return;
    const id = btn.dataset.missao;
    const chave = id === "m01" ? "leu_rsi" : "leu_tm";
    if (!S.missoes.conquistas.includes(chave)) S.missoes.conquistas.push(chave);
    checarMissoes();
  });
}

// ---------- boot ----------
function boot() {
  // refletir estado nos seletores/inputs
  $("symbol").value = S.mercado.symbol;
  $("speed").value = S.mercado.interval;
  $("stop").value = S.carteira.stopPct;
  $("tp").value = S.carteira.tpPct;

  G = grafico.criar($("chart"));
  window.addEventListener("resize", () => G.resize());
  ligarEventos();
  render();
  atualizarRR();
  renderMissoes();
  renderFaixa();
  renderGlossario();
  loop();
  setInterval(loop, 20000);
  if (!S.tutorialFeito) mostrarTutorial();
}

boot();
