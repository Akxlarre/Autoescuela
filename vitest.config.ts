import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vitest-angular';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/test-setup.ts', '**/*.spec.ts', '**/*.skeleton.*'],
    },
  },
});
