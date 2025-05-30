import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'
import terser from '@rollup/plugin-terser'
import alias from '@rollup/plugin-alias'
import { defineConfig } from 'rollup'

const tsconfig = './tsconfig.build.json'

const sharedPlugins = [
  commonjs(),
  json(),
  alias({ entries: [{ find: 'src', replacement: 'src' }] }),
]

export default defineConfig([
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.cjs', format: 'cjs', exports: 'auto' }],
    plugins: [nodeResolve(), ...sharedPlugins, typescript({ tsconfig, declaration: true })],
    external: ['fs', 'path', 'dotenv'],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.mjs', format: 'esm' }],
    plugins: [nodeResolve(), ...sharedPlugins, typescript({ tsconfig })],
  },
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.min.js', format: 'umd', name: 'MyLibrary' },
    plugins: [nodeResolve({ browser: true }), ...sharedPlugins, typescript({ tsconfig }), terser()],
  },
])
