/**
 * Barrido de rutas del piloto (ASG-i-037 §3.B, fix-190-b).
 * Checklist: specs/testing-piloto/037-transversal-multisede-shell.md — casos B01–B29.
 *
 * Por cada ruta × rol se recorren varias "celdas" (ancho × tema) y se mide:
 *   C1 consola sin errores · C2 red sin 4xx/5xx · C3 sin scroll horizontal (documento y
 *   .shell-content) · C4 app-like en 1440 px: el documento no scrollea (se mide en .shell-content,
 *   ver indices/APP-LIKE-ROLLOUT.md) — solo en las rutas app-like.
 * C5 (legibilidad en oscuro) y C6 (375 sin cortes) se revisan en las capturas que deja cada celda
 * (`test-results/barrido/…png`), no por código.
 *
 * Por defecto 3 celdas por ruta: 375 claro, 1440 claro, 1440 oscuro. `E2E_BARRIDO_FULL=1` corre la
 * matriz completa del checklist (375/768/1440 × claro/oscuro = 6 por ruta y rol).
 *
 * ⚠️ Contra el BUILD DE PRODUCCIÓN servido en localhost:4200 (ver e2e/auth-sesion.spec.ts).
 * Las rutas de secretaria corren con secretariaB (sede 2, con Clase Profesional) para cubrir B05/B06.
 */
import { expect, test } from './support/fixtures';
import { isKnownError } from './support/known-errors';
import { getAdminClient } from './support/supabase-admin';
import type { Page } from '@playwright/test';
import type { E2eRole } from './support/accounts';

test.describe.configure({ mode: 'parallel', timeout: 240_000 });

type Theme = 'light' | 'dark';
interface Cell {
  width: number;
  theme: Theme;
}

const CELLS: Cell[] = process.env['E2E_BARRIDO_FULL']
  ? [375, 768, 1440].flatMap((width) =>
      (['light', 'dark'] as const).map((theme) => ({ width, theme })),
    )
  : [
      { width: 375, theme: 'light' },
      { width: 1440, theme: 'light' },
      { width: 1440, theme: 'dark' },
    ];

interface RouteSpec {
  id: string;
  path: string;
  /** false en las rutas que no son app-like por diseño (wizard de matrícula, maquetas): no se mide C4. */
  appLike: boolean;
  /**
   * La pantalla ocupa a propósito el canal que `.shell-content` reserva para su barra de scroll
   * (`scrollbar-gutter: stable`), para que su propia barra quede alineada con la de las demás
   * páginas: el wizard de matrícula (`secretaria-matricula.component.scss`). En C3 se le tolera
   * exactamente el ancho de ese canal; no se ve ningún scroll horizontal.
   */
  fillsScrollbarGutter?: boolean;
}

const ADMIN: RouteSpec[] = [
  { id: 'B01', path: '/app/admin/dashboard', appLike: true },
  { id: 'B02', path: '/app/admin/alumnos', appLike: true },
  { id: 'B03', path: '/app/admin/alumnos/:student', appLike: true },
  { id: 'B04', path: '/app/admin/ex-alumnos', appLike: true },
  { id: 'B05', path: '/app/admin/clase-profesional/alumnos', appLike: true },
  { id: 'B06', path: '/app/admin/clase-profesional/promociones', appLike: true },
  { id: 'B07', path: '/app/admin/libro-de-clases', appLike: true },
  { id: 'B08', path: '/app/admin/agenda', appLike: true },
  { id: 'B09', path: '/app/admin/asistencia', appLike: true },
  { id: 'B10', path: '/app/admin/matricula', appLike: false, fillsScrollbarGutter: true },
  { id: 'B11', path: '/app/admin/pagos', appLike: true },
  { id: 'B12', path: '/app/admin/contabilidad/cuadratura', appLike: true },
  { id: 'B13', path: '/app/admin/contabilidad/historial-cuadraturas', appLike: true },
  { id: 'B14', path: '/app/admin/contabilidad/reportes', appLike: true },
  { id: 'B15', path: '/app/admin/contabilidad/liquidaciones', appLike: true },
  { id: 'B16', path: '/app/admin/contabilidad/cursos', appLike: true },
  { id: 'B17', path: '/app/admin/contabilidad/anticipos', appLike: true },
  { id: 'B18', path: '/app/admin/servicios-especiales', appLike: true },
  { id: 'B19', path: '/app/admin/certificacion', appLike: true },
  { id: 'B20', path: '/app/admin/documentos', appLike: true },
  { id: 'B21', path: '/app/admin/flota', appLike: true },
  { id: 'B22', path: '/app/admin/flota/:vehicle/mantenimientos', appLike: true },
  { id: 'B23', path: '/app/admin/instructores', appLike: true },
  { id: 'B24', path: '/app/admin/secretarias', appLike: true },
  { id: 'B25', path: '/app/admin/tareas', appLike: true },
  { id: 'B26', path: '/app/admin/auditoria', appLike: true },
  { id: 'B27', path: '/app/admin/configuracion-web', appLike: true },
  { id: 'B29', path: '/app/admin/notificaciones', appLike: false },
];

