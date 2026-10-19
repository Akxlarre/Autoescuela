# Fix: Las fechas del DMS se muestran en UTC (un día después desde las 21:00)
> id: fix-453-m-fechas-dms-hora-chile
> refs: fix-447-m-testing-documentos-certificacion (hallazgo al verificar fix-452-m) · spec 0024-m
> status: done
> closed: 2026-10-18
> created: 2026-10-18

## Root Cause

Varios templates muestran el día de un instante (`timestamptz`) con `{{ x | slice: 0 : 10 }}`:
corta el ISO en UTC, así que después de las 20:00–21:00 hora Chile sale el día siguiente.
Visto el 2026-10-18 a las 21:xx: un documento recién subido decía "Subido el 2026-10-19". Es el
`.slice(0, 10)` que prohíbe `dates.md`, pero escrito como pipe en el template, y ARCH-27 solo
buscaba la forma `.toISOString().slice(`, por eso no lo vio.

Lugares (todos con un instante):

- `dms-list-content.component.ts` — "Últimos subidos" (`documentAt`) y documentos de la escuela
  ("Subido el …", `createdAt`).
- `dms-student-docs-drawer.component.ts` y `dms-instructor-docs-drawer.component.ts` —
  `documentAt`.
- `admin-pre-inscrito-drawer.component.ts` — `psychEvaluatedAt`.

## ACs Afectados

- `0024-m` — la fecha de negocio es el día de Chile.
- AC propio — esas 5 fechas muestran el día de Chile con el mismo formato `yyyy-MM-dd`.
- AC propio — ARCH-27 marca `| slice: 0 : 10` en un template.

## Cambio

- Los 4 componentes: `| slice: 0 : 10` → `| chileDate: 'yyyy-MM-dd'` (`ChileDatePipe` en vez de
  `SlicePipe`).
- `scripts/lib/date-discipline.js` — nuevo tipo `slice-pipe` en ARCH-27 para `.html` y
  `.component.ts`; casos en `date-discipline.test.mjs`.

## Test de regresión

- `node scripts/lib/date-discipline.test.mjs` y `npm run lint:arch` (0 violaciones ARCH-27).
- Navegador (después de las 21:00): el documento subido a las 21:xx dice "Subido el 2026-10-18".

### Resultado (2026-10-18)

- ✅ `date-discipline.test.mjs`: los 3 casos nuevos de detección fallaron antes del cambio; 0
  fallos después. Con el guardrail nuevo y sin tocar los componentes, `lint:arch` marcó
  exactamente los 5 usos (4 archivos); tras el cambio, "ARCH-27/ARCH-28: sin regresiones".
- ✅ `tsc --noEmit` limpio; tests de `features/admin/documentos`, `dms-list-content` y
  `pre-inscritos` en verde.
- ✅ Navegador a las 21:44 hora Chile: el documento subido a las 21:3x pasó de "Subido el
  2026-10-19" a "Subido el 2026-10-18".
