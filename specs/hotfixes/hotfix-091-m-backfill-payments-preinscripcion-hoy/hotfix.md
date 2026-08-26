# Hotfix: Backfill de payments para matrículas de hoy afectadas por fix-213-m
> id: hotfix-091-m-backfill-payments-preinscripcion-hoy
> refs: fix-213-m-pago-efectivo-preinscripcion-sin-registro-en-payments
> status: done
> created: 2026-08-25
> closed: 2026-08-25

## Problema
fix-213-m corrigió que `completarMatricula()` no insertaba en `payments`, pero eso no
repara las matrículas ya creadas hoy con ese bug — siguen sin fila en `payments` y por
lo tanto ausentes de Cuadratura de Caja. Se necesita un backfill puntual solo para hoy.

## Cambios
- **Archivo:** `supabase/migrations/20260825185803_backfill_payments_preinscripcion_profesional_hoy.sql` — script SQL idempotente: diagnóstico (SELECT) + INSERT que crea la fila de `payments` faltante para enrollments de hoy, canal `in_person`, con `total_paid > 0` y sin fila previa en `payments`, asumiendo método efectivo (caso reportado).