const SECRETARIA: RouteSpec[] = [
  { id: 'B01', path: '/app/secretaria/dashboard', appLike: true },
  { id: 'B02', path: '/app/secretaria/alumnos', appLike: true },
  { id: 'B03', path: '/app/secretaria/alumnos/:student', appLike: true },
  { id: 'B04', path: '/app/secretaria/ex-alumnos', appLike: true },
  { id: 'B05', path: '/app/secretaria/profesional/alumnos', appLike: true },
  { id: 'B06', path: '/app/secretaria/profesional/promociones', appLike: true },
  { id: 'B07', path: '/app/secretaria/libro-de-clases', appLike: true },
  { id: 'B08', path: '/app/secretaria/agenda', appLike: true },
  { id: 'B09', path: '/app/secretaria/asistencia', appLike: true },
  { id: 'B10', path: '/app/secretaria/matricula', appLike: false, fillsScrollbarGutter: true },
  { id: 'B11', path: '/app/secretaria/pagos', appLike: true },
  { id: 'B12', path: '/app/secretaria/contabilidad/cuadratura', appLike: true },
  { id: 'B13', path: '/app/secretaria/contabilidad/historial-cuadraturas', appLike: true },
  { id: 'B14', path: '/app/secretaria/contabilidad/reportes', appLike: true },
  { id: 'B15', path: '/app/secretaria/contabilidad/liquidaciones', appLike: true },
  { id: 'B16', path: '/app/secretaria/contabilidad/cursos', appLike: true },
  { id: 'B18', path: '/app/secretaria/servicios-especiales', appLike: true },
  { id: 'B19', path: '/app/secretaria/certificados', appLike: true },
  { id: 'B20', path: '/app/secretaria/documentos', appLike: true },
  { id: 'B23', path: '/app/secretaria/instructores', appLike: true },
  { id: 'B25', path: '/app/secretaria/observaciones', appLike: true },
  { id: 'B27', path: '/app/secretaria/configuracion-web', appLike: true },
  { id: 'B29', path: '/app/secretaria/notificaciones', appLike: false },
];

/** Ids reales para las rutas con parámetro: un alumno con matrícula activa en la sede pedida y un vehículo. */
async function resolveIds(branchId: number): Promise<{ student: number; vehicle: number }> {
  const sb = await getAdminClient();
  const { data: enr } = await sb
    .from('enrollments')
    .select('student_id')
    .eq('branch_id', branchId)
    .eq('status', 'active')
    .limit(1)
    .single();
  const { data: veh } = await sb.from('vehicles').select('id').limit(1).single();
  if (!enr || !veh)
    throw new Error(`[e2e] Sin alumno activo en la sede ${branchId} o sin vehículos`);
  return { student: enr.student_id, vehicle: veh.id };
}

/** Espera a que desaparezcan los skeletons (o 15 s: una pantalla que nunca carga igual se mide). */
async function waitSettled(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.shell-content').waitFor({ timeout: 30_000 });
  await expect(page.locator('app-skeleton-block'))
    .toHaveCount(0, { timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(500); // animación de entrada
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const shell = document.querySelector('.shell-content') as HTMLElement | null;
    return {
      docOverflowX: doc.scrollWidth - window.innerWidth,
      shellOverflowX: shell ? shell.scrollWidth - shell.clientWidth : 0,
      /** Ancho del canal reservado para la barra de scroll vertical del shell. */
      shellGutter: shell ? shell.offsetWidth - shell.clientWidth : 0,
      shellOverflowY: shell ? shell.scrollHeight - shell.clientHeight : 0,
      docOverflowY: doc.scrollHeight - doc.clientHeight,
    };
  });
}

function runSweep(role: E2eRole, routes: RouteSpec[], branchForIds: number) {
  for (const route of routes) {
    test(`${route.id} ${role} ${route.path}`, async ({ browser }, testInfo) => {
      const ids = await resolveIds(branchForIds);
      const url = route.path
        .replace(':student', String(ids.student))
        .replace(':vehicle', String(ids.vehicle));
      const failures: string[] = [];

      for (const cell of CELLS) {
        const context = await browser.newContext({
          storageState: `e2e/.auth/${role}.json`,
          viewport: { width: cell.width, height: 900 },
        });
        await context.addInitScript((theme) => {
          try {
            localStorage.setItem('app-color-mode', theme);
          } catch {
            /* sin storage: queda el tema por defecto */
          }
        }, cell.theme);
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        page.on('response', (r) => {
          if (r.status() >= 400) errors.push(`${r.status()} ${r.request().method()} ${r.url()}`);
        });

        const tag = `${cell.width}/${cell.theme === 'dark' ? 'osc' : 'cla'}`;
        try {
          await page.goto(url);
          await waitSettled(page);
          if (!page.url().endsWith(url))
            failures.push(`${tag}: terminó en ${new URL(page.url()).pathname}`);

          const m = await measure(page);
          const unexpected = errors.filter((e) => !isKnownError(e));
          if (unexpected.length)
            failures.push(`${tag} C1/C2: ${unexpected.slice(0, 3).join(' · ')}`);
          const shellTolerance = route.fillsScrollbarGutter ? m.shellGutter : 0;
          if (m.docOverflowX > 1 || m.shellOverflowX > shellTolerance + 1)
            failures.push(
              `${tag} C3: scroll horizontal (doc ${m.docOverflowX}px, shell ${m.shellOverflowX}px)`,
            );
          if (cell.width === 1440 && route.appLike && (m.shellOverflowY > 1 || m.docOverflowY > 1))
            failures.push(
              `${tag} C4: no app-like (shell ${m.shellOverflowY}px, doc ${m.docOverflowY}px de más)`,
            );

          const shot = testInfo.outputPath(`${route.id}-${role}-${cell.width}-${cell.theme}.png`);
          await page.screenshot({ path: shot });
        } catch (e) {
          failures.push(`${tag}: ${(e as Error).message.split('\n')[0]}`);
        } finally {
          await context.close();
        }
      }

      testInfo.annotations.push({ type: 'barrido', description: failures.join(' | ') || 'ok' });
      expect(failures, `${route.id} ${role} ${url}`).toEqual([]);
    });
  }
}

test.describe('Barrido admin', () => runSweep('admin', ADMIN, 1));
test.describe('Barrido secretaria (sede 2)', () => runSweep('secretariaB', SECRETARIA, 2));
