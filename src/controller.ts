import {
  DatasetController,
  type AnimationOptions,
  type CartesianScaleTypeRegistry,
  type CommonHoverOptions,
  type ControllerDatasetOptions,
  type LineOptions,
  type Scale,
  type ScriptableAndArrayOptions,
  type ScriptableContext,
  type Tick,
  type UpdateMode,
} from 'chart.js';
import type { RidgeElement, RidgePoint } from './element.js';

export type RidgeOptions = Pick<
  LineOptions,
  | 'backgroundColor'
  | 'borderColor'
  | 'borderWidth'
  | 'borderDash'
  | 'borderDashOffset'
  | 'borderCapStyle'
  | 'borderJoinStyle'
  | 'cubicInterpolationMode'
  | 'tension'
>;

export interface RidgelineControllerDatasetOptions
  extends ControllerDatasetOptions,
    ScriptableAndArrayOptions<RidgeOptions, ScriptableContext<'ridgeline'>>,
    ScriptableAndArrayOptions<CommonHoverOptions, ScriptableContext<'ridgeline'>>,
    AnimationOptions<'ridgeline'> {
  /** The ID of the x axis to plot this dataset on. */
  xAxisID: string;
  /** The ID of the y axis to plot this dataset on. */
  yAxisID: string;
  /**
   * Height of the tallest ridge, in units of the default `spacing` (1). At 1 the tallest
   * peaks reach the baseline above them, above 1 the ridges overlap. The y axis reserves
   * this room above every baseline.
   * @default 1.5
   */
  overlap: number;
  /**
   * Distance between two consecutive baselines, in y axis units. Increasing it moves the
   * ridges apart, reducing their overlap.
   * @default 1
   */
  spacing: number;
  /**
   * Gain applied to the height of every ridge. Below 1 the ridges are flattened within the
   * room reserved by `overlap`, above 1 they are exaggerated and the y axis grows to fit them.
   * @default 1
   */
  amplitude: number;
}

export interface RidgelineParsedData {
  /** Baseline of the ridge, in y axis units. */
  base: number;
  /** Outline of the ridge in axis units: `x` is the observation index. */
  points: RidgePoint[];
}

declare module 'chart.js' {
  interface ChartTypeRegistry {
    ridgeline: {
      chartOptions: unknown;
      datasetOptions: RidgelineControllerDatasetOptions;
      defaultDataPoint: number[];
      metaExtensions: {};
      parsedDataType: RidgelineParsedData;
      scales: keyof CartesianScaleTypeRegistry;
    };
  }
}

const toNumber = (value: unknown) => (Number.isFinite(+(value as number)) ? +(value as number) : 0);

function maxValue(rows: number[][]) {
  let max = 0;
  for (const row of rows) {
    for (const value of Array.isArray(row) ? row : []) {
      max = Math.max(max, toNumber(value));
    }
  }
  return max;
}

// The y ticks sit on the ridge baselines, ordered from the bottom to the top ridge
function setRowTicks(scale: Scale) {
  const [meta] = scale.getMatchingVisibleMetas('ridgeline');
  const rows = (meta?._parsed ?? []) as RidgelineParsedData[];
  scale.ticks = rows.map(({ base }) => ({ value: base })).reverse();
}

function rowLabel(this: Scale, _value: number | string, index: number, ticks: Tick[]) {
  const label = this.chart.data.labels?.[ticks.length - 1 - index];
  return label == null ? '' : `${label}`;
}

export class RidgelineController extends DatasetController<'ridgeline', RidgeElement> {
  static id = 'ridgeline';

  static defaults = {
    datasetElementType: false,
    dataElementType: 'ridge',
    overlap: 1.5,
    spacing: 1,
    amplitude: 1,
  };

  static overrides = {
    scales: {
      x: { type: 'linear', bounds: 'data', ticks: { precision: 0 } },
      y: {
        type: 'linear',
        bounds: 'data',
        afterBuildTicks: setRowTicks,
        ticks: { autoSkip: false, callback: rowLabel },
      },
    },
  };

  declare options: RidgelineControllerDatasetOptions;

  buildOrUpdateElements(resetNewElements?: boolean) {
    // Chart.js parses the data and computes the scale ranges before refreshing the controller
    // options. Both depend on `overlap`, `spacing` and `amplitude`, so refresh them first.
    this.configure();
    super.buildOrUpdateElements(resetNewElements);
  }

  // Each data item is a ridge: an array of observations, evenly spaced along the x axis
  parse(start: number, count: number) {
    const { overlap, spacing, amplitude } = this.options;
    const rows = this.getDataset().data as unknown as number[][];
    const tallest = maxValue(rows) || 1;
    const parsed = this._cachedMeta._parsed as RidgelineParsedData[];

    for (let i = start; i < start + count; ++i) {
      // the first row is drawn at the top
      const base = (rows.length - 1 - i) * spacing;
      const values = Array.isArray(rows[i]) ? rows[i] : [];
      parsed[i] = {
        base,
        points: values.map((value, x) => ({ x, y: base + (toNumber(value) / tallest) * overlap * amplitude })),
      };
    }
  }

  protected getMinMax(scale: Scale) {
    const range = { min: Infinity, max: -Infinity };
    const extend = (value: number) => {
      range.min = Math.min(range.min, value);
      range.max = Math.max(range.max, value);
    };

    for (const { base, points } of this._cachedMeta._parsed as RidgelineParsedData[]) {
      if (scale.axis === 'y') {
        extend(base);
        extend(base + this.options.overlap);
      }
      for (const point of points) {
        extend(point[scale.axis as 'x' | 'y']);
      }
    }
    return range;
  }

  protected getLabelAndValue(index: number) {
    const label = this.chart.data.labels?.[index];
    const values = this.getDataset().data[index] as unknown;
    return { label: label == null ? '' : `${label}`, value: Array.isArray(values) ? values.join(', ') : '' };
  }

  update(mode: UpdateMode) {
    const { data } = this._cachedMeta;
    this.updateElements(data, 0, data.length, mode);
  }

  updateElements(ridges: RidgeElement[], start: number, count: number, mode: UpdateMode) {
    const { xScale, yScale } = this._cachedMeta;
    const { chartArea } = this.chart;

    for (let i = start; i < start + count; ++i) {
      const ridge = ridges[i];
      const { base, points } = this.getParsed(i);
      const outline = points.map(({ x, y }) => ({
        x: xScale!.getPixelForValue(x),
        y: yScale!.getPixelForValue(y),
      }));
      // the peak anchors the tooltip and the ridge hit detection
      const peak = outline.length ? outline.reduce((a, b) => (b.y < a.y ? b : a)) : { x: NaN, y: NaN };

      this.updateElement(
        ridge,
        i,
        {
          ...peak,
          base: yScale!.getPixelForValue(base),
          points: outline,
          options: this.resolveDataElementOptions(i, ridge.active ? 'active' : mode),
        },
        mode
      );
      ridge.updateControlPoints(chartArea, 'x');
    }
  }
}
