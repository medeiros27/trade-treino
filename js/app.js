// app.js — orquestra módulos, loop de atualização, eventos e navegação de abas.
import * as Estado from "./estado.js";
import * as dados from "./dados.js";
import * as trade from "./trade.js";
import * as grafico from "./grafico.js";

const $ = id => document.getElementById(id);
const fmt = (n, d = 2) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const S = Estado.carregar();
let G;                    // API do gráfico
let last = { price: 0 };  // último preço conhecido

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
      if (saida.motivo === "stop-loss") toast("🛡️ Stop-loss disparou! Saiu pra te proteger (" + fmt(saida.pnl) + " USDT)");
      else if (saida.motivo === "take-profit") toast("🎯 Take-profit! Lucro garantido: +" + fmt(saida.pnl) + " USDT 🎉");
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
  const r = trade.comprar(S, last.price, valor, stopPct, tpPct, motivo);
  if (!r.ok) { toast(r.msg || "Sem caixa suficiente"); return; }
  $("motivo").value = ""; $("amount").value = "";
  Estado.salvar(S); render();
  const c = S.carteira;
  G.marcadores(S.diario);
  G.linhasStopTake(c.qty > 0 ? c.stopPrice : 0, c.qty > 0 ? c.tpPrice : 0);
  toast("Comprou (fake) ✅ · stop " + fmt(c.stopPrice) + " · alvo " + (c.tpPrice ? fmt(c.tpPrice) : "—"));
}

function venderTudo() {
  if (S.carteira.qty <= 0) return;
  const r = trade.vender(S, last.price, "manual");
  $("motivo").value = "";
  Estado.salvar(S); render();
  G.marcadores(S.diario);
  G.linhasStopTake(S.carteira.qty > 0 ? S.carteira.stopPrice : 0, S.carteira.qty > 0 ? S.carteira.tpPrice : 0);
  if (r.ok) toast((r.pnl >= 0 ? "Lucro" : "Prejuízo") + " fake: " + fmt(r.pnl) + " USDT");
}

function exportarDiario() {
  const sells = S.diario.filter(t => t.side === "VENDA");
  const wins = sells.filter(t => t.pnl > 0).length;
  const eqs = S.diario.map(t => t.equity);
  let peak = S.config.saldoInicial, dd = 0;
  eqs.forEach(e => { peak = Math.max(peak, e); dd = Math.min(dd, e / peak - 1); });
  const eq = trade.patrimonio(S, last.price), res = eq - S.config.saldoInicial;
  const winrate = sells.length ? (wins / sells.length * 100).toFixed(0) : "-";

  let txt = `=== DIÁRIO DE TREINO (dinheiro fake) ===\n`;
  txt += `Ativo atual: ${S.mercado.symbol}\n`;
  txt += `Patrimônio: ${fmt(eq)} USDT (começou com ${S.config.saldoInicial})\n`;
  txt += `Resultado: ${res >= 0 ? '+' : ''}${fmt(res)} USDT\n`;
  txt += `Operações: ${S.diario.length} | Vendas: ${sells.length} | Acerto: ${winrate}% | Pior queda: ${(dd * 100).toFixed(1)}%\n\n`;
  txt += `--- histórico ---\n`;
  S.diario.forEach(t => {
    txt += `${t.t} | ${t.side} @ ${fmt(t.price)} | ${t.usdt ? fmt(t.usdt) + ' USDT' : ''}${t.pnl != null ? ' | resultado ' + fmt(t.pnl) : ''}${t.motivo ? ' | motivo: ' + t.motivo : ''}\n`;
  });
  $("exportText").value = txt;
  $("modal").classList.add("show");
}

// ---------- navegação de abas ----------
function trocarTela(idTela) {
  document.querySelectorAll(".tela").forEach(s => s.classList.toggle("ativa", s.id === idTela));
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("ativa", b.dataset.tela === idTela));
  if (idTela === "tela-treinar" && G) G.resize();
}

// ---------- eventos ----------
function ligarEventos() {
  document.querySelectorAll(".pct").forEach(b => b.onclick = () => {
    $("amount").value = (S.carteira.caixa * parseFloat(b.dataset.p)).toFixed(2);
  });
  $("btnBuy").onclick = comprar;
  $("btnSell").onclick = venderTudo;
  $("symbol").onchange = () => { S.mercado.symbol = $("symbol").value; Estado.salvar(S); loop(); };
  $("speed").onchange = () => { S.mercado.interval = $("speed").value; Estado.salvar(S); loop(); };
  $("stop").onchange = () => { S.carteira.stopPct = parseFloat($("stop").value) || 5; Estado.salvar(S); };
  $("tp").onchange = () => { S.carteira.tpPct = parseFloat($("tp").value) || 0; Estado.salvar(S); };
  $("export").onclick = exportarDiario;
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
  loop();
  setInterval(loop, 20000);
}

boot();
