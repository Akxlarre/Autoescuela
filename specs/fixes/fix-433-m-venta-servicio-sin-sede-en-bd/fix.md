# Fix: La BD acepta una venta de servicio especial sin sede
> id: fix-433-m-venta-servicio-sin-sede-en-bd
> refs: fix-429-m-testing-servicios-especiales (caso H07) · fix-194-b · DG-082
> status: in_progress
> created: 2026-10-15

## Root Cause

`fix-194-b` impidió vender sin sede desde el formulario, pero la BD lo sigue aceptando:
`special_service_sales.branch_id` es nullable y la policy de INSERT de la secretaria admite
`branch_id IS NULL`. Probado el 2026-10-15 (transacción revertida): la secretaria de la sede 1
inserta una venta con `branch_id = NULL` desde la consola. Esa venta no aparece en la Caja ni en
los reportes de ninguna sede (DG-082), y la secretaria la sigue viendo (las filas sin sede son
visibles para todas).

## ACs Afectados

Ninguno — fix autónomo. ACs propios:

- AC-1: la BD rechaza registrar una venta sin sede, para cualquier rol.
- AC-2: la BD rechaza quitarle la sede a una venta existente.
- AC-3: la venta #3 que ya existe sin sede no impide aplicar la migración (restricción
  `NOT VALID`). Asignarle sede sigue siendo decisión aparte (`fix-194-b`, fuera de alcance).

## Cambio

- `supabase/migrations/20261015140000_fix433_venta_servicio_exige_sede.sql` —
  `CHECK (branch_id IS NOT NULL) NOT VALID` en `special_service_sales`.

## Test de Regresión

- `supabase/tests/caja/fix-433-m-venta-servicio-exige-sede.sql` — sin la migración: "FALLA"; con
  ella: "ok" (ensayado en transacción revertida).
- Migración pendiente de aplicar (la aplica Matías).
