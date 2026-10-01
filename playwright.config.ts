import { defineConfig, devices } from '@playwright/test';

/**
 * Suite E2E (spec 0019-m). Guía de uso: docs/E2E-PLAYWRIGHT.md
 *
 * Corre contra la BD de desarrollo en la nube, compartida por el equipo: sin reset, sin
 * conteos absolutos, y todo dato creado lleva el prefijo E2E- y se limpia al terminar.
 */
export default defineConfig({
  testDir: 'e2e',
  // e2e/support/*.spec.ts son tests unitarios de Vitest, no de Playwright.
  testIgnore: 'support/**',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:4200',
    // Chrome instalado en el sistema: evita descargar Chromium (spec 0019-m, TD.1).
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npx ng serve',
    url: 'http://localhost:4200',
    reuseExistingServer: true, // AC-E1: si ng serve ya corre, se reutiliza
    timeout: 180_000,
  },
});
