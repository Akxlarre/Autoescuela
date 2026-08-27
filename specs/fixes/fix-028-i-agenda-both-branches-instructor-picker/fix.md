# Fix: Agenda no respeta `both_branches=true` de instructores al filtrar por sede
> id: fix-028-i-agenda-both-branches-instructor-picker
> refs: docs/UAT-PLAN.md (Paquete 6, caso "Crear instructor con 'ambas sedes' habilitado → aparece en el picker de ambas sedes, no solo la de origen")
> status: done
> closed: 2026-08-26
> created: 2026-08-26

## Root Cause

`AgendaFacade.loadInstructors()` (`src/app/core/facades/agenda.facade.ts:455-484`) filtra
instructores con `query.eq('users.branch_id', branchId)` cuando hay una sede activa
seleccionada — pero nunca considera la columna `instructors.both_branches`. El resultado: un
instructor creado con "Trabaja/opera en ambas sedes" activado **solo aparece en el picker de
Agenda de su sede de origen**, no en la otra, para cualquier secretaria anclada a una sede
específica (branchId ≠ null). Admin con "Todas las sedes" (branchId = null) no sufre el bug
porque en ese caso el filtro se salta por completo.

**Verificado en vivo (UAT, 2026-08-26):** se creó "UAT Instructor Prueba" con sede principal
Autoescuela Chillán y `both_branches=true` (confirmado en BD: `both_branches: true`). Apareció
en el picker de `secretaria@test.com` (Autoescuela Chillán, su sede de origen) y en el picker
de `admin@test.com` ("Todas las sedes"), pero **NO** apareció en el picker de
`secretaria2@test.com` (Conductores Chillán, la otra sede) — pese al grant.

**El patrón correcto ya existe en el codebase** (spec 0004-m, AC6) — `InstructoresFacade.fetchData()`
(`src/app/core/facades/instructores.facade.ts:260-307`) y `AdminAlumnoDetalleFacade` resuelven
exactamente este caso con una segunda query + merge client-side (PostgREST rechaza mezclar una
columna de recurso embebido, `users.branch_id`, con una columna raíz, `both_branches`, en un
solo `.or()` — confirmado PGRST100 en esa spec). `AgendaFacade.loadInstructors()` simplemente
nunca se actualizó para seguir ese mismo patrón cuando se introdujo `both_branches` — es un
punto de código huérfano de esa spec, no una regresión posterior.

## ACs Afectados

- Ninguno de una spec formal — fix autónomo descubierto en `docs/UAT-PLAN.md` Paquete 6
  ("Crear instructor con 'ambas sedes' habilitado → aparece en el picker de ambas sedes, no
  solo la de origen").

## Cambio

- **Archivo:** `src/app/core/facades/agenda.facade.ts`
- **Qué cambia:** `loadInstructors()` replica el patrón de segunda-query-y-merge ya usado en
  `InstructoresFacade.fetchData()`: tras la query filtrada por `users.branch_id`, si
  `branchId !== null`, ejecuta una segunda query `.eq('both_branches', true)` y mergea los
  instructores no vistos (dedupe por `id`) antes de setear `_instructors`.

## Test de Regresión

- `src/app/core/facades/agenda.facade.spec.ts > loadInstructors() incluye instructores both_branches=true de OTRA sede` ✓
