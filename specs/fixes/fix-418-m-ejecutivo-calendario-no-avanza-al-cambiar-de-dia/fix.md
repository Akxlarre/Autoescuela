# Fix: el calendario del ejecutivo no deja elegir el día nuevo si la pestaña quedó abierta
> id: fix-418-m-ejecutivo-calendario-no-avanza-al-cambiar-de-dia
> refs: fix-395-m-testing-dashboards (caso B10, sospecha S17a) · fix-175-b
> status: done
> closed: 2026-10-14
> created: 2026-10-14

## Síntoma

Con el dashboard ejecutivo abierto desde el día anterior, el rango personalizado no deja elegir
hoy: el calendario sigue topado en el día en que se abrió la pantalla.

## Root Cause

`DashboardComponent.today` se calcula una sola vez, al crear el componente
(`protected readonly today = chileTodayIso()`), y de ahí sale la fecha máxima del calendario.
`fix-175-b` ya re-resuelve los presets ("Este mes") contra el día real en cada carga, pero el tope
del calendario quedó con el valor viejo.

## Fix

`today` pasa a ser un signal que se vuelve a leer cada vez que el usuario toca el filtro de
período (puntero o foco), antes de que se abra el calendario.

## Acceptance Criteria

- [x] AC1 — Si el día de Chile cambia con la pantalla abierta, al tocar el filtro `today` pasa al
  día nuevo.
- [x] AC2 — Sin cambio de día, `today` conserva su valor.

## Regression Test

- `dashboard.component.spec.ts` → `fix-418-m`

## Verificación (2026-10-14)

- Unit: `dashboard.component.spec.ts`, 2 tests nuevos con el reloj fijado (23:30 del 14 → 00:30 del
  15 en Chile; y dos horas del mismo día). 11/11. `tsc` sin errores.
- Navegador, admin, con el reloj del navegador fijado a las 23:50 del 14 de octubre (hora Chile): el
  calendario deja elegir hasta el 14. Al pasar el reloj a las 00:20 del 15 y volver a abrir el
  calendario, sin recargar, el 15 queda habilitado y el 16 no.
