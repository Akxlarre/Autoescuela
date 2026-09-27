# Fix: El filtro "Personalizado" del dashboard ejecutivo hace saltar el layout
> id: fix-176-b-dashboard-ejecutivo-filtro-personalizado-salta
> refs: 0044-b-dashboard-ejecutivo-admin
> status: done
> closed: 2026-09-27
> created: 2026-09-27

## Root Cause
`app-exec-period-filter` renderiza dos `app-date-input` (con su `label` encima, `micro-label mb-1`)
solo cuando `preset() === 'custom'`. Al elegir "Personalizado" la fila del filtro gana alto y
ancho de golpe: empuja las 4 tarjetas financieras hacia abajo y achica la celda `.bento-fill` de
tabs. Además cada cambio de fecha emite `rangeChange` al instante, así que armar un rango
dispara 2 recargas (7 RPC c/u) con rangos intermedios.

## ACs Afectados
- AC1 (0044-b): el filtro de período permite elegir un rango personalizado — sin alterar el
  alto de la fila del filtro, y cargando una sola vez por rango confirmado.

## Cambio
- **Archivo:** `src/app/shared/components/exec-period-filter/exec-period-filter.component.ts`
- **Qué cambia:** el filtro tiene siempre la misma forma: `p-select` de presets + un botón fijo
  (mismo alto) con el rango vigente (`describeRange`). El botón —o elegir "Personalizado"— abre un
  `p-popover` con un calendario de rango inline y "Aplicar"/"Cancelar". Solo "Aplicar" emite
  `rangeChange` (preset `custom`); cerrar el popover descarta el borrador.

- **Apoyo:** `pickerDatesToRange()` en `src/app/core/utils/executive-dashboard.utils.ts` (valor del
  calendario de rango → rango ISO; función pura con test).

## Test de Regresión
- `src/app/shared/components/exec-period-filter/exec-period-filter.component.spec.ts` (tests fix-176-b) ✓
- `src/app/core/utils/executive-dashboard.utils.spec.ts > pickerDatesToRange (fix-176-b)` ✓

## Verificación visual (Chromium, RPC reales contra Postgres local)
- Al elegir "Personalizado": alto del filtro 40px antes y después; tope de las tarjetas y alto de
  la celda de tabs sin cambios (1440×900 y 390×844). Sin scroll de documento.
- Armar el rango (2 clics) no dispara RPC; "Aplicar" dispara exactamente 1 ronda (7 RPC).
- "Cancelar" deja el selector en el preset vigente sin recargar.
- Capturas: `qa/desktop-popover.png`, `qa/desktop-dark-popover.png`, `qa/mobile-390-aplicado.png`.
