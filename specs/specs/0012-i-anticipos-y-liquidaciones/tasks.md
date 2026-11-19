# Tasks 0012-i — Anticipos y liquidaciones

> Plan aprobado por Ignacio el 2026-11-19. Detalle de fases 2–4 se agrega al empezar cada una.

## Progreso

### Fase 1 — AC15, AC16, AC17

- [x] **T1.1** SQL: migración `spec0012i_f1` (sin candados de caja en anticipos, horas NUMERIC(6,2),
  `recalc_instructor_monthly_hours` exacta, recálculo). Aplicada por Ignacio el 2026-11-19
  (0 triggers de caja en anticipos, escala 2, 0 filas desalineadas de 51).
  - DoD: `0012-i-anticipos-fuera-de-caja.sql` 7/7 ok; `fix-445-m-egresos-caja-cerrada.sql` 5/5 ok;
    `fix-044-i-caja-saldo-y-cierre.sql` ok en triggers y candados. Sus 2 casos AC-1 (`total_paid`)
    fallan por datos ajenos a esta spec: la matrícula que elige (8555) tiene `total_paid` 120.000
    sin filas en `payments`, y el trigger lo recalcula desde `payments`.
- [x] **T1.2** AC17 app: formato de horas (util + spec), `LiquidacionesFacade` sin redondeo a 1
  decimal, `liquidaciones-content` con dos decimales y pie exacto.
  - DoD: 3 clases → 2,25 h → $11.250 en el spec del facade; pie 9,75.
- [x] **T1.3** AC17 edge: `_shared/payroll-totals.ts` (+ test) y `generate-payroll-report` con
  dos decimales.
- [x] **T1.4** AC15 app: `CuadraturaFacade` sin anticipos (lectura, Realtime, eliminar),
  `cuadratura.model.ts`, `cuadratura-content`, drawer de egreso sin "Anticipo" (+ specs).
  - DoD: specs de facade y drawer verdes; la Caja no lista ni resta anticipos.
- [x] **T1.5** AC15 edge: `generate-cash-closing-report` sin anticipos.
- [x] **T1.6** AC16: botón "Dar anticipo" por fila en `liquidaciones-content` (output) y apertura
  del drawer con instructor preelegido en las páginas admin y secretaria (+ specs).
- [x] **T1.7** Validación: `test:ci` (5527 ✓) y `lint:arch` (0 errores, sin regresiones) ✓;
  índices ✓. `/verify` 2026-11-19 (admin y secretaria): Liquidaciones con 2,25 h → $11.250 y pie
  10,50 h; "Anticipo"/"Dar anticipo" abre el drawer con el instructor preelegido; la Caja solo
  consulta `expenses`; "Agregar Egreso" ofrece solo Combustible y Gastos Varios; consola sin errores.
  - Nota: el test Deno de `_shared/payroll-totals` no se pudo correr (sin Deno local); las
    funciones se comprobaron con tsx.

### Fase 2 — AC1–7, AC-E1/E2/E3
- [ ] Planificar al terminar la fase 1.

### Fase 3 — AC8–11
- [ ] Planificar al terminar la fase 2.

### Fase 4 — AC12–14, AC18
- [ ] Planificar al terminar la fase 3.
