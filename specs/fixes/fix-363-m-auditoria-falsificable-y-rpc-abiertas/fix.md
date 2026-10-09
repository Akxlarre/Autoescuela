# Fix: registro de auditoría falsificable y funciones de la BD abiertas de más
> id: fix-363-m-auditoria-falsificable-y-rpc-abiertas
> refs: ASG-i-047
> status: in-progress
> created: 2026-10-09
> priority: P0

## Root Cause
[Heredado de ASG-i-047, confirmado el 2026-10-09 leyendo permisos, policies y definiciones en la
BD de desarrollo — sin ejecutar nada sobre datos compartidos]:

Los puntos 1 y 2 de la asignación (`confirm_enrollment_with_payment`, cierre nocturno,
penalización y funciones de cron) ya los cerraron `fix-191-b` y `fix-322-m`; se re-verificó que
siguen cerrados. Queda abierto:

1. **Cualquier usuario logueado puede fabricar entradas de auditoría.** La policy
   `insert_audit_log` (`TO public`, `WITH CHECK auth.uid() IS NOT NULL`) deja insertar filas con
   cualquier `user_id`, acción o sede. Además `anon` y `authenticated` conservan `INSERT`, `UPDATE`,
   `DELETE` y `TRUNCATE` sobre `audit_log`; hoy solo los frena la RLS. El único que inserta de
   verdad es el trigger `log_change()`, que es `SECURITY DEFINER` del dueño de la tabla y no
   necesita ni la policy ni esos permisos. Ni la app ni las edge functions insertan directo.
2. **La autoría de un cambio real se puede atribuir a otro.** `log_change()` resuelve el usuario
   en este orden: header `x-audit-user-id` → columna `registered_by` → sesión. Los dos primeros
   los controla el navegador: basta mandar el header en cualquier escritura.
3. **`get_student_payment_status(p_supabase_uid)`** la ejecuta cualquier logueado y devuelve
   nombre, saldo e historial de pagos del alumno cuyo uid se le pase. No la llama nadie (ni
   `src/app` ni `supabase/functions`).
4. **`get_next_enrollment_number`** la ejecuta cualquier logueado (un alumno incluido) sin revisar
   el rol.
5. **Menores:** `soft_delete_task` y `user_complete_first_login` son ejecutables sin sesión
   (inofensivas: filtran por `auth.uid()`), y 11 funciones `SECURITY DEFINER` no fijan su
   `search_path`.
6. **Causa de fondo:** los permisos por defecto del esquema `public` dan `EXECUTE` a `anon` y
   `authenticated` sobre toda función nueva (más el `EXECUTE` a `PUBLIC` propio de Postgres). Cada
   función nace abierta y depende de que alguien recuerde el `REVOKE` (DG-101).

Revisadas y sin cambio: `class_b_slot_occupied` (la usa la vista
`v_class_b_schedule_availability`), `secretary_extra_visible_user_ids`, `auth_*`, `branch_visible`,
`request_client_ip` (las usan las policies), `delete_promotion_without_students`,
`secretary_last_sign_in` y `exec_dashboard_*` (ya validan rol). Las funciones `RETURNS trigger` no
se pueden invocar por la API.

## ACs Afectados
Ninguno de una spec previa. ACs propios:

- **F1:** `authenticated` y `anon` no pueden insertar, modificar ni borrar filas de `audit_log`.
- **F2:** un cambio hecho con sesión queda a nombre de quien tiene la sesión, aunque mande el
  header `x-audit-user-id` o un `registered_by` ajeno.
- **F3:** una edge function con la service key y el header sigue quedando a nombre del usuario
  del header.
- **F4:** sin sesión ni header (cron, service key), una fila con `registered_by` queda a ese nombre.
- **F5:** el admin sigue leyendo la auditoría y los triggers siguen registrando.
- **F6:** `get_student_payment_status` solo la ejecuta `service_role`.
- **F7:** `get_next_enrollment_number` rechaza con `42501` a quien no sea admin o secretaria; la
  matrícula se sigue confirmando.
- **F8:** `soft_delete_task` y `user_complete_first_login` no se ejecutan sin sesión; con sesión sí.
- **F9:** ninguna función `SECURITY DEFINER` de `public` queda sin `search_path` fijo.
- **F10:** una función nueva creada en `public` nace sin `EXECUTE` para `anon`, `authenticated` y
  `PUBLIC`; `service_role` sí la ejecuta.

## Cambio
- `supabase/migrations/20261009140000_fix363_audit_log_infalsificable_y_rpc_cerradas.sql`
- `supabase/tests/rls/fix-363-m-auditoria-y-rpc.sql` (prueba)

## Test de Regresión
- `supabase/tests/rls/fix-363-m-auditoria-y-rpc.sql` (transacciones que se deshacen).
- Regresión de `fix-191-b`, `fix-206-b` y `fix-212-b` con la migración aplicada.

## Progreso
- [x] Paso 1 de la asignación: permisos y policies reales consultados en la BD
- [ ] Migración y prueba escritas
- [ ] Ensayo de la migración en un envío que se deshace entero
- [ ] Migración aplicada por Matías
- [ ] Prueba y regresiones con la migración aplicada
- [ ] Índices (`DATABASE.md`, `DOMAIN-GOTCHAS.md`)
