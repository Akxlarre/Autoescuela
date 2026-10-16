# fix-226-b — La vista de horarios falla con "permission denied" desde fix-224-b

- **Autor:** b
- **Origen:** regresión de `fix-224-b` (migración `20261015120000`, aplicada el 2026-10-15),
  encontrada el 2026-10-16 al retomar ASG-i-026.
- **Estado:** cerrado (2026-10-16)

## Bug

`v_class_b_schedule_availability` es `security_invoker`: corre con los permisos de quien la lee.
fix-224-b le agregó `vehicle_is_operational()` sin `GRANT EXECUTE` a `authenticated` (en este
proyecto las funciones nuevas no lo heredan, fix-191-b). Resultado: con sesión de admin o de
secretaria, leer la vista da `permission denied for function vehicle_is_operational` → la Agenda,
la elección de horarios de la matrícula presencial y el reagendar de la ficha del alumno fallan.
Las edge functions (matrícula online, pago online) usan `service_role` y no se ven afectadas.

Los tests de fix-224-b corrían como `postgres` y no lo detectaron.

## Criterios

- **P1** — admin, secretaria de cada sede leen la vista sin error.

## Cambio

Migración `20261016130000_fix226_grant_vehicle_is_operational.sql`:
`GRANT EXECUTE ON FUNCTION public.vehicle_is_operational(text) TO authenticated, service_role`
(el mismo permiso que `class_b_slot_occupied()`).

Test: `supabase/tests/flota/fix-226-b-vista-horarios-como-usuario.sql` — lee la vista impersonando
a las cuentas de prueba (3 fallas antes del GRANT, en producción).

## Lección

Una función que se agrega a una vista `security_invoker` necesita el `GRANT EXECUTE` en la misma
migración, y su test tiene que leer la vista como `authenticated`, no como `postgres`.

## Verificación

- [x] Test en BEGIN…ROLLBACK con la migración.
- [x] Migración aplicada en producción (requiere aprobación del owner) + test en verde.
