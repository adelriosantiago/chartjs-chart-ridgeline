# chartjs-chart-ridgeline

A small custom chart controller for rendering smooth, filled ridgelines in Chart.js 4. Each row in `dataset.data` contains the numerical observations for the corresponding category in `labels`.

The renderer uses the native linear x scale and category y scale. It sorts each sample row and draws a smooth, normalized ridge silhouette across its observed range. It does not calculate a KDE or estimate density.

## Install

```sh
npm install chartjs-chart-ridgeline chart.js
```

## Usage

The module registers the `ridgeline` controller with `Chart.register()` when imported.

```js
import {Chart} from 'chart.js';
import 'chartjs-chart-ridgeline';

const data = {
  labels: ['Group A', 'Group B', 'Group C'],
  datasets: [{
    label: 'Distribution',
    data: [
      [12, 15, 18, 22, 25, 30, 32],
      [18, 20, 23, 24, 29, 35, 38],
      [10, 12, 15, 17, 19, 21, 24]
    ],
    backgroundColor: ['rgba(54, 162, 235, .55)', 'rgba(255, 99, 132, .55)', 'rgba(255, 206, 86, .6)'],
    borderColor: ['rgb(54, 162, 235)', 'rgb(255, 99, 132)', 'rgb(220, 165, 35)']
  }]
};

new Chart(document.getElementById('chart'), {
  type: 'ridgeline',
  data,
  options: {
    overlap: 0.4,
    spacing: 0.15,
    amplitude: 0.85,
    tension: 0.35
  }
});
```

## Options

| Option | Default | Description |
| --- | ---: | --- |
| `overlap` | `0.35` | Vertical overlap between adjacent rows (`0` to `0.95`). |
| `spacing` | `0.15` | Fraction of each row kept as a gap (`0` to `0.9`). |
| `amplitude` | `0.8` | Ridge height relative to row spacing. |
| `tension` | `0.35` | Smoothness of the curve (`0` to `1`). |

Set `backgroundColor` and `borderColor` on the dataset to a color or per-row color arrays. The x and y scales default to `linear` and `category`; supply standard Chart.js scale options to customize them.

See [examples/ridgeline.html](examples/ridgeline.html) for a runnable browser example.
Run `npm install` and `npm run build` first; the page loads the generated browser bundle and Chart.js from `node_modules`. It can then be opened directly or served from a static web server without a CDN connection.
