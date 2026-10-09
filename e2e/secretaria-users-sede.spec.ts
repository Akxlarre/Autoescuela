/**
 * AC5 de la spec 0049-b: con la RLS de `users` acotada por sede, ninguna pantalla de la secretaria
 * pierde filas ni nombres. Se recorren sus pantallas principales y, por cada respuesta REST, se
 * cuentan filas y objetos `users` embebidos que llegan en null.
 *
 * Uso: correr con PHASE=antes (política vieja) y PHASE=despues (aplicada); cada corrida escribe
 * test-results/0049-b-<PHASE>.json y la de "despues" la compara con "antes".
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200. Solo lectura.
 */
import { expect, test } from './support/fixtures';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

test.describe.configure({ timeout: 240_000 });

const PHASE = process.env['PHASE'] ?? 'antes';
const PANTALLAS = ['alumnos', 'agenda', 'instructores', 'pagos', 'asistencia'];

/** Cuenta objetos `users` embebidos en null (un join a users que la RLS ocultó). */
function nullUsers(v: unknown): number {
  if (Array.isArray(v)) return v.reduce((n, x) => n + nullUsers(x), 0);
  if (v && typeof v === 'object') {
    let n = 0;
    for (const [k, x] of Object.entries(v)) {
      if (/^users?$|_user$|^user_|by_user|registered_by_user/.test(k) && x === null) n++;
      n += nullUsers(x);
    }
    return n;
  }
  return 0;
}

async function recorrer(page: Page): Promise<Record<string, { filas: number; usersNull: number }>> {
  const out: Record<string, { filas: number; usersNull: number }> = {};
  page.on('response', async (r) => {
    if (!r.url().includes('/rest/v1/') || r.request().method() !== 'GET') return;
    try {
      const body = await r.json();
      const u = new URL(r.url());
      const key =
        u.pathname.replace('/rest/v1/', '') + '?' + [...u.searchParams.keys()].sort().join(',');
      const filas = Array.isArray(body) ? body.length : 1;
      const prev = out[key] ?? { filas: 0, usersNull: 0 };
      out[key] = {
        filas: Math.max(prev.filas, filas),
        usersNull: Math.max(prev.usersNull, nullUsers(body)),
      };
    } catch {
      /* respuestas sin JSON */
    }
  });
  for (const p of PANTALLAS) {
    await page.goto(`/app/secretaria/${p}`);
    await page.waitForLoadState('networkidle');
  }
  return out;
}

for (const rol of ['secretariaA', 'secretariaB'] as const) {
  test(`AC5 (${rol}): mismas filas y sin nombres perdidos en sus pantallas`, async ({ pageAs }) => {
    const page = await pageAs(rol);
    const datos = await recorrer(page);
    mkdirSync('test-results', { recursive: true });
    const file = (ph: string) => `test-results/0049-b-${ph}-${rol}.json`;
    writeFileSync(file(PHASE), JSON.stringify(datos, null, 2));

    if (PHASE === 'despues' && existsSync(file('antes'))) {
      const antes = JSON.parse(readFileSync(file('antes'), 'utf-8')) as typeof datos;
      const diferencias = Object.keys(antes)
        .filter((k) => k in datos)
        .filter(
          (k) => datos[k].filas !== antes[k].filas || datos[k].usersNull !== antes[k].usersNull,
        )
        .map((k) => `${k}: ${JSON.stringify(antes[k])} → ${JSON.stringify(datos[k])}`);
      expect(diferencias, 'consultas que cambiaron con la RLS nueva').toEqual([]);
    }
  });
}
