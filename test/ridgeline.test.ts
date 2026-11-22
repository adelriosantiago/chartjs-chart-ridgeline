import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { Chart, Interaction, registerables, type ChartDataset } from 'chart.js';
import { afterEach, describe, expect, it } from 'vitest';
import { RidgeElement, RidgelineController } from '../src/index.js';

Chart.register(...registerables, RidgelineController, RidgeElement);

const labels = ['Group A', 'Group B', 'Group C'];
const rows = () => [
  [12, 15, 18, 22, 25, 30, 32],
  [18, 20, 23, 24, 29, 35, 38],
  [10, 12, 15, 17, 19, 21, 24],
];

const charts: Chart[] = [];

function create(dataset: Partial<ChartDataset<'ridgeline'>> = {}) {
  const canvas = createCanvas(600, 400);
  const chart = new Chart<'ridgeline'>(canvas as unknown as HTMLCanvasElement, {
    type: 'ridgeline',
    data: { labels, datasets: [{ label: 'Distribution', data: rows(), ...dataset }] },
    options: { responsive: false, animation: false },
  });
  charts.push(chart);
  return { chart, canvas };
}

const ridgesOf = (chart: Chart) => chart.getDatasetMeta(0).data as RidgeElement[];

// Height of a ridge peak above its baseline, in y axis units
const peakHeight = (chart: Chart, ridge: RidgeElement) =>
  chart.scales.y.getValueForPixel(ridge.y)! - chart.scales.y.getValueForPixel(ridge.base)!;

// Baselines in y axis units, rounded to ignore the pixel to value conversion error
const baselinesOf = (chart: Chart) =>
  ridgesOf(chart).map((ridge) => Math.round(chart.scales.y.getValueForPixel(ridge.base)! * 1e6) / 1e6);

const pixel = (canvas: Canvas, x: number, y: number) =>
  Array.from(canvas.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data);

afterEach(() => {
  charts.splice(0).forEach((chart) => chart.destroy());
});

