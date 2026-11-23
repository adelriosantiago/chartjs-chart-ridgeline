import {Chart, DatasetController, LineElement, PointElement} from 'chart.js';

/**
 * A small ridgeline renderer. Each data row is one ordered sample; its sorted
 * observations provide the horizontal coordinates and sample rank provides a
 * smooth, normalized ridge silhouette. No density estimate is calculated.
 */
export class RidgelineController extends DatasetController {
  static id = 'ridgeline';

  static defaults = {
    datasetElementType: 'line',
    dataElementType: 'point',
    indexAxis: 'y',
    overlap: 0.35,
    spacing: 0.15,
    amplitude: 0.8,
    backgroundColor: 'rgba(54, 162, 235, 0.45)',
    borderColor: 'rgb(54, 162, 235)',
    borderWidth: 1,
    tension: 0.35
  };

  static overrides = {
    scales: {
      x: {type: 'linear', position: 'bottom'},
      y: {type: 'category', position: 'left', offset: true}
    }
  };

  parse() {
    // The dataset is intentionally nested (one array of observations per row).
  }

  getMinMax(scale) {
    if (scale.axis !== 'x') {
      const length = (this.getDataset().data || []).length;
      return {min: 0, max: Math.max(0, length - 1)};
    }
    const values = (this.getDataset().data || []).flat().filter(Number.isFinite);
    return values.length
      ? values.reduce((range, value) => ({min: Math.min(range.min, value), max: Math.max(range.max, value)}), {min: Infinity, max: -Infinity})
      : {min: 0, max: 1};
  }

  draw() {
    const {chart, _cachedMeta: meta} = this;
    const {ctx} = chart;
    const dataset = this.getDataset();
    const x = meta.xScale || chart.scales.x;
    const y = meta.yScale || chart.scales.y;
    if (!x || !y) return;

    const options = {...chart.options, ...this.options};
    const rows = dataset.data || [];
    const labels = chart.data.labels || [];
    const area = chart.chartArea;
    const rowStep = rows.length > 1
      ? Math.abs(y.getPixelForValue(1) - y.getPixelForValue(0))
      : area.bottom - area.top;
    const spacing = Math.max(0, Math.min(0.9, Number(options.spacing) || 0));
    const overlap = Math.max(0, Math.min(0.95, Number(options.overlap) || 0));
    const amplitude = Math.max(0, Number(options.amplitude) || 0);
    const ridgeHeight = rowStep * (1 - spacing) * (0.5 + overlap * 0.3) * amplitude;
    const tension = Math.max(0, Math.min(1, Number(options.tension) || 0));

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
    ctx.clip();
    rows.forEach((row, rowIndex) => {
      if (!Array.isArray(row)) return;
      const samples = row.filter(Number.isFinite).slice().sort((a, b) => a - b);
      if (!samples.length) return;

      const baselineValue = labels[rowIndex] ?? rowIndex;
      const baseline = y.getPixelForValue(baselineValue);
      const count = samples.length;
      const points = samples.map((value, sampleIndex) => {
        const rank = count === 1 ? 0.5 : sampleIndex / (count - 1);
        // A normalized, smooth rank profile conveys the supplied sample range
        // without estimating a probability density.
        const profile = Math.sin(Math.PI * rank);
        return {x: x.getPixelForValue(value), y: baseline - profile * ridgeHeight};
      });

      ctx.beginPath();
      ctx.moveTo(points[0].x, baseline);
      ctx.lineTo(points[0].x, points[0].y);
      if (points.length === 1) {
        ctx.lineTo(points[0].x, baseline);
      } else {
        for (let i = 0; i < points.length - 1; i++) {
          const current = points[i];
          const next = points[i + 1];
          const prev = points[Math.max(0, i - 1)];
          const after = points[Math.min(points.length - 1, i + 2)];
          const factor = tension / 6;
          ctx.bezierCurveTo(
            current.x + (next.x - prev.x) * factor,
            current.y + (next.y - prev.y) * factor,
            next.x - (after.x - current.x) * factor,
            next.y - (after.y - current.y) * factor,
            next.x, next.y
          );
        }
        ctx.lineTo(points[points.length - 1].x, baseline);
      }
      ctx.closePath();
      const colors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : [];
      const borders = Array.isArray(dataset.borderColor) ? dataset.borderColor : [];
      ctx.fillStyle = colors[rowIndex % colors.length] || options.backgroundColor;
      ctx.strokeStyle = borders[rowIndex % borders.length] || options.borderColor;
      ctx.lineWidth = options.borderWidth;
      ctx.fill();
      if (options.borderWidth > 0) ctx.stroke();
    });
    ctx.restore();
  }
}

export function registerRidgeline(Chart) {
  Chart.register(RidgelineController, LineElement, PointElement);
}

Chart.register(RidgelineController, LineElement, PointElement);

export default RidgelineController;
