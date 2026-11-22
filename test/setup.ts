import { Path2D } from '@napi-rs/canvas';

// Chart.js caches line paths in a global `Path2D`, which only exists in browsers
Object.assign(globalThis, { Path2D });
