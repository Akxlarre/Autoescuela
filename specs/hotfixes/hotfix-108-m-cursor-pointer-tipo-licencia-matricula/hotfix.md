# Hotfix: cursor-pointer faltante en cards de Tipo de Licencia (matrícula)

> id: hotfix-108-m
> refs: —
> status: done
> closed: 2026-09-21
> created: 2026-09-21

## Problema

En el paso de datos personales del wizard de matrícula, las cards "No Profesional" /
"Profesional" (selector de Tipo de Licencia) son un `<button>` clickeable pero no muestran
`cursor: pointer` al hover — a diferencia de las cards de curso específico más abajo en el
mismo componente, que sí lo tienen.

## Cambios

- **Archivo:** `src/app/shared/components/matricula-steps/personal-data/personal-data.component.html` — agrega `cursor-pointer` a la clase del `<button>` del selector de Tipo de Licencia (línea ~317).