describe('ridgeline chart', () => {
  it('draws one ridge per label with one point per observation', () => {
    const { chart } = create();
    const ridges = ridgesOf(chart);

    expect(ridges).toHaveLength(3);
    expect(ridges.every((ridge) => ridge instanceof RidgeElement)).toBe(true);
    expect(ridges.map((ridge) => ridge.points.length)).toEqual([7, 7, 7]);
  });

  it('transforms the observations with the native scales', () => {
    const { chart } = create();
    const { x, y } = chart.scales;
    const [a, b] = ridgesOf(chart);

    // observations are evenly spaced along the x axis and span the whole chart area
    a.points.forEach((point, index) => expect(point.x).toBeCloseTo(x.getPixelForValue(index)));
    expect(a.points[0].x).toBeCloseTo(chart.chartArea.left);
    expect(a.points[6].x).toBeCloseTo(chart.chartArea.right);

    // the first row is the top one, the tallest observation (38) reaches `overlap` (1.5)
    expect(a.base).toBeCloseTo(y.getPixelForValue(2));
    expect(b.base).toBeCloseTo(y.getPixelForValue(1));
    expect(b.points[6].y).toBeCloseTo(y.getPixelForValue(1 + 1.5));
    // heights are proportional to the observations
    expect(a.points[6].y).toBeCloseTo(y.getPixelForValue(2 + (32 / 38) * 1.5));
    expect(a.points[0].y).toBeCloseTo(y.getPixelForValue(2 + (12 / 38) * 1.5));
  });

  it('labels the baselines with the chart labels, first label on top', () => {
    const { chart } = create();
    const { ticks } = chart.scales.y;

    expect(ticks.map((tick) => tick.label)).toEqual(['Group C', 'Group B', 'Group A']);
    expect(ticks.map((tick) => tick.value)).toEqual([0, 1, 2]);
    ridgesOf(chart).forEach((ridge, index) => {
      expect(chart.scales.y.getPixelForValue(ticks[2 - index].value)).toBeCloseTo(ridge.base);
    });
  });

  it('configures the overlap, spacing and amplitude of the ridges', () => {
    const base = create().chart;
    const tallest = (chart: Chart) => peakHeight(chart, ridgesOf(chart)[1]);

    expect(tallest(base)).toBeCloseTo(1.5);
    expect(baselinesOf(base)).toEqual([2, 1, 0]);

    const overlap = create({ overlap: 3 }).chart;
    expect(tallest(overlap)).toBeCloseTo(3);

    const spacing = create({ spacing: 2 }).chart;
    expect(baselinesOf(spacing)).toEqual([4, 2, 0]);
    expect(tallest(spacing)).toBeCloseTo(1.5);

    // amplitude changes the height only, the rows keep their place
    const flat = create({ amplitude: 0.5 }).chart;
    expect(tallest(flat)).toBeCloseTo(0.75);
    ridgesOf(flat).forEach((ridge, index) => expect(ridge.base).toBeCloseTo(ridgesOf(base)[index].base));

    // ...unless the ridges outgrow the room of the y axis
    const tall = create({ amplitude: 2 }).chart;
    expect(tallest(tall)).toBeCloseTo(3);
    expect(tall.scales.y.max).toBeCloseTo(2 + (32 / 38) * 3);
  });

  it('colors every ridge, and the curve goes through the observations', () => {
    const colors = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)'];
    const { chart, canvas } = create({
      backgroundColor: colors,
      borderColor: ['rgb(0, 0, 0)', 'rgb(0, 0, 0)', 'rgb(0, 0, 0)'],
      borderWidth: 4,
    });
    const x = chart.chartArea.left + 4;

    ridgesOf(chart).forEach((ridge, index) => {
      const [r, g, b] = colors[index].match(/\d+/g)!.map(Number);
      expect(pixel(canvas, x, ridge.base - 4)).toEqual([r, g, b, 255]);
    });

    const [a] = ridgesOf(chart);
    const [point] = a.points.slice(3);
    expect(pixel(canvas, point.x, point.y)).toEqual([0, 0, 0, 255]);
    // nothing is drawn above the curve
    expect(pixel(canvas, point.x + 10, point.y - 20)[3]).toBe(0);
  });

  it('detects the pointer over the ridges', () => {
    const { chart } = create();
    const [a, b] = ridgesOf(chart);
    const x = chart.chartArea.left + 30;
    const at = (y: number, px = x) =>
      Interaction.modes.nearest(chart, { x: px, y, native: true } as never, { intersect: true }, false);

    expect(a.inRange(x, a.base - 5)).toBe(true);
    expect(a.inRange(x, a.points[0].y - 40)).toBe(false);
    expect(a.inRange(chart.chartArea.left - 5, a.base - 5)).toBe(false);

    expect(at(a.base - 5).map(({ index }) => index)).toEqual([0]);
    expect(at(b.base - 5).map(({ index }) => index)).toEqual([1]);
    expect(at(a.base - 5, chart.chartArea.left - 5)).toEqual([]);
  });

  it('shows the observations in the tooltip', () => {
    const { chart } = create();
    const [ridge] = ridgesOf(chart);

    chart.tooltip!.setActiveElements([{ datasetIndex: 0, index: 0 }], ridge.tooltipPosition(false));
    chart.update();

    expect(chart.tooltip!.title).toEqual(['Group A']);
    expect(chart.tooltip!.body[0].lines).toEqual(['Distribution: 12, 15, 18, 22, 25, 30, 32']);
  });

  it('uses the ridge style in the legend', () => {
    const { chart } = create({ backgroundColor: 'rgb(1, 2, 3)', borderColor: 'rgb(4, 5, 6)' });
    const [item] = chart.legend!.legendItems!;

    expect(item.text).toBe('Distribution');
    expect(item.fillStyle).toBe('rgb(1, 2, 3)');
    expect(item.strokeStyle).toBe('rgb(4, 5, 6)');
  });

  it('applies option changes on the first update', () => {
    const { chart } = create();
    chart.data.datasets[0].overlap = 3;
    chart.data.datasets[0].spacing = 2;
    chart.update();

    expect(peakHeight(chart, ridgesOf(chart)[1])).toBeCloseTo(3);
    expect(chart.scales.y.ticks.map((tick) => tick.value)).toEqual([0, 2, 4]);

    // options set for all the ridgeline datasets are picked up as well
    delete chart.data.datasets[0].overlap;
    chart.options.datasets = { ridgeline: { overlap: 2 } };
    chart.update();

    expect(peakHeight(chart, ridgesOf(chart)[1])).toBeCloseTo(2);
  });

  it('follows data changes', () => {
    const { chart } = create();
    chart.data.labels!.push('Group D');
    chart.data.datasets[0].data.push([1, 2, 3]);
    chart.update();

    const ridges = ridgesOf(chart);
    expect(ridges).toHaveLength(4);
    expect(baselinesOf(chart)).toEqual([3, 2, 1, 0]);
    expect(chart.scales.y.ticks.map((tick) => tick.label)).toEqual(['Group D', 'Group C', 'Group B', 'Group A']);
    expect(ridges[3].points).toHaveLength(3);

    chart.hide(0);
    expect(() => chart.update()).not.toThrow();
  });

  it('copes with empty rows and non finite observations', () => {
    const { chart } = create({ data: [[1, NaN, 3], [], [null as unknown as number, 2]] });
    const [a, b, c] = ridgesOf(chart);

    expect(a.points.map((point) => Number.isFinite(point.y))).toEqual([true, true, true]);
    expect(a.points[1].y).toBeCloseTo(a.base);
    expect(b.points).toHaveLength(0);
    expect(b.inRange(chart.chartArea.left + 10, b.base - 5)).toBe(false);
    expect(c.points[0].y).toBeCloseTo(c.base);
  });

  it('is typed as a regular chart type', () => {
    const chart = new Chart(createCanvas(300, 200) as unknown as HTMLCanvasElement, {
      type: 'ridgeline',
      data: { labels, datasets: [{ data: rows(), overlap: 2, spacing: 1, amplitude: 1, backgroundColor: ['red'] }] },
      options: {
        responsive: false,
        animation: false,
        scales: { x: { title: { display: true, text: 'Observation' } } },
      },
    });
    charts.push(chart);

    const overlap: number | undefined = chart.data.datasets[0].overlap;
    expect(overlap).toBe(2);

    // @ts-expect-error `overlap` is a number
    const invalid: ChartDataset<'ridgeline'> = { data: [[1, 2]], overlap: 'high' };
    expect(invalid.data).toEqual([[1, 2]]);
  });
});
