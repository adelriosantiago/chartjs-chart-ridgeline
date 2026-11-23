import {Chart, DatasetController} from 'chart.js';

export interface RidgelineControllerDatasetOptions {
  /** One numerical observation array for each category label. */
  data: number[][];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

export interface RidgelineChartOptions {
  /** Additional vertical overlap between adjacent ridges, from 0 to 0.95. */
  overlap?: number;
  /** Empty fraction between rows, from 0 to 0.9. */
  spacing?: number;
  /** Ridge height relative to row spacing. */
  amplitude?: number;
  /** Curve smoothing amount from 0 to 1. */
  tension?: number;
}

declare module 'chart.js' {
  interface ChartTypeRegistry {
    ridgeline: {
      chartOptions: RidgelineChartOptions;
      datasetOptions: RidgelineControllerDatasetOptions;
      defaultDataPoint: number[];
      metaExtensions: {};
      parsedDataType: number[];
      scales: 'linear' | 'category';
    };
  }
}

export declare class RidgelineController extends DatasetController {}
export declare function registerRidgeline(Chart: typeof Chart): void;
export type RidgelineChart = Chart<'ridgeline'>;
