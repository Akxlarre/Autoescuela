# Fix: La Agenda tarda 5–6 s en cargar (disponibilidad evalúa la RLS fila por fila)
> id: fix-196-b-agenda-disponibilidad-lenta
> refs: ASG-i-037 (caso Z01 del checklist 037, encontrado en fix-190-b) · fix-032-i · hotfix-003-i
> status: in_progress
> created: 2026-10-07

## Root Cause
[Medido: la Agenda de la secretaria tarda 5,5–6,2 s; una sola consulta, `v_class_b_schedule_availability`,
4,8 s. No es por volumen: las clases de D6 están canceladas y el índice parcial las excluye.]
La vista es `security_invoker` (hotfix-003-i). Para cada turno generado, el `NOT EXISTS` de choques
lee `class_b_sessions` y `enrollments` **con la RLS del usuario**: la política se evalúa fila por
fila (`auth_user_role()` y subconsultas por fila, ~4,7 ms por turno) y la condición se ejecuta dos
veces (filtro `slot_status` + `CASE`). `EXPLAIN ANALYZE` impersonando: secretaria/semana 4,99 s,
admin/semana 4,99 s, admin/28 días **21,2 s**; como superusuario, 0,2 s.

Efecto colateral de correctitud: con la RLS, la secretaria no ve las clases de la otra sede, así que
un instructor o vehículo compartido (`both_branches`) ocupado allá se le muestra **disponible**
(el trigger de doble agendamiento igual lo rechaza al guardar).

## ACs Afectados
Ninguno de una spec previa. ACs propios:

- **F1:** la vista devuelve exactamente las mismas columnas y, para el superusuario, las mismas
  filas que antes.
- **F2:** el choque se calcula con todas las clases, sin importar la sede de quien consulta (un
  instructor/vehículo compartido ocupado en la otra sede figura `occupied`).
- **F3:** como secretaria, la semana de la Agenda responde en < 1 s en la BD.
- **F4:** la función nueva no se ejecuta sin sesión (`anon` sin `EXECUTE`).
- **F5:** sin `MATERIALIZED` (hotfix-003-i): el filtro de fecha se sigue aplicando antes del cálculo.

## Cambio
- `supabase/migrations/20261007120000_fix196_schedule_availability_rls_por_fila.sql` — función
  `class_b_slot_occupied(instructor, vehicle, inicio, fin)` `STABLE SECURITY DEFINER`,
  `search_path=''` (DG-063), solo devuelve un booleano; la vista la usa en vez del `NOT EXISTS`.
  Resto de la vista idéntico (sigue `security_invoker`: los turnos que se generan siguen
  respetando la RLS de instructores/vehículos).

## Test de Regresión
- `supabase/tests/agenda/fix-196-b-disponibilidad-rls.sql` (como postgres; deja todo como estaba).
