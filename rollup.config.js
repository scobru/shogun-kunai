import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-node-polyfills';

// External dependencies for Node.js builds (CJS, ESM)
const externalNode = ['gun', 'gun/sea', 'tweetnacl', 'bs58', 'bs58check', 'ripemd160', 'debug', 'crypto', 'events', 'shogun-core'];

// External dependencies for browser builds (UMD) - debug and events are bundled
const externalBrowser = ['tweetnacl', 'bs58', 'bs58check', 'shogun-core'];

// Plugins for Node.js builds
const pluginsNode = [
  resolve({
    browser: false,
    preferBuiltins: true
  }),
  commonjs(),
  json(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: './dist'
  })
];

// Plugins for browser builds (includes Node.js polyfills)
const pluginsBrowser = [
  nodePolyfills(),
  resolve({
    browser: true,
    preferBuiltins: false
  }),
  commonjs(),
  json(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: './dist'
  })
];

export default [
  // Kunai (苦無) - UMD (browser)
  {
    input: 'src/kunai.ts',
    output: {
      file: 'dist/kunai.umd.js',
      format: 'umd',
      name: 'Kunai',
      exports: 'named',
      globals: (id) => {
        const globals = {
          'tweetnacl': 'nacl',
          'bs58': 'bs58',
          'bs58check': 'bs58check',
          'shogun-core': 'ShogunCore'
        };
        if (id.includes('yumi') && id.endsWith('yumi')) {
          return 'Yumi';
        }
        return globals[id];
      }
    },
    external: (id) => {
      if (externalBrowser.includes(id)) return true;
      if (id.includes('yumi') && id.endsWith('yumi')) return true;
      return false;
    },
    plugins: pluginsBrowser
  },
  // Kunai - ESM
  {
    input: 'src/kunai.ts',
    output: {
      file: 'dist/kunai.esm.js',
      format: 'es'
    },
    external: (id) => {
      if (externalNode.includes(id)) return true;
      if (id.includes('yumi') && id.endsWith('yumi')) return true;
      return false;
    },
    plugins: pluginsNode
  },
  // Kunai - CommonJS
  {
    input: 'src/kunai.ts',
    output: {
      file: 'dist/kunai.cjs.js',
      format: 'cjs',
      exports: 'named'
    },
    external: (id) => {
      if (externalNode.includes(id)) return true;
      if (id.includes('yumi') && id.endsWith('yumi')) return true;
      return false;
    },
    plugins: pluginsNode
  },
  // Yumi (弓) - UMD (browser)
  {
    input: 'src/yumi.ts',
    output: {
      file: 'dist/yumi.umd.js',
      format: 'umd',
      name: 'Yumi',
      exports: 'named',
      globals: {
        'tweetnacl': 'nacl',
        'bs58': 'bs58',
        'bs58check': 'bs58check',
        'shogun-core': 'ShogunCore'
      }
    },
    external: externalBrowser,
    plugins: pluginsBrowser
  },
  // Yumi - ESM
  {
    input: 'src/yumi.ts',
    output: {
      file: 'dist/yumi.esm.js',
      format: 'es'
    },
    external: externalNode,
    plugins: pluginsNode
  },
  // Yumi - CommonJS
  {
    input: 'src/yumi.ts',
    output: {
      file: 'dist/yumi.cjs.js',
      format: 'cjs',
      exports: 'named'
    },
    external: externalNode,
    plugins: pluginsNode
  },
  // Yari (槍) - UMD (browser)
  {
    input: 'src/yari.ts',
    output: {
      file: 'dist/yari.umd.js',
      format: 'umd',
      name: 'Yari',
      exports: 'named',
      globals: (id) => {
        const globals = {
          'tweetnacl': 'nacl',
          'bs58': 'bs58',
          'bs58check': 'bs58check',
          'shogun-core': 'ShogunCore'
        };
        // Handle ./yumi with any path
        if (id.includes('yumi') && id.endsWith('yumi')) {
          return 'Yumi';
        }
        return globals[id];
      }
    },
    external: (id) => {
      if (externalBrowser.includes(id)) return true;
      if (id.includes('yumi') && id.endsWith('yumi')) return true;
      return false;
    },
    plugins: pluginsBrowser
  },
  // Yari - ESM
  {
    input: 'src/yari.ts',
    output: {
      file: 'dist/yari.esm.js',
      format: 'es'
    },
    external: (id) => {
      if (externalNode.includes(id)) return true;
      if (id.includes('yumi') && id.endsWith('yumi')) return true;
      return false;
    },
    plugins: pluginsNode
  },
  // Yari - CommonJS
  {
    input: 'src/yari.ts',
    output: {
      file: 'dist/yari.cjs.js',
      format: 'cjs',
      exports: 'named'
    },
    external: (id) => {
      if (externalNode.includes(id)) return true;
      if (id.includes('yumi') && id.endsWith('yumi')) return true;
      return false;
    },
    plugins: pluginsNode
  }
];

