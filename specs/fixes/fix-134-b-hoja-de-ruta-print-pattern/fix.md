# Fix: Migrar "Hoja de Ruta" al patrón util+service de imprimibles + limpiar código muerto

> id: fix-134-b-hoja-de-ruta-print-pattern
> refs: —
> status: superseded
> created: 2026-08-11

> ⚠️ **Superado por `fix-135-b` en la misma sesión.** `RouteSheetPrintService` (el service
> `window.open`-based que este track introdujo) se probó en vivo y el usuario pidió el patrón
> de drawer inline que ya usa el resto del proyecto para documentos (`DmsViewerService`, "Ver
> Certificado" en `admin-alumno-detalle.component.ts`) en vez de una pestaña nueva — evita el
> bloqueador de popups de raíz en vez de parchearlo con un toast. `RouteSheetPrintService` y su
> `.spec.ts` se eliminaron en `fix-135-b`. **Lo que SÍ sigue vigente de este track:**
> `core/utils/route-sheet-print.util.ts` (`buildRouteSheetHtml`) — la función pura se reutiliza
> sin cambios, ahora consumida por `RouteSheetDrawerComponent`. La limpieza de código muerto en
> `flota-list-content.component.ts` (outputs `printRouteSheet`/`printAllRouteSheets`) también
> sigue vigente. Ver `specs/fixes/fix-135-b-vehicle-maintenances-ui-polish/fix.md`.

## Root Cause

`RouteSheetComponent` (`/admin/flota/hoja-de-ruta/:id`) imprime renderizando una ruta Angular
completa (componente + `@media print` que esconde todo el shell de la SPA) en una pestaña nueva.
Este es exactamente el patrón que `FichaTecnicaPrintService` ya **reemplazó** una vez
(`fix-033-m`, documentado en `indices/SERVICES.md:26`): *"reemplaza el antiguo `window.print()`
directo sobre la página completa, que producía documentos incompletos por bugs de CSS scoped al
componente"*. El patrón canónico establecido (usado 2 veces: `EpqPrintService` +
`FichaTecnicaPrintService`) es `core/utils/*-print.util.ts` (función pura que arma el HTML) +
`core/services/ui/*PrintService` (aísla `window.open`+`document.write`+`print()`). Hoja de Ruta
nunca se migró a ese patrón.

**Bug adicional encontrado en el mismo componente:** la etiqueta de sede se resolvía con
`vehicle()?.branchId === 2 ? 'Sucursal' : 'Chillán Centro'` — hardcodeado para exactamente 2
sedes con esos nombres exactos, en vez de resolver contra `BranchFacade`/`branches()` como hace
`sedeLabel()` en `flota-list-content.component.ts`. Se rompe si se agrega una 3ª sede o cambian
los nombres.

**Código muerto encontrado en `flota-list-content.component.ts`:** `printRouteSheet` (por
vehículo) y `printAllRouteSheets` (masivo) son `output()` declarados pero nunca conectados —
`printRouteSheet` no se emite desde ningún botón, `printAllRouteSheets` se emite desde una rama
`if (actionId === 'print-all')` inalcanzable (ningún `heroAction` tiene ese id), y
`admin-flota.component.ts` no escucha ninguno de los dos. La única vía real a Hoja de Ruta en
toda la app es el botón dentro de `vehicle-maintenances`.

## ACs Afectados

Ninguno — fix autónomo (migración de patrón + limpieza, no cambia contrato de negocio visible
salvo la corrección del bug de sede).

## Cambio

1. **Archivo nuevo:** `src/app/core/utils/route-sheet-print.util.ts` — función pura
   `buildRouteSheetHtml(opts: RouteSheetPrintOptions)`, mismo estilo que
   `epq-print.util.ts`/`ficha-tecnica-print.util.ts` (mismo header/título/grilla de horas
   08:00–18:00/footer de observaciones que `RouteSheetComponent`, sin los hacks de
   `@media print` que escondían el shell — no aplica porque el documento es standalone).
   `branchLabel` se recibe ya resuelto (no más ternario hardcodeado).
2. **Archivo nuevo:** `src/app/core/utils/route-sheet-print.util.spec.ts`.
3. **Archivo nuevo:** `src/app/core/services/ui/route-sheet-print.service.ts` —
   `RouteSheetPrintService.printRouteSheet(opts)`, mismo patrón que `EpqPrintService`.
4. **Archivo nuevo:** `src/app/core/services/ui/route-sheet-print.service.spec.ts`.
5. **Archivo:** `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts`
   — inyecta `BranchFacade` (para resolver `branchLabel` correctamente) y
   `RouteSheetPrintService`; `handleHeroAction('imprimir-hoja')` llama al service en vez de
   `window.open(ruta)`.
6. **Eliminados:** `src/app/features/admin/flota/route-sheet/route-sheet.component.ts` (carpeta
   completa) y la ruta `hoja-de-ruta/:id` en `app.routes.ts`.
7. **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
   — eliminados los `output()` muertos `printRouteSheet`/`printAllRouteSheets` y la rama
   inalcanzable `if (actionId === 'print-all')` en `handleHeroAction()`.

## Test de Regresión

- `route-sheet-print.util.spec.ts`: 5/5 verde (11 filas de horas, datos del vehículo/
  instructor/sede, líneas en blanco cuando faltan datos, escape de HTML).
- `route-sheet-print.service.spec.ts`: 2/2 verde, mismo patrón que `epq-print.service.spec.ts`
  (popup bloqueado → `false`; escribe HTML y dispara impresión → `true`).
- `vehicle-maintenances.component.spec.ts`: 3/3 verde sin cambios (inyectar `BranchFacade` +
  `RouteSheetPrintService`, ambos `providedIn: 'root'`, no rompió el TestBed existente).
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: exit 0, 0 errores.
- `npm run indices:sync`: `COMPONENTS.md`/`SERVICES.md`/`UTILS.md`/`ROUTES.md` actualizados
  (ruta `hoja-de-ruta/:id` desaparece de `ROUTES.md`, `RouteSheetPrintService` y
  `route-sheet-print.util` aparecen en `SERVICES.md`/`UTILS.md`).
- `/verify` manual en navegador (`ng serve --port 4210`, logueado como admin), popups
  bloqueados por el entorno de automatización → verificado interceptando
  `RouteSheetPrintService.printRouteSheet` vía `ng.getComponent()` en vez de abrir la ventana
  real (mismo efecto, sin el bloqueo del navegador headless):
  - Vehículo `ABCD43` (sede "Autoescuela Chillán", `branchId` distinto de 2 en el ternario
    viejo): `{ licensePlate: 'ABCD43', vehicleLabel: 'Kia Morning', instructorName: 'Juan
    Carlos González', branchLabel: 'Autoescuela Chillán' }` — sede correcta.
  - Vehículo `RTRE29` (sede "Conductores Chillán"): `branchLabel: 'Conductores Chillán'` —
    **confirma el bug de sede hardcodeada está resuelto** (antes, con el ternario
    `branchId === 2 ? 'Sucursal' : 'Chillán Centro'`, ninguna de las 2 sedes reales del seed
    se mostraba correctamente — ni "Sucursal" ni "Chillán Centro" existen como nombres reales).
  - Consola sin errores en ninguna de las 2 páginas probadas.
