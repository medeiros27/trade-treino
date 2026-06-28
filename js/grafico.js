// grafico.js — lightweight-charts: candles + EMA9 + EMA21 (mesma aparência do treino.html)
export function criar(el) {
  const chart = LightweightCharts.createChart(el, {
    height: 240,
    layout: { background: { color: "transparent" }, textColor: "#8b97a7", fontSize: 10 },
    grid: { vertLines: { color: "#1b222c" }, horzLines: { color: "#1b222c" } },
    rightPriceScale: { borderColor: "#232b36" },
    timeScale: { borderColor: "#232b36", timeVisible: true },
    handleScroll: true, handleScale: true,
    kineticScroll: { touch: true },
  });
  const candleS = chart.addCandlestickSeries({
    upColor: "#22c55e", downColor: "#ef4444", borderVisible: false,
    wickUpColor: "#22c55e", wickDownColor: "#ef4444",
  });
  const ema9S = chart.addLineSeries({ color: "#3b82f6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
  const ema21S = chart.addLineSeries({ color: "#eab308", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });

  function resize() {
    chart.applyOptions({ width: el.clientWidth });
  }

  // refs das price lines (closure) — removidas antes de recriar p/ não acumular
  let plStop = null, plTp = null, plS = null, plR = null;
  function limpa(l) { if (l) candleS.removePriceLine(l); }

  const api = {
    chart, candleS,
    atualizar({ candles, ema9, ema21 }) {
      candleS.setData(candles);
      ema9S.setData(candles.map((x, i) => ema9[i] != null ? { time: x.time, value: ema9[i] } : null).filter(Boolean));
      ema21S.setData(candles.map((x, i) => ema21[i] != null ? { time: x.time, value: ema21[i] } : null).filter(Boolean));
      resize();
      chart.timeScale().fitContent();
    },
    marcadores(trades) {
      const ms = (trades || [])
        .filter(t => t.ts > 0)
        .map(t => ({
          time: Math.floor(t.ts / 1000),
          position: t.side === "COMPRA" ? "belowBar" : "aboveBar",
          color: t.side === "COMPRA" ? "#22c55e" : "#ef4444",
          shape: t.side === "COMPRA" ? "arrowUp" : "arrowDown",
          text: t.side === "COMPRA" ? "comprou" : "vendeu",
        }))
        .sort((a, b) => a.time - b.time); // ordem crescente exigida pelo lightweight-charts
      candleS.setMarkers(ms);
    },
    linhasStopTake(sp, tp) {
      limpa(plStop); limpa(plTp); plStop = plTp = null;
      if (sp) plStop = candleS.createPriceLine({ price: sp, color: "#ef4444", lineStyle: 2, title: "stop" });
      if (tp) plTp = candleS.createPriceLine({ price: tp, color: "#22c55e", lineStyle: 2, title: "alvo" });
    },
    linhasSR(s, r) {
      limpa(plS); limpa(plR); plS = plR = null;
      if (s) plS = candleS.createPriceLine({ price: s, color: "#3b82f6", lineStyle: 1, title: "suporte" });
      if (r) plR = candleS.createPriceLine({ price: r, color: "#eab308", lineStyle: 1, title: "resistencia" });
    },
    resize,
  };
  return api;
}
