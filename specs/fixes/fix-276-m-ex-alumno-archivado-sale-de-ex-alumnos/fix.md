# Fix: Un ex-alumno archivado sigue en Ex-Alumnos y no aparece en la Papelera
> id: fix-276-m-ex-alumno-archivado-sale-de-ex-alumnos
> refs: fix-264-m (casos A08 / P04 / T04 de `024b` y M08 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

Archivar un alumno pone `students.status = 'archived'`. Dos listas ignoran ese estado de formas
opuestas:

1. **Ex-Alumnos** (`ExAlumnosFacade.loadEgresadosList()`) lista las matrículas `completed` sin
   mirar `students.status`: un egresado archivado sigue apareciendo.
2. **La Papelera** (`AdminAlumnosFacade.fetchAlumnosData()`) reutiliza el filtro de la lista
   activa, que descarta a los "Finalizado" porque viven en Ex-Alumnos. Un egresado archivado
   tampoco aparece ahí.

Con solo corregir el punto 1, el egresado archivado desaparecería de todas las pantallas y no se
podría restaurar.

**Decisiones del owner (Matías, 2026-10-01):** un ex-alumno archivado sale de Ex-Alumnos y solo
se ve en la Papelera; al restaurarlo vuelve a donde estaba (Ex-Alumnos si ya estaba marcado como
ex-alumno, la Base si no).

## ACs Afectados

- AC-1: un egresado archivado no aparece en Ex-Alumnos B ni cuenta en sus KPIs.
- AC-2: ese egresado aparece en la Papelera de la Base de Alumnos, con estado "Finalizado".
- AC-3: al restaurarlo desde la Papelera vuelve a Ex-Alumnos y no aparece en la Base.
- AC-4: la lista activa de la Base sigue sin mostrar a los "Finalizado" (regresión de `fix-084`).

## Cambio

- **Archivo:** `src/app/core/facades/ex-alumnos.facade.ts` — la lista de egresados y el conteo
  anual excluyen a los alumnos con `students.status = 'archived'`.
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — en la vista Papelera no se
  descartan los "Finalizado".

Ex-Alumnos Profesional usa el mismo facade y la misma consulta, así que también deja de mostrar
archivados; su Papelera es la de la Base Profesional (`ASG-i-025`) y no se revisa acá.

## Test de Regresión

- `src/app/core/facades/ex-alumnos.facade.spec.ts > alumnos archivados — fix-276-m` ✓ (2 tests,
  más el del conteo anual)
- `src/app/core/facades/admin-alumnos.facade.spec.ts > Papelera — fix-276-m` ✓
- `e2e/alumnos-b-ficha.spec.ts > T04 · P04 · M08` ✓ — se archiva un egresado desde su ficha: sale
  de Ex-Alumnos, aparece en la Papelera como "Finalizado" y, al restaurarlo, vuelve a Ex-Alumnos
  sin aparecer en la Base.

## Verificación
Verificado el 2026-10-01: `tsc` de la app sin errores, 53 tests de los dos `.spec.ts` en verde y
el test E2E pasa en navegador.

## Nota de implementación
En la lista de egresados el filtro se aplica sobre las filas ya traídas (se pide
`students.status`), no en la consulta: la lista ya carga todos los egresados de la sede y así no
cambia la forma de la consulta. El conteo anual sí filtra en la consulta, porque solo pide el
número.
