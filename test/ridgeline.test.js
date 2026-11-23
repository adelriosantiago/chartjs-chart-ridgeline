import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Chart, DatasetController, LineElement, PointElement} from 'chart.js';
import RidgelineController from '../src/index.js';

test('registers the ridgeline chart controller with Chart.js', () => {
  assert.ok(Chart.registry.getController('ridgeline'));
  assert.equal(RidgelineController.id, 'ridgeline');
});

test('browser bundle loads and registers with the Chart.js UMD global', () => {
  const bundle = readFileSync(new URL('../dist/chartjs-chart-ridgeline.umd.js', import.meta.url), 'utf8');
  const browserChartGlobal = Object.assign(Chart, {Chart, DatasetController, LineElement, PointElement});
  const scope = {Chart: browserChartGlobal};
  vm.runInNewContext(bundle, scope);
  assert.equal(typeof scope.RidgelinePlugin.RidgelineController, 'function');
  assert.ok(Chart.registry.getController('ridgeline'));
});

test('exposes native linear and category scales and configurable ridge options', () => {
  const defaults = RidgelineController.defaults;
  assert.equal(RidgelineController.overrides.scales.x.type, 'linear');
  assert.equal(RidgelineController.overrides.scales.y.type, 'category');
  assert.equal(defaults.overlap, 0.35);
  assert.equal(defaults.spacing, 0.15);
  assert.equal(defaults.amplitude, 0.8);
});

test('draws each observation row as a filled, smoothed ridge', () => {
  const calls = [];
  const ctx = new Proxy({}, {get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true});
  const chart = {
    ctx,
    chartArea: {left: 0, right: 100, top: 0, bottom: 100},
    data: {labels: ['A', 'B']},
    scales: {
      x: {axis: 'x', getPixelForValue: value => value},
      y: {axis: 'y', getPixelForValue: value => value === 'A' ? 30 : 70}
    }
  };
  const controller = {
    ctx,
    chart,
    index: 0,
    options: {...RidgelineController.defaults, backgroundColor: ['red', 'blue']},
    _cachedMeta: {xScale: chart.scales.x, yScale: chart.scales.y},
    getDataset: () => ({data: [[1, 4, 9], [2, 5, 8]]})
  };

  RidgelineController.prototype.draw.call(controller);

  assert.equal(calls.filter(([name]) => name === 'fill').length, 2);
  assert.equal(calls.filter(([name]) => name === 'bezierCurveTo').length, 4);
});

test('uses observation values for the native x scale range', () => {
  const controller = {getDataset: () => ({data: [[12, 30], [18, 38]]})};
  assert.deepEqual(RidgelineController.prototype.getMinMax.call(controller, {axis: 'x'}), {min: 12, max: 38});
});
