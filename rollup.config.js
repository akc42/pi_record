import  resolve  from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'node_modules/lit',
    output: {
      file: 'client/lit/lit.js',
      format: 'esm'
    },
    plugins: [resolve()]
  },
  {
  input: [
    'node_modules/lit/directives/cache.js',
    'node_modules/lit/directives/class-map.js',
    'node_modules/lit/directives/guard.js',
    'node_modules/lit/directives/repeat.js',
    'node_modules/lit/directives/style-map.js',
  ],
  output: {
    dir: 'client/lit',
    format: 'esm'
  },
  plugins: [resolve()]
}];