# Hotfix: Las alertas del dashboard de secretaria quedan en 0 px con el aviso de refresco fallido
> id: hotfix-190-b-alertas-dashboard-secretaria-0-px
> refs: —
> status: done
> created: 2026-11-18

## Problema
En el caso B de "Alertas Importantes", el aviso de 126 px ocupa toda la celda de 255 px y la lista
queda con 0 px de alto: las alertas siguen en la página, pero no se ven.

## Cambios
- **Archivo:** `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts` — el aviso pasa a la cabecera de la celda, a su misma altura, sin quitarle alto a la lista
- **Archivo:** `src/app/features/secretaria/dashboard/secretaria-dashboard.component.spec.ts` — cubre el aviso en la cabecera
