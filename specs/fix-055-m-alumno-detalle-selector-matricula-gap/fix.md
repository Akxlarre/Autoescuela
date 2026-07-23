# Fix: Espaciado roto en el selector de matrícula (alumnos con 2+ matrículas)
> id: fix-055-m-alumno-detalle-selector-matricula-gap
> refs: —
> status: done
> closed: 2026-07-23
> created: 2026-07-23

## Root Cause

En `admin-alumno-detalle.component.ts`, el selector de matrícula (tabs pill "Profesional A2" / "Clase B", visible solo si `facade.enrollmentSummaries().length > 1`) es un `<div class="col-span-full ...">` hijo directo del `.bento-grid`, sin ningún override de fila.

El componente ya tiene un override documentado (`.bento-grid { grid-template-rows: auto; }`, línea ~806) que hace que la **primera** fila (el hero) sea `auto` en vez de heredar `grid-auto-rows: minmax(120px, auto)` de la clase base `.bento-grid`. Pero ese override solo define la fila 1 — cuando el selector de matrícula existe, pasa a ocupar la fila 2, que vuelve a caer en el `grid-auto-rows: minmax(120px, auto)` de la base. El grupo de pills mide ~44px de alto real, así que la fila queda forzada a 120px, dejando ~76px de espacio vacío debajo de las pills antes de que empiece la fila 3 (las cards de contenido) — el "mucho espacio" que se ve en la captura.

Adicionalmente, el wrapper interno `<div class="p-1.5 w-full md:w-auto">` alrededor de `<app-tabs>` agrega 6px de padding propio en las 4 direcciones, redundante con el `gap` del bento-grid — eso explica el segundo síntoma (gap hero→selector levemente mayor al canónico).

En alumnos con una sola matrícula, el bloque `@if` completo no se renderiza, así que la fila 2 pasa a ser directamente la primera card de contenido (fila auto real, sin el problema), de ahí la diferencia visual entre ambas capturas.

## ACs Afectados

- Ninguno — fix autónomo (bug de layout detectado en QA manual, sin spec previa).

## Cambio

- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`
- **Qué cambia:**
  1. Agregar `[class.has-enrollment-selector]="facade.enrollmentSummaries().length > 1"` al `.bento-grid` raíz (mismo patrón que `[class.force-compact]` ya existente).
  2. Nueva regla CSS `.bento-grid.has-enrollment-selector { grid-template-rows: auto auto; }` (mayor especificidad que `.bento-grid { grid-template-rows: auto; }`, no requiere `!important`) — extiende el "auto" ya aplicado a la fila del header también a la fila del selector, sin tocar `grid-auto-rows` de las filas de contenido siguientes.
  3. Quitar el `p-1.5` redundante del wrapper de `<app-tabs>`, dejando solo `w-full md:w-auto`.

## Test de Regresión

- Verificación visual manual (no hay `.spec.ts` de layout CSS en este proyecto): abrir la ficha de un alumno con 2 matrículas activas (ej. Benjamind Rebolledod) y confirmar que el gap hero→selector y selector→cards es igual al gap canónico del bento-grid, sin espacio vacío extra debajo de las pills. ✓ Verificado 2026-07-23 por el usuario: "quedó perfecto".
