# Fix: La BD permite el mismo vehículo en dos clases a la misma hora
> id: fix-187-b-vehiculo-doble-agendado
> refs: ASG-i-026 (hallazgo H2 de fix-186-b — sospecha S4 del checklist 026)
> status: done
> created: 2026-10-06

## Root Cause
[Confirmado en fix-186-b con SQL contra la BD del piloto.] El Triple Match se cumple en la BD
solo para 2 de sus 3 partes: `trg_prevent_double_booking` (fix-152-m) bloquea al **instructor** y
`trg_prevent_student_double_booking` (fix-301-m) al **alumno**, pero ningún trigger mira
`vehicle_id`. La vista de disponibilidad sí considera el vehículo, pero solo **al leer**:

- INSERT de una clase con otro instructor y el **mismo vehículo** a la misma hora → se guarda.
- UPDATE que solo cambia `vehicle_id` a uno ocupado → se guarda (es lo que hace "Iniciar clase"
  al cambiar de vehículo, S8/K06).

En la BD hay 223 choques históricos de vehículo (clases `completed`/`no_show` del seed) y ninguno
futuro.

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-026). ACs propios:

- **F1:** INSERT de una clase cuyo vehículo ya tiene otra clase solapada → rechazado con
  "El vehículo ya tiene una clase agendada que se solapa con este horario."
- **F2:** UPDATE que cambia `vehicle_id`, `scheduled_at` o `duration_min` hacia un choque, o que
  reactiva una clase `cancelled`/`no_show` sobre un choque → rechazado.
- **F3:** las clases `cancelled` y `no_show` no ocupan el vehículo (igual que para el alumno).
- **F4:** un UPDATE que no mueve la clase ni cambia su vehículo (iniciar, finalizar, notas) no se
  valida: las filas con choques históricos se siguen pudiendo cerrar o cancelar.
- **F5:** la validación ve las clases de todas las sedes (vehículos "ambas sedes"), aunque quien
  escriba sea una secretaria con RLS por sede.
- **F6:** dos inserciones simultáneas del mismo vehículo y horario no pasan ambas (lock por vehículo).

## Cambio
- `supabase/migrations/20261006120000_fix187_class_b_sessions_prevent_vehicle_double_booking.sql`
- `supabase/tests/agenda/fix-187-b-vehiculo-doble-agendado.sql` (prueba)

## Test de Regresión
- `supabase/tests/agenda/fix-187-b-vehiculo-doble-agendado.sql` (transacciones que se deshacen).
- `supabase/tests/agenda/fix-186-b-triple-match-bd.sql`: O03a y O03b pasan a "ok".

## Resultado (2026-10-06)
- Validada antes de aplicar, en un envío que se deshacía entero (trigger incluido); verificado
  después que no quedó nada.
- **Aplicada en la BD del piloto** con aprobación del owner y registrada en
  `supabase_migrations.schema_migrations` con la versión del archivo (`20261006120000`).
- Prueba de regresión con la migración aplicada: **9/9 ok** — F1 (INSERT ocupado), F1 control
  (contiguo se guarda), F2a (cambio de `vehicle_id`, como "Iniciar" con otro vehículo), F2b (mover
  la hora), F2c (reactivar cancelada), F3 (`cancelled`/`no_show` no ocupan), F4 (fila con choque
  histórico se puede iniciar/cerrar), F5 (secretaria sede 2 vs clase de sede 1), DG-063
  (`search_path` vacío). Sin datos de prueba remanentes.
- F6 (concurrencia) no se puede probar en una sola sesión SQL: lo cubre
  `pg_advisory_xact_lock(1870, vehicle_id)`.
- Frontend sin cambios: `ErrorSanitizerService` deja pasar tal cual los mensajes `P0001`.

## Hallazgo fuera de alcance
- **`prevent_student_double_booking_class_b_sessions()` (fix-301-m) tiene DG-063:** sin
  `SET search_path` propio y con tablas sin calificar (`FROM enrollments`). Disparado con
  `search_path` vacío falla con `relation "enrollments" does not exist`. Hoy es **latente**: las
  únicas funciones con `search_path = ''` que escriben `class_b_sessions`
  (`mark_end_of_day_class_b_absences`, `apply_class_b_absence_penalty`) ponen `no_show`/`cancelled`,
  y con esos estados el trigger retorna antes de tocar tablas. → fix propio (pendiente).
