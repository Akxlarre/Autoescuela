# Hotfix: el combustible de un vehículo "Ambas" queda en la caja de quien lo registra
> id: hotfix-084-b-combustible-caja-de-quien-registra
> refs: ASG-i-032 (checklist 032, O03; decisión del owner 2026-10-16)
> status: closed
> created: 2026-10-16

## Problema
Un egreso de combustible toma la sede del vehículo (fix-243-m). Con un vehículo "Ambas", la
secretaria de la sede B que paga la carga lo ve quedar en la caja de la sede A (la principal del
vehículo), y su cuadratura no cuadra. Decisión: queda en la caja de quien lo registra.

## Cambios
- **Archivo:** `src/app/core/utils/fuel-expense-branch.utils.ts` (+ spec) — `resolveFuelExpenseBranch()`.
- **Archivo:** `src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts`
  (+ spec) — lo usa. Vehículo de una sede: sin cambios. Admin en "Todas las sedes": sede principal.

## Verificación
- [x] vitest del util y del drawer.
