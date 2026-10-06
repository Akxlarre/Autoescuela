# Fix: Se puede cancelar una promoción que tiene alumnos
> id: fix-325-m-no-cancelar-promocion-con-alumnos
> refs: fix-319-m-testing-clase-profesional-piloto (L12, D4) · ASG-i-025
> status: done
> closed: 2026-10-05
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
- ~~Por API~~ → `supabase/tests/promotions/fix-325-cancel-promotion-with-students.sql` (SQL Editor,
  se revierte siempre): probarlo por API sobre una promoción real con alumnos la cancelaría de
  verdad si la migración aún no estuviera aplicada.

## Progreso
- [x] Editor: conteo de matrículas activas al abrir (`countActiveEnrollments`, de `fix-324-m`);
  "Cancelada" deshabilitada con "(tiene N alumnos activos)" y `canSave` falso; aviso sin "reasignar
  manualmente". Spec 2 casos nuevos.
- [x] Migración `20261005160000_fix325_professional_promotions_block_cancel_with_students.sql`
  (trigger `BEFORE UPDATE OF status`, todos los roles). La app traduce su mensaje
  (`promotionWriteErrorMessage`, test nuevo).
- [x] Vitest 56/56 en los 5 archivos del módulo; `tsc` y `lint:arch` sin errores.
- [x] Matías aplicó la migración y corrió el test SQL; el mensaje empieza con
  `RESULTADO fix-325: TODO OK`. Resultado (2026-10-05): Caso 1 — matrícula 160 activada en la
  promoción 14 dentro de la transacción → cancelar rechazado con
  `promotion_has_active_enrollments: la promoción 14 tiene 1 matrícula(s) activa(s)`; Caso 2 —
  promoción sin alumnos se cancela OK. Todo revertido.
