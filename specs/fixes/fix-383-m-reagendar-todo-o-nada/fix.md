# Fix: un reagendamiento masivo que falla a mitad deja clases movidas y sin historial
> id: fix-383-m-reagendar-todo-o-nada
> refs: fix-366-m-testing-asistencia-clase-b (J08/S16) · ASG-i-027 · RF-053 · fix-008-i · fix-191-m
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 3 de `fix-366-m`, J08 (leído en el código): "Guardar Reagendamiento" mueve las clases una por
una desde el navegador y guarda el historial al final. Si un horario choca a mitad de camino (el
trigger de doble agendamiento lo rechaza, o se corta la red), las primeras clases ya quedaron
movidas, las demás no, y no queda ninguna fila en el historial de reagendamientos.

## Root Cause

`AdminAlumnoDetalleFacade.reagendarClasesPenalizadas()` hace N `UPDATE` de `class_b_sessions` + N
archivados de asistencia + 1 `INSERT` de historial como llamadas separadas: no hay transacción.

## Fix

Migración `20261012140000_fix383_…`: RPC `reschedule_class_b_sessions(p_enrollment_id,
p_instructor_id, p_items jsonb, p_reason, p_reason_other)`, `SECURITY INVOKER` (la RLS de quien
llama sigue aplicando) y con chequeo de rol admin/secretaria. En una sola transacción, por cada ítem
`{session_id, scheduled_at, vehicle_id}`:
- verifica que la clase sea de esa matrícula y guarda su fecha e instructor anteriores;
- la recicla (instructor, vehículo, fecha, `scheduled`, sin horas reales ni `cancelled_at`);
- archiva su asistencia vigente (fix-191-m);
- inserta la fila del historial (fix-008-i), con `registered_by` = usuario de la sesión.

Cualquier error (choque de agenda, RLS, clase ajena) revierte todo. El facade arma los ítems (vehículo
por slot, como hoy) y hace una sola llamada.

## Acceptance Criteria

- [x] AC1 — Si un horario de la selección choca, no se mueve ninguna clase ni se escribe historial,
      y el usuario ve el motivo.
- [x] AC2 — Sin choques, todas las clases quedan reagendadas, con su asistencia anterior archivada y
      una fila de historial por clase (fecha e instructor anteriores y nuevos, razón).
- [x] AC3 — Una clase de otra matrícula en los ítems se rechaza.
- [x] AC4 — Solo admin y secretaria pueden llamarla.

## Regression Test

`admin-alumno-detalle.facade.spec.ts` (`reagendarClasesPenalizadas`) y
`supabase/tests/asistencia/fix-383-m-reagendar-todo-o-nada.sql`.

## Verificación (2026-10-12)

- `admin-alumno-detalle.facade.spec.ts` 90/90: una sola llamada a la RPC con los ítems en orden;
  si la RPC falla, el error sube al drawer, no hay toast de éxito ni notificaciones y la selección
  se conserva para reintentar.
- Ensayo en la BD de dev **sin aplicar** (`BEGIN; <migración>; <test>; ROLLBACK;`):
  `RESULTADO fix-383-m: TODO OK` — AC1 (choque → "El instructor ya tiene una clase agendada que se
  solapa con este horario.", nada movido ni historial), AC2 (3 reagendadas, asistencia archivada,
  3 filas de historial completas), AC3, AC4 (42501). Sin la migración el test falla (la función no existe).

**Pendiente:** que Matías aplique `20261012140000_fix383_reagendar_todo_o_nada.sql`. **Hasta
entonces "Guardar Reagendamiento" falla en dev** (el front ya llama a la RPC). Después: correr el test
SQL y un reagendamiento real en el navegador, y cerrar.

**Migración aplicada por Matías (2026-10-12).** Test SQL contra la BD real: `RESULTADO fix-383-m: TODO
OK`. En el navegador, ficha de `E2E-AsisPenalizado` → reagendar las clases 11 y 12 (Médica,
Instructor1, mié 14/10 y jue 15/10 08:30) → quedan `scheduled` en esas fechas, con 1 fila de
historial cada una, y el drawer se cierra.