/** TEMPORAL (no se commitea): detalle por nodo de las violaciones de axe en las rutas del barrido. */
import { mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/fixtures';
import { getAdminClient } from './support/supabase-admin';
import { A11Y_TAGS } from './support/a11y';

test.describe.configure({ mode: 'parallel', timeout: 300_000 });

const OUT = process.env['OUT'] ?? 'a11y-out';
mkdirSync(OUT, { recursive: true });

const RUTAS: [string, string, string][] = [
  ['B01', 'admin', '/app/admin/dashboard'],
  ['B02', 'admin', '/app/admin/alumnos'],
  ['B03', 'admin', '/app/admin/alumnos/:student'],
  ['B04', 'admin', '/app/admin/ex-alumnos'],
  ['B05', 'admin', '/app/admin/clase-profesional/alumnos'],
  ['B06', 'admin', '/app/admin/clase-profesional/promociones'],
  ['B07', 'admin', '/app/admin/libro-de-clases'],
  ['B08', 'admin', '/app/admin/agenda'],
  ['B09', 'admin', '/app/admin/asistencia'],
  ['B10', 'admin', '/app/admin/matricula'],
  ['B11', 'admin', '/app/admin/pagos'],
  ['B12', 'admin', '/app/admin/contabilidad/cuadratura'],
  ['B13', 'admin', '/app/admin/contabilidad/historial-cuadraturas'],
  ['B14', 'admin', '/app/admin/contabilidad/reportes'],
  ['B15', 'admin', '/app/admin/contabilidad/liquidaciones'],
  ['B16', 'admin', '/app/admin/contabilidad/cursos'],
  ['B17', 'admin', '/app/admin/contabilidad/anticipos'],
  ['B18', 'admin', '/app/admin/servicios-especiales'],
  ['B19', 'admin', '/app/admin/certificacion'],
  ['B20', 'admin', '/app/admin/documentos'],
  ['B21', 'admin', '/app/admin/flota'],
  ['B22', 'admin', '/app/admin/flota/:vehicle/mantenimientos'],
  ['B23', 'admin', '/app/admin/instructores'],
  ['B24', 'admin', '/app/admin/secretarias'],
  ['B25', 'admin', '/app/admin/tareas'],
  ['B26', 'admin', '/app/admin/auditoria'],
  ['B27', 'admin', '/app/admin/configuracion-web'],
  ['B03', 'secretariaB', '/app/secretaria/alumnos/:student'],
  ['B05', 'secretariaB', '/app/secretaria/profesional/alumnos'],
  ['B12', 'secretariaB', '/app/secretaria/contabilidad/cuadratura'],
  ['B19', 'secretariaB', '/app/secretaria/certificados'],
  ['B25', 'secretariaB', '/app/secretaria/observaciones'],
  ['B01', 'secretariaB', '/app/secretaria/dashboard'],
  ['B27', 'secretariaB', '/app/secretaria/configuracion-web'],
];

const CELLS: [number, 'light' | 'dark'][] = [
  [375, 'light'],
  [1440, 'light'],
  [1440, 'dark'],
];

for (const [id, rol, ruta] of RUTAS) {
  test(`${id} ${rol}`, async ({ browser }) => {
    const sb = await getAdminClient();
    const branch = rol === 'admin' ? 1 : 2;
    const { data: enr } = await sb
      .from('enrollments')
      .select('student_id')
      .eq('branch_id', branch)
      .eq('status', 'active')
      .limit(1)
      .single();
    const { data: veh } = await sb.from('vehicles').select('id').limit(1).single();
    const url = ruta
      .replace(':student', String(enr!.student_id))
      .replace(':vehicle', String(veh!.id));
    const out: unknown[] = [];
    for (const [width, theme] of CELLS) {
      const ctx = await browser.newContext({
        storageState: `e2e/.auth/${rol}.json`,
        viewport: { width, height: 900 },
      });
      await ctx.addInitScript((t) => localStorage.setItem('app-color-mode', t), theme);
      const page = await ctx.newPage();
      await page.goto(url);
      await page.locator('.shell-content').waitFor({ timeout: 30_000 });
      await expect(page.locator('app-skeleton-block'))
        .toHaveCount(0, { timeout: 15_000 })
        .catch(() => undefined);
      await page.waitForTimeout(800);
      const res = await new AxeBuilder({ page }).withTags(A11Y_TAGS).analyze();
      for (const v of res.violations)
        for (const n of v.nodes) {
          const d = (n.any[0]?.data ?? {}) as Record<string, unknown>;
          out.push({
            ruta: `${id}-${rol}`,
            cell: `${width}/${theme}`,
            rule: v.id,
            target: n.target.join(' '),
            html: n.html.replace(/\s+/g, ' ').slice(0, 220),
            fg: d['fgColor'],
            bg: d['bgColor'],
            ratio: d['contrastRatio'],
            msg: (n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 200),
          });
        }
      await ctx.close();
    }
    writeFileSync(`${OUT}/${id}-${rol}.json`, JSON.stringify(out, null, 1));
  });
}
