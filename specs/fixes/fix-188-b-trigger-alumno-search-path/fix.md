# Fix: El trigger anti doble-agendado del alumno no fija su search_path (DG-063)
> id: fix-188-b-trigger-alumno-search-path
> refs: ASG-i-026 (hallazgo de fix-187-b)
> status: in_progress
> created: 2026-10-06

## Root Cause
[Confirmado en fix-187-b: disparado con `search_path` vacío falla con
`relation "enrollments" does not exist`.] `prevent_student_double_booking_class_b_sessions()`
(fix-301-m) es `SECURITY DEFINER` pero no declara `SET search_path` y usa tablas sin calificar
(`FROM enrollments`, `FROM class_b_sessions`). Por DG-063, hereda el `search_path` de quien lo
dispara: si una función con `search_path = ''` escribe una clase en estado activo, el trigger
falla.

Hoy está **latente**: las únicas funciones con `search_path = ''` que escriben `class_b_sessions`
(`mark_end_of_day_class_b_absences` → `no_show`, `apply_class_b_absence_penalty` → `cancelled`)
usan estados con los que el trigger sale antes de tocar tablas. Basta que mañana una función así
reactive o agende una clase (p. ej. una RPC de reagendamiento) para que se rompa en silencio, que
es exactamente lo que pasó dos veces antes (fix-145, fix-163).

## ACs Afectados
Ninguno de una spec previa. ACs propios:

- **F1:** la función declara `SET search_path = ''` y califica cada tabla con `public.`.
- **F2:** disparado con `search_path` vacío (INSERT de clase activa), rechaza el choque del alumno
  con su mensaje de siempre en vez de fallar por la relación.
- **F3:** sin cambios de comportamiento: misma regla, mismos estados, mismo mensaje, mismo trigger.

## Cambio
- `supabase/migrations/20261006130000_fix188_student_double_booking_search_path.sql`

## Test de Regresión
- `supabase/tests/agenda/fix-187-b-vehiculo-doble-agendado.sql` (sigue 9/9) + caso DG-063 de este
  fix (INSERT con `search_path` vacío → mensaje del alumno), en transacciones que se deshacen.

## Progreso
- [x] Migración escrita — lógica idéntica a fix-301-m salvo `search_path = ''` y `public.` (verificado con diff)
- [x] Caso de prueba agregado a `supabase/tests/agenda/fix-187-b-vehiculo-doble-agendado.sql`
- [ ] Validar en un envío que se deshace (bloqueado: el MCP de Supabase y la Management API responden "FGA Authentication Error. Unauthorized" desde el 2026-10-06)
- [ ] Aplicar con aprobación del owner y registrar en `schema_migrations`
- [ ] Prueba de regresión 10/10 con la migración aplicada
