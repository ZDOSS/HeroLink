import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'test/', 'scripts/', 'src/cli.ts', 'src/index.ts', 'src/schema/index.ts'],
      thresholds: {
        'src/io/**': { lines: 90, branches: 85, functions: 90 },
        'src/model/**': { lines: 90, branches: 80, functions: 90 },
        'src/schema/**': { lines: 90, branches: 90, functions: 90 },
        lines: 75,
        branches: 75,
        functions: 75,
      },
    },
  },
});
