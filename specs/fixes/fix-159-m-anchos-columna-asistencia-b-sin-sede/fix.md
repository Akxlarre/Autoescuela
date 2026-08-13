# Fix: Ancho de columnas de la tabla de Asistencia B cuando la columna Sede está oculta
> id: fix-159-m-anchos-columna-asistencia-b-sin-sede
> refs: fix-158-m-ocultar-columna-sede-asistencia-b
> status: done
> closed: 2026-08-12
> created: 2026-08-12

## Root Cause
En [fix-158-m](../fix-158-m-ocultar-columna-sede-asistencia-b/fix.md) se ocultó la columna
"Sede" con `@if (showBranchColumn())`, pero ninguna columna de la tabla tiene un ancho
explícito que absorba el espacio liberado (`<table class="w-full">` en layout `auto`, sin
`table-layout: fixed` ni una columna `w-full`/flexible declarada). Con 9 columnas el
espacio sobrante se repartía de forma casi imperceptible; con 8 columnas (sin Sede) el
navegador concentra el sobrante en la última columna sin contenido dominante, dejando un
hueco en blanco entre los botones de "Acciones" y el borde derecho de la card — en vez de
que la columna Acciones quede pegada al final como ocurre con Sede visible.

## ACs Afectados
Ninguno — fix autónomo (continuación visual de fix-158-m).

## Cambio
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - **Qué cambia:** ajustar los anchos de columna de la tabla de prácticas para que el
    espacio se redistribuya de forma determinística con y sin la columna Sede, sin dejar
    un hueco en blanco después de "Acciones".

## Test de Regresión
- Verificación visual con Playwright MCP (`/verify`): columna Acciones queda pegada al
  borde derecho de la tabla tanto con `showBranchColumn=true` como `showBranchColumn=false`.
