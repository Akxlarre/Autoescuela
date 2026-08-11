# Fix: vehicle-maintenances — feedback de impresión, acciones duplicadas y cards mobile

> id: fix-135-b-vehicle-maintenances-ui-polish
> refs: —
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause

QA visual del usuario sobre `VehicleMaintenancesComponent` (post fix-133-b/fix-134-b) encontró
4 problemas reales, todos en el mismo componente:

1. **"Hoja de Ruta" no hace nada visible al bloquear el navegador el popup.**
   `RouteSheetPrintService.printRouteSheet()` retorna `false` cuando `window.open()` es
   bloqueado, y `VehicleMaintenancesComponent` ignoraba ese retorno — cero feedback.
   **Corrección de rumbo pedida por el usuario en esta misma sesión:** un toast de "popup
   bloqueado" es un parche, no la solución — el patrón correcto ya existe en el proyecto:
   botones como "Ver Certificado" (`admin-alumno-detalle.component.ts`) abren un **drawer**
   que previsualiza el documento inline (`DmsViewerService`/`DmsViewerModalComponent`, iframe
   + botón de acción), sin depender de `window.open()` ni de que el navegador permita popups.
   "Hoja de Ruta" se migra a ese patrón: nuevo `RouteSheetDrawerComponent` (mismo mecanismo que
   `MaintenanceFormDrawerComponent` — lee `FlotaDetalleFacade.vehicle()` ya cargado, sin
   inputs propios), iframe `srcdoc` con el HTML de `buildRouteSheetHtml()` (reutilizado tal
   cual de fix-134-b) y botón "Imprimir" que dispara `contentWindow.print()` acotado al
   iframe — nunca abre una ventana nueva, cero riesgo de bloqueo. `RouteSheetPrintService`
   (el service `window.open`-based de fix-134-b) queda sin consumidores tras esta migración
   y se elimina junto a su `.spec.ts` — no dejar código muerto, mismo criterio aplicado a
   `printRouteSheet`/`printAllRouteSheets` de `flota-list-content` en fix-134-b.
2. **Botón "Registrar Servicio" duplicado.** Aparece como acción primaria del hero Y como
   botón en el header de la tabla — mismo hallazgo de la auditoría previa, ahora con pedido
   explícito de sacar el del header y dejar solo el del hero.
3. **Acción "Editar" de cada fila invisible sin hover** (`opacity-0 group-hover:opacity-100`)
   — inutilizable en touch/mobile (no hay hover). El resto de tablas hermanas (ej.
   `flota-list-content`) NO usan opacity-toggle, los botones de acción están siempre visibles
   con highlight de fondo al hover.
4. **Sin vista de cards en mobile.** La card en sí se ajusta bien (bento-fill correcto), pero
   la tabla interna (`<p-table>`) solo permite scroll horizontal en mobile — no hay
   representación responsiva real. Mismo patrón "dual-viewport" (`@container` +
   `hide-on-squeeze`/`show-on-squeeze`) ya establecido en 6 páginas hermanas
   (`flota-list-content`, `alumnos-list-content`, etc.) nunca se aplicó acá.

## ACs Afectados

Ninguno — fix autónomo de UI/UX, no cambia contrato de negocio.

## Cambio

1. **Archivo nuevo:** `src/app/features/admin/flota/route-sheet-drawer/route-sheet-drawer.component.ts`
   — drawer que previsualiza la Hoja de Ruta (iframe `srcdoc` + botón "Imprimir"), reutiliza
   `buildRouteSheetHtml()` de `core/utils/route-sheet-print.util.ts` sin modificarlo.
2. **Eliminados:** `src/app/core/services/ui/route-sheet-print.service.ts` +
   `route-sheet-print.service.spec.ts` (sin consumidores tras la migración a drawer).
3. **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
   - `handleHeroAction('imprimir-hoja')` abre `RouteSheetDrawerComponent` vía
     `layoutDrawer.open(...)` (mismo mecanismo que `openMaintenanceForm()`) en vez de llamar a
     `RouteSheetPrintService`. Se eliminan las inyecciones `routeSheetPrint`/`toast` y el método
     `printRouteSheet()` (ya no aplica — `branchFacade` se mantiene solo si sigue haciendo
     falta en otro punto del archivo, si no, también se elimina).
   - Elimina el botón "Registrar Servicio" del header de la tabla (queda solo el del hero).
   - Botón "Editar" de fila: quita `opacity-0 group-hover:opacity-100` (y el `group` del `<tr>`
     que solo servía para eso) — visible siempre, mismo patrón que `flota-list-content`.
   - Agrega vista de cards mobile (patrón dual-viewport, `@container`, breakpoint 900px):
     tabla desktop → `hide-on-squeeze`, cards mobile → `show-on-squeeze`, mismos datos que las
     columnas de la tabla. Sin paginación en cards (igual que `flota-list-content`).

## Test de Regresión

- Sin `.spec.ts` nuevo — sin `computed()` con decisión propia en el drawer más allá de la
  resolución de `branchLabel` (idéntica a la ya probada antes de la migración), y las cards
  son solo template.
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, 0 errores.
- `npm run test:ci`: suite completa verde (156 test files) tras eliminar
  `route-sheet-print.service.spec.ts` y limpiar los providers de `ToastService` que ya no
  aplican en `vehicle-maintenances.component.spec.ts` (3/3 tests igual de verdes).
- `/verify` manual en navegador (`ng serve --port 4210`), logueado como admin:
  - **Drawer "Hoja de Ruta":** invocado vía `handleHeroAction('imprimir-hoja')` (el `computer`
    tool de este entorno quedó no-funcional a mitad de sesión — clicks/teclado no llegaban al
    DOM incluso en pestañas nuevas, confirmado con listeners de `click` en 3 botones distintos
    y 2 tabs — verificación hecha invocando el método real del componente, no simulando el
    click). El drawer abre con la previsualización correcta: patente `ABCD43`, "Kia Morning",
    instructor "Juan Carlos González", sede "Autoescuela Chillán" (dato real, ya no
    hardcodeado). Botón "Imprimir" confirmado disparando `contentWindow.print()` acotado al
    iframe (interceptado y confirmado `printCalled: true`). Repetido en 390×844: drawer
    full-width legible, tabla de horas con scroll horizontal propio dentro del iframe (mismo
    comportamiento que el visor de PDF existente, `DmsViewerModalComponent`, para documentos
    de ancho fijo en pantallas angostas — no es un bug).
  - **Sin botón duplicado:** header de "Historial Cronológico" solo con "N registros", el
    único "Registrar Servicio" es el del hero.
  - **Acción "Editar" siempre visible:** `getComputedStyle(...).opacity === '1'` confirmado
    sin hover, en 1440×900 y 390×844.
  - **Cards mobile (390×844):** vista de cards renderiza correctamente (título+fecha+badge de
    estado, descripción, grid Km/Costo/Taller, acción editar) — confirmado con datos reales
    (`ABCD43`, mantención "Alineación") y con el estado vacío (`RTRE29`, 0 registros).
  - **Force-compact:** confirmado indirectamente — al abrir el drawer de Hoja de Ruta en
    1440×900, el panel izquierdo (angostado por el drawer) cambió a la vista de cards
    correctamente, validando que el breakpoint `@container` de 900px reacciona también al
    angostamiento por drawer, no solo al viewport.
  - Consola: solo el `InvalidStateError` (Transition aborted) preexistente en toda la app, sin
    errores nuevos.
