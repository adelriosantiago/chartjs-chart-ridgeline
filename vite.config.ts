import { defineConfig } from 'vitest/config';

const fileNames: Record<string, string> = { es: 'index.js', cjs: 'index.cjs', umd: 'index.umd.js' };

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ChartRidgeline',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => fileNames[format],
    },
    rollupOptions: {
      external: ['chart.js'],
      output: { globals: { 'chart.js': 'Chart' } },
    },
  },
  test: {
    setupFiles: ['test/setup.ts'],
  },
});
