-- fix-226-b: la Agenda y la elección de horarios fallan con "permission denied for function
-- vehicle_is_operational" desde fix-224-b (20261015120000).
--
-- v_class_b_schedule_availability es security_invoker: corre con los permisos de quien la lee.
-- fix-224-b le agregó vehicle_is_operational() sin darle EXECUTE a authenticated (en este
-- proyecto las funciones nuevas no lo heredan: fix-191-b). Mismo permiso que
-- class_b_slot_occupied(), la otra función que usa la vista.
-- Idempotente.

GRANT EXECUTE ON FUNCTION public.vehicle_is_operational(text) TO authenticated, service_role;
