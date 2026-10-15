# Fix: descartar una alerta oculta también los casos nuevos y a los demás usuarios del equipo
> id: fix-415-m-descartar-alerta-oculta-casos-nuevos
> refs: fix-395-m-testing-dashboards (casos Q16, Q17, Q18; sospecha S13b)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

1. La secretaria descarta "1 Documento vencido". Una hora después vence otro documento: la alerta
   ("2 Documentos vencidos") sigue oculta hasta que pasen 24 horas.
2. El admin descarta una alerta en el computador del mostrador; la secretaria que entra después en
   ese mismo navegador tampoco la ve.

## Root Cause

`DashboardAlertsFacade.dismissAlert()` guarda en `localStorage` solo el id fijo de la alerta
(`alert-docs-expired`) con la hora. Ese registro no sabe **cuántos** casos había al descartar ni
**quién** descartó: cualquier alerta con ese id queda oculta 24 h para todo el navegador.

## Fix

El descarte se guarda por usuario y con la cantidad de casos que tenía la alerta. Una alerta
descartada vuelve a mostrarse si pasan 24 h o si ahora tiene **más** casos que cuando se descartó.
La regla vive en una función pura (`core/utils/alert-snooze.utils.ts`). Los descartes guardados con
el formato anterior se ignoran.

## Acceptance Criteria

- [x] AC1 — Descartar oculta la alerta para ese usuario durante 24 h, también al recargar.
- [x] AC2 — Si la alerta pasa a tener más casos que al descartarla, vuelve a mostrarse.
- [x] AC3 — Si tiene los mismos casos o menos, sigue oculta.
- [x] AC4 — Otro usuario en el mismo navegador la ve.
- [x] AC5 — Pasadas 24 h vuelve a mostrarse.

## Regression Test

- `alert-snooze.utils.spec.ts`
- `dashboard-alerts.facade.spec.ts` → `descartar una alerta (fix-415-m)`

## Verificación (2026-10-13)

- Unit: `alert-snooze.utils.spec.ts` 9/9 (oculta para quien descartó; vuelve con más casos; sigue
  oculta con igual o menos; otro usuario la ve; vence a las 24 h; formato anterior ignorado) y
  `dashboard-alerts.facade.spec.ts` 68/68 con 3 tests nuevos del flujo completo. `tsc` sin errores.
- Antes del fix, en el navegador (secretaria de la sede 1): descartar "22 Pagos pendientes" la
  ocultaba también tras recargar y dejaba `{"alert-pending-payments": <hora>}` en `localStorage`,
  sin usuario ni conteo.
- E2E `e2e/dashboards.spec.ts` → "P01 · P05 · Q19" y "Q08" siguen en verde con el formato nuevo.
