# Fix: la matrícula presencial no ofrece a los instructores "ambas sedes" de la otra sede (S7, H02)
> id: fix-248-b
> refs: fix-186-b
> status: done
> closed: 2026-11-10
> created: 2026-11-10

## Root Cause
`EnrollmentFacade.loadInstructors(branchId)` filtra solo por `users.branch_id = branchId`. Un
instructor de la sede 2 con `both_branches = true` (Carlos Muñoz, vehículo AB1234, también de
ambas sedes, 1088 horarios libres para la sede 1) no aparece en el paso 2 de la matrícula de la
sede 1, aunque la Agenda sí lo muestra en esa sede (fix-028-i) y la vista de disponibilidad sí
le da horarios ahí (spec 0057-b). La Agenda y la ficha del alumno ya resolvían esto con una
segunda query `both_branches = true` y una mezcla en el cliente (PostgREST no deja combinar en
un `.or()` una columna embebida con una raíz, PGRST100). La matrícula no.

## ACs Afectados
- 026-agenda-triple-match H02 / S7: el instructor "ambas sedes" de la sede 2 aparece al
  matricular en la sede 1, con su vehículo; sigue sin aparecer el que no tiene vehículo (H03).

## Cambio
- **Archivo:** `src/app/core/facades/enrollment.facade.ts`
- **Qué cambia:** `loadInstructors` hace una segunda query con `both_branches = true` (mismo
  select y mismo filtro de vehículo activo) y la suma sin duplicar. Qué horarios ofrece cada
  uno en esta sede lo sigue decidiendo la vista de disponibilidad (`branch_ids`, spec 0057-b).

## Test de Regresión
- `src/app/core/facades/enrollment.facade.spec.ts > loadInstructors — instructores "ambas sedes" (fix-248-b)` ✓
- `e2e/matricula-paso2.spec.ts > H01 + H02 + H03` ✓
