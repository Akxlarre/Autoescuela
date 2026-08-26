# Fix: Backfill de branch_id en cierres de caja huérfanos

> id: fix-218-m-backfill-cash-closings-branch-id
> refs: fix-212-m-cuadratura-requiere-sede-especifica
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

`fix-212-m` (2026-08-24) impidió operar Cuadratura con "Todas las sedes" seleccionado, pero no
tocó los cierres ya existentes con `branch_id IS NULL` (creados cuando eso sí era posible). Esos
cierres quedaron huérfanos: como en SQL `NULL` nunca iguala a nada, ningún `.eq('branch_id', X)`
del historial por sede los encuentra — invisibles desde cualquier vista de sede específica. Y como
`fix-212-m` también deshabilitó operar/ver con "Todas las sedes" en la propia página de
Cuadratura, ya no hay forma de recuperarlos navegando la UI (documentado como DG-082 en
`indices/DOMAIN-GOTCHAS.md`, corregido aquí: el dato no está perdido en BD, pero sí es
inalcanzable desde la UI).

## ACs Afectados

Ninguno — fix autónomo de datos (hallazgo del dueño de negocio en conversación, no de una spec).

## Cambio

- **Archivo nuevo:** `supabase/migrations/<timestamp>_backfill_cash_closings_branch_id.sql`
  Para cada `cash_closings` con `branch_id IS NULL`: agrega la sede si **todos** los movimientos
  de esa fecha (`payments` vía `enrollments.branch_id`, `special_service_sales.branch_id`,
  `standalone_course_enrollments` vía `standalone_courses.branch_id`, `expenses.branch_id`)
  pertenecen a una sola sede (`COUNT(DISTINCT branch_id) = 1`, ignorando NULLs). Si están
  mezclados entre 2+ sedes, o no hay ningún movimiento con sede identificable, la fila se deja
  como está (decisión explícita del dueño de negocio — no se adivina).
  `instructor_advances` no tiene columna `branch_id` — se excluye del cálculo de "una sola sede"
  (no aporta señal).
  Respeta `UNIQUE(branch_id, date)`: si ya existe otra fila con esa combinación, no se actualiza
  esa fila (evita violar el constraint).
  Migración idempotente: solo toca filas con `branch_id IS NULL`, no vuelve a correr sobre las ya
  backfillizadas.

## Test de Regresión

Migración SQL de datos, sin lógica de decisión en TypeScript — no aplica test unitario. El
`DO $$ ... $$` de la migración emite `RAISE NOTICE` con el conteo de huérfanos antes, filas
actualizadas y huérfanos restantes (mezclados o sin movimientos identificables) — verificación
empírica al aplicar la migración contra la BD real (`npx supabase db push` o equivalente), no
ejecutada en esta sesión por no haber una instancia de Supabase local corriendo. Todos los nombres
de columna/tabla usados (`payments.payment_date`, `payments.status`, `enrollments.branch_id`,
`special_service_sales.sale_date`/`.paid`/`.branch_id`,
`standalone_course_enrollments.paid_at`/`.payment_status`, `standalone_courses.branch_id`,
`expenses.date`/`.branch_id`) se verificaron contra las migraciones originales que los declaran
antes de escribir el SQL.
