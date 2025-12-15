import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import preserveShebang from 'rollup-plugin-preserve-shebang'

export default [
  // Main library bundle - ESM format
  {
    input: 'src/migrate.ts',
    output: {
      file: 'dist/migrate.js',
      format: 'es',
      sourcemap: true,
    },
    external: ['@clickhouse/client', 'node:crypto', 'node:fs/promises', 'node:path'],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationMap: true,
        declarationDir: 'dist',
        rootDir: 'src',
        exclude: ['tests/**/*', 'node_modules/**/*', 'src/cli.ts', 'src/cli-setup.ts'],
      }),
    ],
  },
  // Main library bundle - CommonJS format
  {
    input: 'src/migrate.ts',
    output: {
      file: 'dist/migrate.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external: ['@clickhouse/client', 'node:crypto', 'node:fs/promises', 'node:path'],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        rootDir: 'src',
        exclude: ['tests/**/*', 'node_modules/**/*', 'src/cli.ts', 'src/cli-setup.ts'],
      }),
    ],
  },
  // CLI bundle - ESM format with shebang
  {
    input: 'src/cli.ts',
    output: {
      file: 'dist/cli.js',
      format: 'es',
      sourcemap: true,
    },
    external: [
      '@clickhouse/client',
      'commander',
      'node:crypto',
      'node:fs',
      'node:fs/promises',
      'node:path',
      'node:url',
    ],
    plugins: [
      json(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        rootDir: 'src',
        exclude: ['tests/**/*', 'node_modules/**/*'],
      }),
      preserveShebang(),
    ],
  },
]
