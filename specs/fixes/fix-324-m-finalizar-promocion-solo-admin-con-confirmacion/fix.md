# Fix: Finalizar una promoción a mano no pide confirmación
> id: fix-324-m-finalizar-promocion-solo-admin-con-confirmacion
> refs: fix-319-m-testing-clase-profesional-piloto (S4, D3b) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
En "Editar promoción" se puede pasar el estado a Finalizada como cualquier otro campo. Al
guardarse, el trigger `20260820100000_fix196…sql:28-36` pasa todas sus matrículas `active` a
`completed`, y eso no se deshace desde la app. No hay ningún aviso previo.

Decisión D3b (Matías, 2026-10-05): **se puede finalizar a mano, solo el admin, y con un modal de
confirmación** que diga cuántos alumnos pasan a completados.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/features/admin/profesional-promociones/admin-promocion-editar-drawer.component.ts`** —
  al elegir Finalizada, pedir confirmación con el conteo de matrículas activas antes de guardar.
- La restricción a admin la pone `fix-321-m` (RLS + UI de secretaria).

## Test de Regresión
- Spec del drawer: elegir Finalizada y guardar abre la confirmación; cancelar no llama al facade.
