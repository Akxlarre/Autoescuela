# Asignación ASG-i-007 — Performance crítica en `v_class_b_schedule_availability` (Horario/Agenda)

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-08
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

La vista `v_class_b_schedule_availability` (definida en
`supabase/migrations/20260730100000_instructors_vehicles_both_branches.sql:148`, consumida por
`agenda.facade.ts` → `fetchAvailableSlots()`) tarda **entre 1 y 4.5 segundos reales** cada vez
que se abre `/app/admin/agenda` (Horario). Medido dos veces contra producción con la Resource
Timing API del navegador: 4351ms y 4491ms. Confirmado con `EXPLAIN ANALYZE` contra el proyecto
`skvekggejikzxhzsjmkz`: **1.033.204 buffer hits** para devolver solo 3.348 filas.

Causa raíz: la vista genera slots vía `CROSS JOIN LATERAL generate_series` (28 días) y por cada
slot corre dos `NOT EXISTS` correlacionados contra `class_b_sessions` (conflicto de instructor /
conflicto de vehículo). Los índices de soporte SÍ existen
(`idx_class_b_sessions_date_instructor`, `idx_class_b_sessions_date_vehicle`), pero como
`slot_status` es una columna `CASE` computada (no real), Postgres no puede cachear el resultado
y termina evaluando la misma lógica **dos veces por fila** cuando el cliente filtra con
`.eq('slot_status', 'available')`: una vez como *join filter* interno, otra para calcular la
columna de salida. El plan muestra 4 SubPlans casi idénticos y ~15.000 invocaciones de índice en
total para una tabla `class_b_sessions` que hoy tiene muy pocas filas — esto escala mal a medida
que crecen instructores/vehículos/sesiones agendadas.

El objetivo es que cargar el Horario deje de depender de recomputar esta vista completa (28 días,
2 NOT EXISTS × 2) en cada request, sin introducir bugs de doble-reserva — la vista es la fuente
de verdad que hoy previene el double-booking (ver migración `fix152_class_b_sessions_...`).

## Alcance sugerido

- Diagnosticar con `EXPLAIN ANALYZE` (ya hecho, ver plan completo en el hilo original) antes de
  tocar nada — no asumir la solución sin volver a correrlo tras cualquier cambio.
- Evaluar reescribir el cálculo de disponibilidad para que el conflicto de instructor/vehículo se
  compute **una sola vez** por slot (ej. un `LEFT JOIN` a una subquery de sesiones "ocupantes" en
  vez de dos `NOT EXISTS` correlacionados recalculados dos veces), o acotar el rango de fechas
  materializado en vez de siempre generar 28 días completos.
- Evaluar si conviene una vista materializada + refresh incremental, dado que el cálculo no
  depende de inputs por-request (solo de la fecha actual y el estado de `class_b_sessions`).
- Fuera de alcance de esta asignación: cualquier cambio a la lógica de negocio de qué cuenta como
  "conflicto" (branch scoping, both_branches, etc.) — esa semántica ya está resuelta y no debe
  tocarse, solo la forma en que se computa.
- Requiere migración SQL idempotente + actualizar `indices/DATABASE.md` (regla del proyecto,
  `database.md`) y tests de regresión que confirmen que ningún slot que hoy se marca
  `occupied`/`available` cambia de estado tras la reescritura (antes de tocar producción).

## Referencias

- Migración con la definición vigente de la vista:
  `supabase/migrations/20260730100000_instructors_vehicles_both_branches.sql:148`
- Migración que introdujo la lógica de conflicto actual (contexto de por qué es doble NOT EXISTS):
  `supabase/migrations/20260811110000_fix152_class_b_sessions_prevent_double_booking.sql`
- Facade consumidor: `src/app/core/facades/agenda.facade.ts:381` (`fetchAvailableSlots`)

## Archivos involucrados (opcional, para detectar solapes)

- `supabase/migrations/` (nueva migración para la vista)
- `src/app/core/facades/agenda.facade.ts` (si el contrato de columnas cambia)
- `indices/DATABASE.md`

## Notas para quien la reclame

- P1 porque es el cuello de botella de performance más grande encontrado en una auditoría de 3
  páginas (Dashboard, Base de Alumnos, Horario) — 10-40x más lento que cualquier otro hallazgo,
  y es la página que abren a diario admin/secretaria para agendar clases.
- Esta vista decide reservas dobles — cualquier reescritura necesita tests de regresión
  comparando resultados viejo-vs-nuevo antes de reemplazarla en producción, no solo medir tiempo.
- No confundir con el hallazgo secundario (menor) de que `agenda.facade.ts:228-229` espera dos
  fases (`Promise.all` de lookups → luego `loadWeek()`) cuando podrían fusionarse — eso es ruido
  frente a este hallazgo, pero si se toca el facade de paso, puede evaluarse junto.
