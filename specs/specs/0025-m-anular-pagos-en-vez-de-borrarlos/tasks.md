# Tasks 0025-m — Anular pagos en vez de borrarlos

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done (2026-10-13)
> **Created:** 2026-10-13

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Inventario previo al trigger
  - **AC ref:** AC8, AC-E4
  - **DoD:**
    - [x] Listados los `UPDATE` y `DELETE` sobre `payments` (app, edge functions, SQL)
    - [x] Verificado si la secretaria puede leer el nombre de quien anuló
- [x] **T1.2** — Migración `spec0025_payments_anulacion` + test SQL
  - **AC ref:** AC1, AC3, AC8, AC9, AC-E1, AC-E2, AC-E4
  - **DoD:**
    - [x] Columnas `voided_at`, `voided_by`, `void_reason`
    - [x] Trigger `guard_anulacion_pago` (rol, motivo, definitivo, día cerrado, quién/cuándo)
    - [x] `supabase/tests/rls/spec-0025-m-anular-pagos.sql` sin datos residuales
    - [x] Migración aplicada por Matías y test SQL en verde
- [x] **T1.3** — Utils y modelos
  - **AC ref:** AC10
  - **DoD:**
    - [x] `payment-status.utils` con el criterio único + spec
    - [x] Tokens nuevos en `db-error.utils` + spec
    - [x] DTO `Payment` y modelos UI con `anulacion`
- [x] **T1.4** — Test guardián de lecturas de `payments` (en rojo primero)
  - **AC ref:** AC10

## Fase 2 — Caja

- [x] **T2.1** — `cuadratura.facade.ts` (TDD)
  - **AC ref:** AC1, AC2, AC9
  - **DoD:**
    - [x] Trae pagos anulados; totales, arqueo y cierre solo suman vigentes
    - [x] Anular es un `UPDATE` con motivo, nunca `DELETE`
    - [x] Errores sin toast de éxito
- [x] **T2.2** — `cuadratura-content` + smart del admin
  - **AC ref:** AC1, AC2, AC8
  - **DoD:**
    - [x] Fila tachada con "Anulado" y motivo, sin botón
    - [x] Modal con motivo obligatorio
    - [x] Exportación y contador excluyen anulados

## Fase 3 — Lecturas que suman

- [x] **T3.1** — `pagos.facade.ts` (4 indicadores)
  - **AC ref:** AC5
- [x] **T3.2** — `reportes-contables`, `dashboard`, `dashboard-alerts`
  - **AC ref:** AC6
- [x] **T3.3** — Test guardián en verde
  - **AC ref:** AC10

## Fase 4 — Pantallas que listan

- [x] **T4.1** — Ficha del alumno (B y Profesional)
  - **AC ref:** AC4
- [x] **T4.2** — Pagos: recientes, detalle y estado de cuenta
  - **AC ref:** AC5
- [x] **T4.3** — Paso de pago de la matrícula y portal del alumno
  - **AC ref:** AC-E3, AC-E5

## Fase 5 — Edge functions

- [x] **T5.1** — `generate-payment-report` y `generate-enrollment-sheet`
  - **AC ref:** AC7
  - **DoD:**
    - [x] Código cambiado
    - [x] Desplegadas por Matías

## Fase 6 — Validación y cierre

- [x] **T6.1** — `npm run lint:arch`, `npm run test:ci`, `test-tz`
- [x] **T6.2** — `/verify` (Caja admin y secretaria, ficha, Pagos)
  - **AC ref:** AC1, AC2, AC4, AC5, AC8, AC-E6
- [x] **T6.3** — Índices, `/spec-verify`, ROADMAP

---

## Notas de ejecución (2026-10-13)

- **T1.1:** ningún `UPDATE` a `payments` en la app, las edge functions ni el SQL; los `DELETE` que
  quedan son de borradores (`cleanup_expired_drafts`, `confirm_enrollment_with_payment`, descarte
  y reemplazo del pago en el wizard). La secretaria lee `users` de su sede, sin sede o de ambas:
  si no puede leer a quien anuló, la pantalla dice "Administrador".
- **T6.1:** `npm run test:ci` 4064 en verde, `tsc` limpio, `npm run lint:arch` 0 errores.
- **T1.2 / T5.1:** Matías aplicó la migración, corrió el test SQL (20/20) y desplegó
  `generate-payment-report` y `generate-enrollment-sheet` el 2026-10-13.
- **T6.2:** `/verify` hecho; evidencia y reservas en `acceptance.md`.
