# Hotfix: DmsViewerService abre el visor sin botón "atrás" en el drawer
> id: hotfix-067-m-dms-viewer-drawer-sin-boton-atras
> refs: —
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Problema
Al ver un documento (ej. SOAP de un vehículo) desde un drawer padre como
`vehicle-documents-drawer`, el visor (`DmsViewerModalComponent`) reemplaza el drawer
usando `LayoutDrawerService.open()`, que limpia el historial de navegación. El usuario
solo puede cerrar todo el panel con la X, en vez de volver al drawer anterior con la
flecha "atrás" que el propio `LayoutDrawerService` ya soporta vía `push()`/`back()`.

## Cambios
- **Archivo:** `src/app/core/services/ui/dms-viewer.service.ts` — `open()` usa
  `layoutDrawer.push(...)` en vez de `layoutDrawer.open(...)` para apilar el visor sobre
  el drawer padre y habilitar `canGoBack()` / el botón de flecha atrás del header.
