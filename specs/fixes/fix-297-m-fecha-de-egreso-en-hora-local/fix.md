# Fix: La fecha de egreso de Ex-Alumnos se calcula en hora local
> id: fix-297-m-fecha-de-egreso-en-hora-local
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
`ExAlumnosFacade.mapRow()` saca dos datos de `enrollments.completed_at`: el año (`anio`), con
`new Date(...).getFullYear()` en hora local, y el día (`fechaEgreso`), cortando los primeros 10
caracteres del texto, que está en UTC. Para un egreso de noche los dos no coinciden: quien egresó
el 31-12-2025 a las 23:30 (02:30 UTC del 01-01-2026) aparece con el año 2025 en la columna, pero el
filtro de período lo trata como 2026: al elegir "2025" desaparece. Encontrado en la 3ª pasada de
`fix-264-m` (`024b` U07); es B37.

## ACs Afectados
- `024b` U07: un egresado del 31 de diciembre de noche muestra su año y aparece al filtrar por
  ese mismo año.

## Cambio
- **Archivo:** `src/app/core/facades/ex-alumnos.facade.ts` — `fechaEgreso` sale de `toISODate()`
  (día en hora local), igual que el año.

## Test de Regresión
- `ex-alumnos.facade.spec.ts > fecha de egreso — fix-266-m > el día y el año salen del mismo reloj (fix-297-m)` ✓
- `e2e/alumnos-b-ficha.spec.ts > tercera pasada > U07` ✓ (falló antes del arreglo: el egresado no aparecía al elegir el período 2025)
