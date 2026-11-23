export default {
  input: 'src/index.js',
  external: ['chart.js'],
  output: [
    {file: 'dist/chartjs-chart-ridgeline.js', format: 'es', sourcemap: true},
    {
      file: 'dist/chartjs-chart-ridgeline.umd.js',
      format: 'iife',
      name: 'RidgelinePlugin',
      exports: 'named',
      globals: {'chart.js': 'Chart'},
      sourcemap: true
    }
  ]
};
