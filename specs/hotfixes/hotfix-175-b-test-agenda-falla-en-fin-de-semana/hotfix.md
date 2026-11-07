# Hotfix: test de agenda hotfix-077-b falla en fin de semana
> id: hotfix-175-b-test-agenda-falla-en-fin-de-semana
> refs: —
> status: in_progress
> created: 2026-11-07

## Problema
`agenda.facade.spec.ts > hotfix-077-b: con sede elegida, muestra la patente de un vehículo de la
otra sede` falla los sábados y domingos, también en `main`. El horario de prueba se arma en
`chileToday()`, pero la agenda muestra lunes a viernes de la semana actual: un fin de semana el
horario cae fuera de la grilla y `weekData()` no trae la patente.

## Cambios
- **Archivo:** `src/app/core/facades/agenda.facade.spec.ts` — el horario va el martes de la semana
  que muestra la agenda (`addDaysIso(mondayOfIso(chileToday()), 1)`, el patrón que ya usan los
  otros tests del archivo), y el test fija el reloj en un sábado (`vi.setSystemTime`, solo `Date`)
  para que la regresión falle todos los días y no solo en fin de semana. Como la semana se calcula
  al crear el facade, el test lo vuelve a crear después de fijar el reloj.

## Verificación
- El spec de la agenda pasa hoy (sábado 2026-11-07): 42/42, y en UTC, Asia/Tokyo y America/Santiago
  (`node scripts/test-tz.mjs`).
- Volviendo el horario a `chileToday()` con el reloj fijado, el test falla: la regresión ya no
  depende del día en que se corra.
- `npm run test:ci`: 4.690 pasan, 5 omitidos, 0 fallan · `npm run lint:arch`: 0 errores.
