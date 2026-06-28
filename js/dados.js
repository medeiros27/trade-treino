// dados.js — candles (Binance pública) + indicadores (EMA/RSI/MACD) + suporte/resistência
const BASE = "https://data-api.binance.vision/api/v3";

export async function buscarCandles(symbol, interval, limite = 200) {
  const r = await fetch(`${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limite}`);
  const raw = await r.json();
  return raw.map(k => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
}

// ---------- indicadores (copiados do treino.html, lógica inalterada) ----------
export function ema(v, p) {
  const o = Array(v.length).fill(null);
  const k = 2 / (p + 1);
  let pr, s = 0;
  for (let i = 0; i < v.length; i++) {
    if (i < p) { s += v[i]; if (i === p - 1) { pr = s / p; o[i] = pr; } }
    else { pr = v[i] * k + pr * (1 - k); o[i] = pr; }
  }
  return o;
}

export function rsi(v, p = 14) {
  const o = Array(v.length).fill(null);
  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) { const c = v[i] - v[i - 1]; if (c >= 0) g += c; else l -= c; }
  let ag = g / p, al = l / p;
  o[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = p + 1; i < v.length; i++) {
    const c = v[i] - v[i - 1];
    const gg = c > 0 ? c : 0, ll = c < 0 ? -c : 0;
    ag = (ag * (p - 1) + gg) / p; al = (al * (p - 1) + ll) / p;
    o[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return o;
}

export function macdHist(v) {
  const e12 = ema(v, 12), e26 = ema(v, 26);
  const line = v.map((_, i) => e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null);
  const st = line.findIndex(x => x != null);
  const sub = line.slice(st);
  const sk = 2 / 10;
  let pr, s = 0, sig = Array(sub.length).fill(null);
  for (let i = 0; i < sub.length; i++) {
    if (i < 9) { s += sub[i]; if (i === 8) { pr = s / 9; sig[i] = pr; } }
    else { pr = sub[i] * sk + pr * (1 - sk); sig[i] = pr; }
  }
  const last = line.length - 1;
  const sl = sig[sub.length - 1];
  return (line[last] != null && sl != null) ? line[last] - sl : 0;
}

export function suporteResistencia(candles, n = 50) {
  const slice = candles.slice(-n);
  return { suporte: Math.min(...slice.map(c => c.low)), resistencia: Math.max(...slice.map(c => c.high)) };
}
