# Hotfix: Tooltip con el texto completo en los botones de acciones de la ficha del alumno
> id: hotfix-129-m-tooltip-botones-acciones-ficha-alumno
> refs: ASG-i-024
> status: done
> closed: 2026-10-02
> created: 2026-10-02

## Problema
En la columna izquierda de la ficha del alumno, los botones de acciones (Reagendar, Ver
Contrato, Generar Certificado, Inasistencias, Ficha Técnica…) cortan su texto con "…" y no hay
forma de leer el nombre completo.

## Cambios
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — `pTooltip` con la etiqueta completa en los 8 botones de acciones (Reagendar, Ver Contrato, Carnet, Generar Certificado, Inasistencias, Ficha Técnica, Consentimientos, Reagendamientos) (mismo patrón que el nombre del alumno, que ya usa `pTooltip` sobre texto truncado).
