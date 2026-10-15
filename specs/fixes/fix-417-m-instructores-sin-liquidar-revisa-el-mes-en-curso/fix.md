# Fix: "Instructores sin liquidar" avisa todo el mes de algo que todavía no se puede hacer
> id: fix-417-m-instructores-sin-liquidar-revisa-el-mes-en-curso
> refs: fix-395-m-testing-dashboards (caso Q14, sospecha S14) · fix-410-m
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

La alerta "N instructores sin liquidar" aparece desde la primera clase del mes y no se va hasta el
último día, aunque nadie tenga nada atrasado.

## Root Cause

`DashboardAlertsFacade.checkPendingInstructorPayments()` revisa el mes **en curso**
(`chileMonth()`): instructores con horas este mes y sin liquidación este mes. Un mes se liquida
cuando termina, así que durante el mes esa condición se cumple siempre.

## Fix

**Decisión de Matías (2026-10-14):** la alerta revisa el mes **anterior**. Aparece el día 1 si
quedó alguien sin liquidar y desaparece cuando se liquida. El texto nombra el mes ("horas de
septiembre de 2026").

## Acceptance Criteria

- [x] AC1 — El 14 de octubre la alerta consulta horas y liquidaciones del período `2026-09`.
- [x] AC2 — En enero consulta diciembre del año anterior.
- [x] AC3 — El texto de la alerta nombra el mes revisado.

## Regression Test

- `dashboard-alerts.facade.spec.ts` → `F-5: checkPendingInstructorPayments` (casos fix-417-m)

## Verificación (2026-10-14)

- Unit: `dashboard-alerts.facade.spec.ts`, 3 tests nuevos con el reloj fijado: el 14 de octubre
  consulta `2026-09` y el texto dice "Tienen horas de septiembre de 2026 sin liquidación"; el 5 de
  enero consulta `2026-12`; el 1 de noviembre a las 23:30 hora Chile consulta `2026-10`. 85/85 junto
  con `hora-chile.facades.spec.ts`. `tsc` sin errores.
- Navegador, admin, 14 de octubre: aparece "15 instructores sin liquidar" en "Todas" y "8" con la
  sede 1 (septiembre no está liquidado en dev; coincide con los 8 + 7 instructores con horas de
  septiembre). Antes no aparecía, porque octubre no tiene horas.
