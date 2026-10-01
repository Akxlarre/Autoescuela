/**
 * Fixtures compartidas de la suite (spec 0019-m). Todo test importa `test` y `expect` desde
 * aquí, no desde '@playwright/test'.
 *
 * - `pageAs(role)`  → página con la sesión de ese rol ya iniciada, en su propio BrowserContext
 *                     (dos roles en el mismo test no comparten localStorage).
 * - `watchErrors(page)` → junta errores de consola y respuestas HTTP ≥400; `expectClean()`
 *                     falla si hay alguno que no esté en KNOWN_ERRORS.
 * - `cleanup.track(table, id)` → registra un dato creado por el test; se borra al final,
 *                     pase o falle el test.
 */
import { test as base, expect, type Page } from '@playwright/test';
import { storageStatePath, type E2eRole } from './accounts';
import { isKnownError } from './known-errors';
import { getAdminClient } from './supabase-admin';

/** Prefijo obligatorio de todo dato que crea un test. */
export const E2E_PREFIX = 'E2E-';

/** Nombre único con el prefijo E2E-, para datos creados por un test. */
export function e2eName(label: string): string {
  return `${E2E_PREFIX}${label}-${Date.now()}`;
}

export interface ErrorWatch {
  /** Errores detectados hasta ahora que no están en KNOWN_ERRORS. */
  unexpected(): string[];
  expectClean(): void;
}

export function watchErrors(page: Page): ErrorWatch {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400) errors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });

  const unexpected = () => errors.filter((e) => !isKnownError(e));
  return {
    unexpected,
    expectClean: () =>
      expect(
        unexpected(),
        'Errores de consola/red no tolerados (ver e2e/support/known-errors.ts)',
      ).toEqual([]),
  };
}

export interface Cleanup {
  track(table: string, id: string | number): void;
}

interface Fixtures {
  pageAs: (role: E2eRole) => Promise<Page>;
  cleanup: Cleanup;
}

export const test = base.extend<Fixtures>({
  pageAs: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await use(async (role) => {
      const context = await browser.newContext({ storageState: storageStatePath(role) });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },

  cleanup: async ({}, use) => {
    const tracked: { table: string; id: string | number }[] = [];
    await use({ track: (table, id) => tracked.push({ table, id }) });

    // Teardown: corre también si el test falló (AC-E3). Si un borrado falla, se reporta.
    if (tracked.length === 0) return;
    const sb = await getAdminClient();
    const failures: string[] = [];
    for (const { table, id } of tracked.reverse()) {
      // .select() para saber cuántas filas se borraron: si la RLS lo impide, Supabase no
      // devuelve error, solo borra 0 filas.
      const { data, error } = await sb.from(table).delete().eq('id', id).select('id');
      if (error) failures.push(`${table}#${id}: ${error.message}`);
      else if (!data?.length) failures.push(`${table}#${id}: no se borró (RLS o ya no existía)`);
    }
    if (failures.length)
      throw new Error(`[e2e] No se pudieron limpiar datos E2E-: ${failures.join('; ')}`);
  },
});

export { expect };
