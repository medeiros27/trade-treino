// grafico.js — lightweight-charts: candles + EMA9 + EMA21 (mesma aparência do treino.html)
export function criar(el) {
  const chart = LightweightCharts.createChart(el, {
    height: 240,
    layout: { background: { color: "transparent" }, textColor: "#8b97a7", fontSize: 10 },
    grid: { vertLines: { color: "#1b222c" }, horzLines: { color: "#1b222c" } },
    rightPriceScale: { borderColor: "#232b36" },
    timeScale: { borderColor: "#232b36", timeVisible: true },
    handleScroll: false, handleScale: false,
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

  const api = {
    chart, candleS,
    atualizar({ candles, ema9, ema21 }) {
      candleS.setData(candles);
      ema9S.setData(candles.map((x, i) => ema9[i] != null ? { time: x.time, value: ema9[i] } : null).filter(Boolean));
      ema21S.setData(candles.map((x, i) => ema21[i] != null ? { time: x.time, value: ema21[i] } : null).filter(Boolean));
      resize();
      chart.timeScale().fitContent();
    },
    // Stubs — preenchidos na Fase 1
    marcadores(_trades) {},
    linhasStopTake(_sp, _tp) {},
    linhasSR(_s, _r) {},
    resize,
  };
  return api;
}
