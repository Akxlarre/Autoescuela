# fix-033-m — Ficha Técnica: "Imprimir Informe" genera documento incompleto y el botón no sigue el estilo estándar

## Contexto

El dueño reportó dos problemas con el botón "Imprimir Informe" de la Ficha
Técnica (`/app/admin/alumnos/:id`):

1. El documento generado al imprimir sale incompleto/extraño: se ve la
   tabla desktop y las tarjetas mobile superpuestas, junto con el chrome de
   la app (topbar) — no es un informe limpio.
2. El botón "Imprimir Informe" usa un estilo visual distinto al resto de
   los botones de la app (PrimeNG `p-button [text]="true"`, forma de pill),
   en vez de `.btn-secondary`/`.btn-primary` estándar del design system.

## Causa raíz

`admin-alumno-detalle.component.ts:imprimirFicha()` llama `window.print()`
directamente sobre el documento completo de la SPA. El intento de aislar la
impresión vive en `admin-ficha-tecnica.component.ts` con un bloque
`@media print` **scoped al componente** (Angular `ViewEncapsulation`), que
además tiene un bug: usa el selector `.md-hidden` (guión) para ocultar la
vista de tarjetas mobile, pero la clase real en el template es `md:hidden`
(dos puntos — clase de Tailwind). El selector nunca matchea, así que la
vista mobile NUNCA se oculta al imprimir — de ahí la superposición.
Adicionalmente, como los estilos están encapsulados al componente, no
pueden alcanzar ni ocultar el resto del shell de la app (topbar, sidebar,
otras tarjetas del bento-grid), por lo que también aparecen en el
documento impreso.

El proyecto ya tiene un patrón robusto y probado para este caso exacto:
`EpqPrintService` (`core/services/ui/epq-print.service.ts`) + función pura
`buildEpqTestHtml()` (`core/utils/epq-print.util.ts`) — arma un documento
HTML autocontenido y lo abre en una ventana nueva vía `window.open()`,
aislando completamente la impresión del resto de la SPA.

## Alcance

1. **Nuevo** `core/utils/ficha-tecnica-print.util.ts` — función pura
   `buildFichaTecnicaPrintHtml(clases, opts)` que arma el HTML autocontenido
   del informe (tabla N°/Fecha-Hora/Instructor/Kilometraje/Observaciones/
   Validación), con su `.spec.ts`.
2. **Nuevo** `core/services/ui/ficha-tecnica-print.service.ts` — mismo
   patrón que `EpqPrintService`: `window.open('', '_blank')` + escribe el
   HTML + `print()`, con su `.spec.ts`.
3. `admin-alumno-detalle.component.ts`: `imprimirFicha()` deja de llamar
   `window.print()` — inyecta el nuevo servicio y le pasa
   `facade.clasesPracticas()` + datos del alumno (nombre, matrícula).
4. `admin-ficha-tecnica.component.ts`:
   - Elimina el bloque `@media print` (roto, ya no se usa — la impresión
     ahora ocurre en un documento aislado).
   - Reemplaza `<p-button icon="pi pi-print" [text]="true" ...>` por un
     `<button class="btn-secondary">` con `<app-icon name="printer">`
     (mismo patrón que el resto de botones secundarios de la app, y
     respeta la regla de usar siempre `<app-icon>` en vez de íconos
     PrimeNG/pi-*).
   - Quita el import de `Button` (PrimeNG) si queda sin uso.
5. Sincronizar `indices/SERVICES.md` y `indices/UTILS.md` con los nuevos
   artefactos.

No se toca `route-sheet.component.ts` (usa otro patrón de impresión, con
selectores CSS ya obsoletos como `app-admin-shell`/`app-layout-shell` que
no coinciden con el selector real `app-shell` — fuera de alcance de este
fix, se deja anotado pero no se corrige aquí).

## Acceptance Criteria

- [x] AC0: Al hacer clic en "Imprimir Informe", se abre una ventana/pestaña
  nueva con SOLO el informe de Ficha Técnica (sin topbar, sidebar, ni tabla
  y tarjetas superpuestas) y se dispara el diálogo de impresión del
  navegador. Implementado vía `FichaTecnicaPrintService` (patrón
  `window.open` + documento HTML autocontenido, igual que `EpqPrintService`)
  — **pendiente de confirmación visual en vivo del dueño** (Playwright no
  disponible en este entorno).
- [x] AC1: El botón "Imprimir Informe" usa `.btn-secondary` + `<app-icon
  name="printer">`, visualmente consistente con el resto de botones
  secundarios de la app.
- [x] AC2: `buildFichaTecnicaPrintHtml()` tiene test unitario (función pura,
  sin DOM) — 8/8 tests verdes, cubre clase completada, cancelada, ausente
  justificada, lista vacía, datos de alumno y escape HTML.
- [x] AC3: `FichaTecnicaPrintService` tiene test unitario (mockeando
  `window.open`) — 2/2 tests verdes, mismo patrón que
  `epq-print.service.spec.ts`.

## Cierre

Implementado: `core/utils/ficha-tecnica-print.util.ts` (+ spec, 8/8),
`core/services/ui/ficha-tecnica-print.service.ts` (+ spec, 2/2). Botón
reemplazado por `.btn-secondary` + `<app-icon name="printer">`, import de
`Button` (PrimeNG) removido de `admin-ficha-tecnica.component.ts`. Bloque
`@media print` roto eliminado. `admin-alumno-detalle.component.ts` inyecta
el nuevo servicio en `imprimirFicha()`. `tsc --noEmit` sin errores.
`indices/SERVICES.md` y `indices/UTILS.md` sincronizados vía
`npm run indices:sync`. AC0 requiere confirmación visual del dueño en vivo
(no se puede abrir una ventana `window.open` real desde este entorno).

## Test de regresión

`core/utils/ficha-tecnica-print.util.spec.ts` (8/8) +
`core/services/ui/ficha-tecnica-print.service.spec.ts` (2/2), mismo patrón
que `epq-print.util.spec.ts` / `epq-print.service.spec.ts`.
