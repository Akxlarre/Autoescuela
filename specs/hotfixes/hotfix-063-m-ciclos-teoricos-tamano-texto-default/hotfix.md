# Hotfix: Ciclos Teóricos — tamaño de texto default
> id: hotfix-063-m-ciclos-teoricos-tamano-texto-default
> refs: —
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema
En la tab "Ciclos Teóricos" de Asistencia B, el header "Alumnos del ciclo" y el nombre del alumno en el roster quedaron sin clase de tamaño de texto, heredando el tamaño base (más grande) en vez del `text-sm` que usa el resto del design system (confirmado contra `.item-title` y el mismo dato en el modal "Incorporar alumno" del mismo archivo, que sí usa `text-sm`).

## Cambios
- **Archivo:** `src/app/shared/components/ciclos-teoricos-content/ciclos-teoricos-content.component.ts` — header "Alumnos del ciclo" (`h2`) pasa de `font-semibold text-text-primary` a `.item-title`; nombre del alumno en el roster pasa de `text-text-primary truncate` a `text-sm text-text-primary truncate`.
