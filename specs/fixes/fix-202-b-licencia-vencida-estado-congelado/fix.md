# Fix: Una licencia que vence sigue "Vigente" y la Agenda no avisa
> id: fix-202-b-licencia-vencida-estado-congelado
> refs: ASG-i-034 (sospecha S7, confirmada en fix-197-b)
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código y la BD el 2026-10-07.] `instructors.license_status` se calcula
solo al crear/editar (trigger `generate_license_alert`, `UPDATE OF license_expiry`); no hay tarea
programada. `InstructoresFacade` muestra ese valor guardado: una licencia que vence sin que nadie
edite al instructor sigue "Vigente", el filtro "Licencia por vencer" no la cuenta, y la Agenda
ofrece al instructor sin ningún aviso. (Hoy 0 filas desfasadas; pasará con la primera que venza.)

## ACs Afectados
Ninguno de una spec previa. ACs propios (decisión del owner 2026-10-07: **opción B** — la Agenda
sigue ofreciendo al instructor, con aviso):

- **F1:** el estado de licencia que muestran Instructores (lista, ficha, filtro y KPI "por
  vencer") se calcula con `license_expiry` y el día de hoy en Chile: vencida si ya pasó, por vencer
  si faltan ≤ 30 días, vigente si no. El valor guardado deja de usarse para mostrar.
- **F2:** Agenda: en el selector de instructor, los de licencia vencida dicen "· licencia vencida";
  con uno de ellos elegido aparece "La licencia de <nombre> venció el <fecha>"; en "Todos", un aviso
  con cuántos y quiénes. Sus horas se siguen ofreciendo (opción B).
- **F3:** el formulario de alta usa la misma regla (no una copia).

## Cambio
- `src/app/core/utils/license-status.utils.ts` (+ spec) — `licenseStatusFromExpiry(expiry, today)`.
- `src/app/core/facades/instructores.facade.ts` (+ spec) — estado calculado.
- `src/app/core/models/ui/agenda.model.ts`, `src/app/core/facades/agenda.facade.ts` (+ spec) —
  `licenseExpiry`/`licenseExpired` en el filtro de instructores.
- `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts` — aviso.
- `src/app/features/admin/instructores/admin-instructor-crear-drawer.component.ts` — usa la regla.

## Test de Regresión
- `npx vitest run src/app/core/utils/license-status.utils.spec.ts src/app/core/facades/instructores.facade.spec.ts src/app/core/facades/agenda.facade.spec.ts`
- `npx playwright test e2e/agenda-licencia-vencida.spec.ts` contra el build de producción

## Resultado (2026-10-07)
- Vitest de los 3 specs: 58/58 (11 nuevos; el de `InstructoresFacade` en rojo antes del cambio:
  mostraba "valid" para una licencia vencida ayer). `npm run test:ci` 3439 ✓, `ng build` ✓,
  `lint:arch` 0 errores y sin advertencias nuevas (182; `loadInstructors`/`mapRow` quedaron bajo
  50 líneas extrayendo `toInstructorFilter`/`resolveLicenseStatus`).
- `e2e/agenda-licencia-vencida.spec.ts` (nuevo, build de producción, respuesta interceptada con una
  fecha vencida; la BD no se toca): el selector dice "Instructor Prueba · licencia vencida", el aviso
  "La licencia de Instructor Prueba venció el 30-09-2026. Sus horas se siguen ofreciendo." y las
  horas del calendario siguen disponibles.
