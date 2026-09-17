# Fix: Agenda Clase B — vista de disponibilidad tarda ~8s al cambiar de semana
> id: fix-032-i-agenda-clase-b-vista-disponibilidad-lenta
> refs: 0008-i-reset-y-poblar-datos-prueba, ASG-i-007
> status: in_progress
> created: 2026-09-07
> updated: 2026-09-17 — causa raíz confirmada (antes era hipótesis), absorbe ASG-i-007

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Al poblar la BD de prueba con volumen realista (~1680 filas en `class_b_sessions`, spec
`0008-i`), se detectó que la vista `v_class_b_schedule_availability` tarda **8.19s** en
responder al cambiar de semana en la Agenda (confirmado en el tab Network del navegador:
`v_class_b_schedule_availability?select=instructor_...` = 8.19s vs. `class_b_sessions?select=...`
= 668ms-1.15s en la misma pantalla).

Una query directa equivalente contra `class_b_sessions` con el mismo filtro
(`instructor_id` + rango de fecha) corre en **0.359ms** con `EXPLAIN ANALYZE` (confirmado
contra la BD real, ver conversación de origen) — descarta que el volumen de datos en sí
sea el problema. La vista es la que degrada.

Con el volumen bajo que existía antes de `0008-i` (unas pocas decenas de sesiones), esta
lentitud nunca fue perceptible — es un bug preexistente, no introducido por el reset/seed,
que quedó expuesto recién al probar con datos realistas.

**Causa raíz confirmada (2026-09-17, ver `ASG-i-007`, auditoría de performance independiente
sobre la misma vista — no era una hipótesis distinta, es el mismo bug con mejor diagnóstico):**
`EXPLAIN ANALYZE` contra el proyecto `skvekggejikzxhzsjmkz` muestra **1.033.204 buffer hits**
para devolver solo 3.348 filas. La vista genera slots vía `CROSS JOIN LATERAL generate_series`
(28 días completos) y por cada slot corre **dos `NOT EXISTS` correlacionados** contra
`class_b_sessions` (conflicto de instructor / conflicto de vehículo). Los índices de soporte SÍ
existen (`idx_class_b_sessions_date_instructor`, `idx_class_b_sessions_date_vehicle`), pero como
`slot_status` es una columna `CASE` computada (no real), Postgres no puede cachear el resultado
y termina evaluando la misma lógica **dos veces por fila** cuando el cliente filtra con
`.eq('slot_status', 'available')`: una vez como *join filter* interno, otra para calcular la
columna de salida. El plan muestra 4 SubPlans casi idénticos y ~15.000 invocaciones de índice en
total para una tabla que hoy tiene pocas filas — escala mal a medida que crecen
instructores/vehículos/sesiones agendadas.

~~Hipótesis previas (28 días sin filtro temprano / falta de índice) descartadas~~ — los índices
de soporte existen; el problema es el doble cómputo de `NOT EXISTS` sobre una columna `CASE`,
no la falta de índice ni el rango de 28 días en sí.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno de `0008-i` directamente (esa spec es sobre datos, no sobre performance) — este
  fix es autónomo, descubierto como efecto colateral de validar `0008-i` con volumen real.

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** migración SQL que redefine `v_class_b_schedule_availability` (ubicar
  `supabase/migrations/20260730100000_instructors_vehicles_both_branches.sql:148`, la
  definición vigente, para no duplicar lógica de negocio al reescribirla — y
  `supabase/migrations/20260811110000_fix152_class_b_sessions_prevent_double_booking.sql`
  para el contexto de por qué es doble `NOT EXISTS`).
- **Qué cambia:** reescribir el cálculo de disponibilidad para que el conflicto de
  instructor/vehículo se compute **una sola vez** por slot (ej. un `LEFT JOIN` a una subquery
  de sesiones "ocupantes" en vez de dos `NOT EXISTS` correlacionados recalculados dos veces),
  o evaluar una vista materializada + refresh incremental si el `LEFT JOIN` no alcanza — el
  cálculo no depende de inputs por-request, solo de la fecha actual y el estado de
  `class_b_sessions`.
- **Fuera de alcance:** cualquier cambio a la lógica de negocio de qué cuenta como "conflicto"
  (branch scoping, `both_branches`, etc.) — esa semántica ya está resuelta, solo se toca la
  forma en que se computa.
- Requiere actualizar `indices/DATABASE.md` (regla del proyecto) con la nueva definición.
- Facade consumidor a revisar si cambia el contrato de columnas:
  `src/app/core/facades/agenda.facade.ts:381` (`fetchAvailableSlots`).

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Manual (no hay test automatizado de performance en el proyecto): repetir la medición del
  Network tab del navegador — `v_class_b_schedule_availability` al cambiar de semana en
  `/app/**/agenda` debe responder en <1s con el dataset de `0008-i` cargado (~1680 sesiones).
- `EXPLAIN ANALYZE` de la query subyacente antes/después, confirmando que el número de buffer
  hits baja de forma sustancial (línea base: 1.033.204) y que el plan deja de mostrar 4
  SubPlans casi idénticos para el mismo cálculo de conflicto.
- **Tests de regresión de double-booking (obligatorio, esta vista decide reservas dobles):**
  comparar resultados viejo-vs-nuevo — ningún slot que hoy se marca `occupied`/`available`
  puede cambiar de estado tras la reescritura. No basta con medir que quedó más rápido.
