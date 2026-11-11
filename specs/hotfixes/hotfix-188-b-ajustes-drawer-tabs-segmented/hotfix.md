# Hotfix: Tabs segmentadas en drawer Ajustes del Sistema y teclado WAI-ARIA en app-tabs
> id: hotfix-188-b-ajustes-drawer-tabs-segmented
> refs: hotfix-168-b-pestanas-ajustes-a11y, hotfix-179-b-comunicacion-tabs-segmented-hero-sync
> status: done
> closed: 2026-11-11
> created: 2026-11-11

## Problema
En `AjustesDrawerComponent` (`Mi Perfil` / `Ajustes` / `Seguridad`), la barra de pestañas usaba botones `line` armados a mano flotando sobre `bg-base` encima de la card de `app-drawer-form`, en contradicción visual con el patrón `variant="segmented"` del sistema de diseño (ej. `AdminTareasComponent`, `hotfix-179-b`). Además, `TabsComponent` no incluía navegación por teclado (`ArrowLeft`/`ArrowRight`/`Home`/`End` + `tabindex` itinerante) ni atributos opcionales `ariaLabel`/`idPrefix` para enlazar paneles sin duplicar markup.

## Cambios
- **Archivo:** `src/app/shared/components/tabs/tabs.component.ts` — Agrega soporte WAI-ARIA `tablist` (inputs opcionales `ariaLabel` e `idPrefix`, `type="button"`, `tabindex` itinerante y navegación por teclado `ArrowLeft`/`ArrowRight`/`Home`/`End` saltando tabs deshabilitadas).
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — Reemplaza las pestañas `line` custom por `<app-tabs variant="segmented" [wrap]="true" ariaLabel="Secciones de ajustes" idPrefix="ajustes">` con íconos (`user`, `settings`, `shield`), preservando la semántica `hotfix-168-b` y limpiando `onTabKeydown` duplicado.
- **Archivo:** `src/app/shared/components/tabs/tabs.component.spec.ts` y `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.spec.ts` — Tests unitarios para navegación por teclado, roles y cambio de pestañas.
