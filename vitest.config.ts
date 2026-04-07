import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/app/core'),
      '@shared': resolve(__dirname, 'src/app/shared'),
      '@features': resolve(__dirname, 'src/app/features'),
      '@layout': resolve(__dirname, 'src/app/layout'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    pool: 'threads',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    // Component template tests need @analogjs/vite-plugin-angular which breaks TestBed for
    // facade/service tests. Excluded until a dual-config solution is implemented.
    exclude: [
      'src/app/shared/components/icon/icon.component.spec.ts',
      'src/app/shared/components/alert-card/alert-card.component.spec.ts',
      'src/app/shared/components/empty-state/empty-state.component.spec.ts',
      'src/app/shared/components/kpi-card/kpi-card.component.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/test-setup.ts', '**/*.spec.ts', '**/*.skeleton.*'],
    },
  },
});
