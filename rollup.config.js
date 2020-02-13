import  resolve  from '@rollup/plugin-node-resolve';

export default {
  input: [
    'node_modules/lit-element/lit-element.js',
    'node_modules/lit-html/lit-html.js',
    'node_modules/lit-html/directives/cache.js',
    'node_modules/lit-html/directives/class-map.js',
    'node_modules/lit-html/directives/guard.js',
    'node_modules/lit-html/directives/repeat.js',
    'node_modules/lit-html/directives/style-map.js'
  ],
  output: {
    dir: 'lit',
    format: 'esm'
  },
  plugins: [resolve()]
};