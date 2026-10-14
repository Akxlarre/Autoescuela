# Fix: "Caja sin cerrar" no dice qué sede falta y con "Todas" desaparece si cerró cualquiera
> id: fix-423-m-caja-sin-cerrar-dice-que-sede
> refs: fix-395-m-testing-dashboards (caso Q10, decisión de Matías 2026-10-14)
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Con "Todas" elegida, la alerta "Caja sin cerrar" desaparece apenas cierra la caja una de las dos
sedes, aunque la otra siga abierta. Y cuando aparece no dice de qué sede es.

## Root Cause

`checkUnclosedCash()` cuenta los cierres del día de todas las sedes juntas: con uno solo ya da la
caja por cerrada. El texto es fijo ("No se ha registrado el cierre de caja del día").

## Fix

Decisión de Matías: decir explícitamente qué sede falta por cerrar, o que faltan ambas.
`checkUnclosedCash()` lee las sedes del alcance y los cierres del día por sede, y avisa por las que
no cerraron: "Caja sin cerrar: Autoescuela Chillán" o "Caja sin cerrar en ambas sedes". Sigue sin
`count`: el drawer de alertas lo pinta como "N registros", que para la caja no tiene sentido.

## Acceptance Criteria

- [x] AC1 — Con "Todas" y una sede cerrada, la alerta nombra la sede que falta.
- [x] AC2 — Con "Todas" y ninguna cerrada, dice "Caja sin cerrar en ambas sedes".
- [x] AC3 — Con una sede elegida (o una secretaria de una sede), la alerta nombra esa sede y
  desaparece cuando cierra.

## Regression Test

- `dashboard-alerts.facade.spec.ts` → `fix-423-m`

## Verificación (2026-10-14)

- Unit: `dashboard-alerts.facade.spec.ts`, 4 tests nuevos (una sede cerrada, ninguna, las dos, una
  sede elegida); el mock encadenable suma `order`. 78/78. `tsc` sin errores.
- Navegador, secretaria de la sede 1 sin cierre hoy: "Caja sin cerrar: Autoescuela Chillán" / "No se
  ha registrado el cierre de caja del día en Autoescuela Chillán".
