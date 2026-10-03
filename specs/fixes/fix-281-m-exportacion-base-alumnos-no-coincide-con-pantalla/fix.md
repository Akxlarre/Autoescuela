# Fix: La exportación de la Base de Alumnos B no coincide con la pantalla (B1)
> id: fix-281-m-exportacion-base-alumnos-no-coincide-con-pantalla
> refs: ASG-i-024 (B1 de fix-264-m: casos K04, K06, K07, K09 de 024a)
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Root Cause
El botón "Exportar" de la Base de Alumnos llama a la Edge Function `export-students`, que vuelve
a consultar la BD y **re-implementa** por su cuenta cómo se arma cada fila y cómo se filtra.
Esa copia quedó desalineada con la pantalla:

- incluye alumnos con matrícula "Finalizado" y alumnos solo-Profesional (la pantalla no);
- no conoce el estado "Docs Pendientes";
- calcula el expediente con 4 documentos y el nombre viejo `foto_carnet` → siempre "Pendiente";
- busca con `includes` simple (sin ignorar tildes ni tokenizar), distinto de `matchesSearchTokens`;
- desde la Papelera exporta los activos (no recibe la vista);
- no respeta el orden elegido (spec 0020-m) y la fecha sale `aaaa-mm-dd`.

Una sola causa: el archivo se genera de una fuente distinta a la que pinta la tabla.

## ACs Afectados
Ninguno de una spec propia — corrige los casos de `024a`: K04 (mismas filas que la pantalla),
K06 (Docs Pendientes), K07 (expediente igual al de la pantalla), K09 (Papelera exporta la
Papelera). Mismo criterio que la spec `0021-m` (Ex-Alumnos): "el archivo trae lo que se ve".

## Cambio
- **Archivo:** `src/app/core/utils/alumnos-export.utils.ts` (nuevo) — arma las tablas de Excel
  y PDF a partir de las filas ya filtradas y ordenadas de la pantalla.
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
  — `requestExport` emite `{ format, rows: sortedAlumnos(), showSede }` (las filas ya son las
  de la Papelera cuando se está en la Papelera, así que no hace falta avisar la vista).
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — `exportAlumnos` genera el Excel
  en el navegador y el PDF con la Edge Function compartida `export-table-pdf` (igual que
  `ExAlumnosFacade.exportEgresados`); deja de usar `export-students`.
- **Archivos:** `features/admin/alumnos/admin-alumnos.component.ts`,
  `features/secretaria/alumnos/secretaria-alumnos.component.ts` — tipo del evento.
- **Archivo:** `e2e/alumnos-b-lista.spec.ts` — el helper `exportarExcel` lee el archivo
  descargado (antes leía la respuesta de `export-students`); K02/K04 y K09 dejan de ser
  `knownBug`.

**Queda sin uso:** la Edge Function `supabase/functions/export-students` ya no la llama nadie.
No se borra en este fix: sacarla del proyecto desplegado lo decide y lo hace Matías.

## Resultado (2026-10-02)
- `npx vitest run` de los 5 archivos tocados: 98/98 ✓.
- `npx playwright test e2e/alumnos-b-lista.spec.ts -g "K0"`: K02 · K04 y K09 ✓ (antes `knownBug`).
- Navegador (admin, todas las sedes): PDF "Base de Alumnos Clase B" con las 8 columnas de la
  tabla, expediente "Parcial · 1/2", fecha dd-mm-aaaa y "Total: 129 alumnos" = pantalla.
- `ng build` sin errores; `npm run lint:arch` 0 errores.

## Test de Regresión
- `src/app/core/utils/alumnos-export.utils.spec.ts` — filas en el mismo orden y cantidad que
  recibe, estado "Docs Pendientes", expediente "Parcial · 1/2" igual que la pantalla, fecha
  dd-mm-aaaa, saldo numérico en Excel ✓
- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.spec.ts >
  exportar emite las filas visibles en su orden` ✓
