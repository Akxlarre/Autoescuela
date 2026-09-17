# Hotfix: v_class_b_schedule_availability con 500/timeout tras fix-032-i (MATERIALIZED bloquea filtro de fecha)
> id: hotfix-003-i-agenda-materialized-cte-bloquea-filtro-fecha
> refs: fix-032-i-agenda-clase-b-vista-disponibilidad-lenta
> status: done
> closed: 2026-09-17 — verificado en navegador real por el usuario, no solo en SQL Editor.
> created: 2026-09-17

## Problema
Tras aplicar `fix-032-i` (CTE `MATERIALIZED` + fusión de los 2 `NOT EXISTS` en 1), la Agenda
en producción empezó a devolver **HTTP 500** al cargar (~8.19s antes de fallar, visible en
Network tab del navegador). La verificación de `fix-032-i` solo probó
`WHERE slot_status = 'available'` sin el filtro de rango de fecha real que aplica
`agenda.facade.ts:383-388` (`.gte('slot_start', rangeStart).lt('slot_start', rangeEnd)`).

**Confirmado (2026-09-17):**
- Response real de PostgREST: `{"code": "57014", "message": "canceling statement due to statement timeout"}`.
- `EXPLAIN ANALYZE` con el filtro de fecha real (`slot_start >= now()::date AND slot_start < now()::date + 7 days`)
  aislado corre en 563ms — no reproduce el timeout por sí solo. Pero el plan revela el problema:
  el `Filter` de fecha se aplica DESPUÉS de que el CTE `MATERIALIZED` calculó el conflicto para
  **las 4.368 filas completas** (28 días × todos los instructores/vehículos), descartando
  después `Rows Removed by Filter: 3373` (~77% del trabajo hecho se tira). Bajo carga real
  (Agenda dispara ~10 peticiones concurrentes al cargar, visible en el Network tab del usuario:
  `users`, `class_b_sessions`, `instructors`, `notifications`, `vehicles`, etc. simultáneas),
  ese exceso de trabajo por conexión es suficiente para superar el `statement_timeout` de la API.

## Cambios
- **Archivo:** `supabase/migrations/` — nueva migración que reemplaza
  `v_class_b_schedule_availability` (definida por última vez en
  `20260917100000_fix032_optimize_class_b_schedule_availability_view.sql`) quitando el hint
  `MATERIALIZED` del CTE de disponibilidad, **manteniendo** la fusión de los 2 `NOT EXISTS`
  en 1 con `OR` (esa parte no causó el problema y sigue siendo una mejora real).
- Fuera de alcance: cualquier otro cambio a la vista — un hotfix revierte solo lo que rompió,
  no reabre el resto del diseño de `fix-032-i`.

## Resultado
- [x] Error real de la respuesta 500 confirmado: `57014 canceling statement due to statement timeout`.
- [x] `EXPLAIN ANALYZE` con el filtro de fecha real corrido — reveló el `Rows Removed by Filter: 3373/4368` causado por `MATERIALIZED`.
- [x] Migración de corrección aplicada en producción (`20260917110000_hotfix003_remove_materialized_class_b_schedule_availability.sql`, sin `MATERIALIZED`) — BEGIN/ROLLBACK primero, luego COMMIT, sin error en ninguno de los dos.
- [x] Agenda confirmada funcionando en el navegador real por el usuario ("Ahora funciona excelente") — no solo en SQL Editor aislado.
- [x] ~~Regresión de double-booking~~ — no aplica: la lógica de conflicto no cambió, solo si Postgres la materializa o no (mismo `WHERE`, byte a byte, que `fix-032-i` ya verificó con 0 diferencias).

**Lección para `fix-032-i` (y cualquier optimización de vista futura):** verificar `EXPLAIN
ANALYZE` solo con los filtros mínimos de la query (`slot_status`) no alcanza — hay que probar
con **todos** los filtros que el consumidor real aplica (acá, el rango de fecha de
`agenda.facade.ts`), porque un CTE `MATERIALIZED` puede ser una mejora en un caso y una
regresión severa en otro dependiendo de qué filtros externos existan. Ver DG-093 (actualizado).
