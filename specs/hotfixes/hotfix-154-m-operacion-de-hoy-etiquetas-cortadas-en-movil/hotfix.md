# Hotfix: "Operación de hoy" corta las etiquetas en móvil
> id: hotfix-154-m-operacion-de-hoy-etiquetas-cortadas-en-movil
> refs: fix-395-m-testing-dashboards (caso S04)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Problema
En el Dashboard ejecutivo a 375 px, la pestaña "Operación de hoy" muestra "Clases programa…",
"Canceladas / ina…", "Instructores acti…" y "Vehículos dispon…": la etiqueta tiene `truncate` y la
columna mide unos 100 px.

## Cambios
- **Archivo:** `src/app/shared/components/today-ops-strip/today-ops-strip.component.ts` — la etiqueta pasa a dos líneas en vez de cortarse

## Verificación
- [x] A 375 px las seis etiquetas se leen completas en dos líneas, sin desbordar (`scrollWidth` 375); a 1440 px quedan en una línea
