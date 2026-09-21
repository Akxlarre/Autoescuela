# Fix: Layout preexistente roto en tabla de deudores (Pagos): overlap Ver detalle/Saldo y desalineo en modo compacto

> id: fix-249-m-layout-deudores-overlap-desalineo
> refs: — (encontrado durante /verify de fix-248-m-filtros-tabla-pagos, preexistente, no causado por ese fix)
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Root Cause

Dos bugs visuales distintos en la tabla "Alumnos con saldo pendiente"
(`AdminPagosComponent` y `SecretariaPagosComponent`), agrupados en un mismo track por
decisión explícita del owner aunque tengan causa raíz distinta:

**Bug 1 — "Ver detalle" se superponía con el monto de "Saldo".**
Confirmado con `getBoundingClientRect()`: el div de Acciones
(`flex items-center gap-2 ... lg:justify-end`) medía 148px de ancho (el track de grid que
le tocaba), pero sus dos botones (`flex-none`, no se encogen) sumaban ~202px
(85px + gap 8px + 109px). Con `justify-end` y contenido más ancho que el contenedor, el
overflow se desborda hacia la IZQUIERDA (fuera de la propia celda) en vez de hacia la
derecha — invadiendo visualmente la celda de Saldo, vecina a la izquierda. La causa de
fondo era que la última columna del grid (`1.2fr`) nunca garantizaba un mínimo de píxeles
absolutos; al agregar más columnas en fix-248-m cada `fr` valía menos, agravando un
problema ya marginal.

**Bug 2 — Desalineo header/filas con el drawer abierto (modo `.deudores-compact`).**
`.deudores-compact .hidden.lg\\:grid` y `.deudores-compact .deudores-row` forzaban
`grid-template-columns: minmax(0, 1fr) auto auto` en el header y en cada fila por
separado. Como **cada `.deudores-row` es su propio grid container independiente** (no
hay una tabla compartida), las columnas `auto` se dimensionaban según el contenido de
ESA fila puntual: el header medía "Alumno"/"Saldo"/"Acciones" (texto corto) y cada fila
medía su propio nombre + monto + botones (mucho más ancho) — confirmado con
`getComputedStyle()`: header `234px 42.7px 66.25px` vs. fila `77.6px 63.3px 202px`.

## ACs Afectados

Ninguna spec declaró ACs de layout para esta tabla. ACs que este fix estableció:

- **AC-1 (✅):** sin drawer abierto, "Ver detalle"/"Registrar pago" no se superponen con
  el monto de "Saldo" en 1280px ni 1440px — verificado con `getBoundingClientRect()` en
  las 10 filas de la página actual (gap consistente de 16px entre Saldo y Acciones).
- **AC-2 (✅):** con el drawer abierto, header y filas quedan alineados en X para
  "Alumno"/"Saldo"/"Acciones" — verificado en admin y secretaria, en las primeras filas
  visibles de cada tabla.
- **AC-3 (✅):** sin regresión visual en modo normal ni en mobile (375px) — los cambios
  solo tocan selectores `lg:` y `.deudores-compact`, que no aplican en mobile/tablet.

## Cambio

- **Archivo:** `src/app/features/admin/pagos/admin-pagos.component.ts`
  - `.deudores-grid-cols` / `.deudores-grid-cols-sede`: última columna (Acciones) cambia
    de `1.2fr` a `minmax(210px, auto)` — garantiza el ancho mínimo real que necesitan los
    2 botones sin encogerse.
  - `.deudores-compact .hidden.lg\\:grid` / `.deudores-compact .deudores-row`: Saldo y
    Acciones pasan de `auto auto` a anchos fijos `85px 110px`, compartidos entre header
    y filas (ya no dependen del contenido de cada fila individual).
  - Se agregó la clase `deudores-acciones` al div de Acciones; en compacto
    (`.deudores-compact .deudores-acciones`) los 2 botones pasan de lado-a-lado a
    apilados (`flex-direction: column`) — el drawer deja solo ~310px de contenido, y
    apilar reduce el ancho necesario de Acciones de ~200px a ~110px, dejando espacio real
    para el nombre del alumno (antes colapsaba a 0px de ancho).
- **Archivo:** `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
  - Mismos 3 cambios, replicados 1:1 (mismo patrón de tabla, sin columna Sede).

## Test de Regresión

- `/verify` (Playwright, admin@test.com y secretaria@test.com):
  - Sin drawer, 1440px: `getBoundingClientRect()` en las 10 filas de la página → Saldo
    termina en x=1072, Acciones empieza en x=1088 → gap 16px, sin overlap, en las 10 filas.
  - Con drawer abierto (`.deudores-compact`): header y las primeras filas de cada tabla
    resuelven exactamente los mismos `x`/`right` en píxeles para las 3 columnas visibles
    (Alumno, Saldo, Acciones) — antes difería (header 234/42.7/66.25px vs. fila
    77.6/63.3/202px).
  - Alumno visible y legible en modo compacto (antes colapsaba a 0px de ancho con el
    primer intento de fix que solo igualaba anchos sin apilar los botones — corregido
    apilando Acciones).
  - Sin errores de consola en ninguna de las pruebas.
  - Mobile (375px, sin drawer): layout intacto, sin regresión (selectores `lg:`/
    `.deudores-compact` no aplican).
- `npm run test:ci` (facades + admin-pagos + secretaria-pagos): 77/77 ✓ (sin cambios de
  lógica, solo CSS/clases — cero tests nuevos necesarios).
- `npm run lint:arch`: 0 errores, 175 advertencias (baseline preexistente, sin regresión).
- `npx tsc --noEmit`: 0 errores.
