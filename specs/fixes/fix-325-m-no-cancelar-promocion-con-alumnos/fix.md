# Fix: Se puede cancelar una promoción que tiene alumnos
> id: fix-325-m-no-cancelar-promocion-con-alumnos
> refs: fix-319-m-testing-clase-profesional-piloto (L12, D4) · ASG-i-025
> status: in_progress
> created: 2026-10-05

## Root Cause
"Editar promoción" permite pasarla a Cancelada aunque tenga matrículas vigentes, con un aviso de
"reasignar manualmente". En el piloto no existe dónde reasignarlos (mover alumnos entre
promociones no está modelado), así que quedan colgados de una promoción cancelada.

Decisión D4 (Matías, 2026-10-05): **se bloquea**; solo se cancela una promoción sin matrículas
vigentes.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/features/admin/profesional-promociones/admin-promocion-editar-drawer.component.ts`** —
  con matrículas vigentes, la opción Cancelada aparece deshabilitada con el motivo.
- **Migración nueva** — trigger que rechaza `status = 'cancelled'` si hay matrículas `active` en
  sus cursos (defensa en BD). La aplica Matías.

## Test de Regresión
- Spec del drawer: con alumnos, Cancelada deshabilitada; sin alumnos, habilitada.
- Por API: UPDATE a `cancelled` con alumnos → error del trigger.
