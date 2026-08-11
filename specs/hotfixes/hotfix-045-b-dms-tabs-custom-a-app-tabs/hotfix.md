# Hotfix: dms-list-content usa nav de tabs custom en vez del componente canónico app-tabs
> id: hotfix-045-b-dms-tabs-custom-a-app-tabs
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Problema

`DmsListContentComponent` reimplementa su propio nav de tabs a mano (`<nav>` + `@for` de
`<button>` con clases condicionales para el estado activo) en vez de usar el componente
compartido `app-tabs` (`TabsComponent`, `indices/COMPONENTS.md` ✅ Estable), que ya resuelve
exactamente este patrón (underline `variant="line"`, usado por `task-list-content` y otros
organismos hermanos) e incluye compresión responsive por tiers (full/short/icon/select,
fix-127-m) que el nav custom no tiene — en un contenedor angosto, las 4 tabs de DMS
("Documentos del Alumno", "Documentos de Instructores", "Documentos de la Escuela",
"Plantillas") no tienen ningún fallback y pueden desbordar o apretarse sin gracia.

## Cambios

- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
  - Importar `TabsComponent`/`TabOption` de `@shared/components/tabs/tabs.component` y
    agregarlo a `imports`.
  - Reemplazar el `<nav>` custom por `<app-tabs [tabs]="tabs" [activeId]="activeTab()"
    variant="line" (activeIdChange)="setActiveTab($event)" />`, mismo patrón que
    `task-list-content.component.ts`.
  - Tipar `readonly tabs` como `TabOption[]` (ya compatible: `{id, label, icon}`).
