# Fix: La tarifa por hora acepta decimales (error crudo de Postgres) y 0
> id: fix-210-b-tarifa-hora-entera-positiva
> refs: ASG-i-034 (sospecha S22, confirmada en fix-197-b)
> status: done
> created: 2026-10-07

## Root Cause
[Confirmado leyendo el código el 2026-10-07.] En "Tarifa por hora" (Ajustes → nómina) el input
`type="number"` habilita "Guardar" con cualquier valor ≥ 0. `branch_payroll_config.amount_per_hour`
es `INTEGER`: un decimal (p. ej. 5000.5) llega a Postgres y vuelve como error técnico en el toast.
Y 0 se guarda: todas las liquidaciones de esa sede quedarían en $0.

## ACs Afectados
Ninguno de una spec previa. ACs propios:
- **F1:** solo un entero mayor a 0 habilita "Guardar"; decimales, 0, negativos o vacío no.
- **F2:** con un valor inválido escrito, bajo el campo aparece "Ingresa un monto entero mayor a 0."
- **F3:** sin cambios para valores válidos.

## Cambio
- `src/app/core/utils/hourly-rate.utils.ts` (+ spec) — `isValidHourlyRate()`.
- `src/app/features/admin/configuracion-nomina/tarifa-instructores-drawer.component.ts` — la usa en
  `isDirty()` y muestra el aviso.

## Test de Regresión
- `npx vitest run src/app/core/utils/hourly-rate.utils.spec.ts src/app/features/admin/configuracion-nomina/tarifa-instructores-drawer.component.spec.ts`

## Progreso
- [x] `hourly-rate.utils.spec.ts` 2/2 (rojo → verde); `tarifa-instructores-drawer.component.spec.ts` +1 caso (decimal y 0 no habilitan ni llaman a `updateRate`, muestran aviso; vacío no avisa) — 12/12.
- [x] `ng build` ✓, `lint:arch` 0 errores (182, sin nuevas).
