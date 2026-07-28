# Fix: Caja Diaria muestra glosa cruda del pago ("online"/"enrollment")
> id: fix-062-b-glosa-cruda-cuadratura
> refs: ASG-030 (specs/assignments/ASG-030-fix-h023-glosa-cruda-caja.md)
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
**Confirmado:** en `/app/secretaria/contabilidad/cuadratura`, `cuadratura.facade.ts:28`
(`mapPaymentToIngreso`) setea `glosa: p.type ?? '—'` — usa el valor crudo de la columna
`payments.type` (`'enrollment'`, `'online'`, `'monthly_fee'`, `'complement'`,
`'special_service'`) sin traducir. La página Pagos (`pagos.facade.ts:22`, función privada
`mapConcepto()`) ya tiene el mapeo correcto (`'enrollment'` → `'Matrícula'`, `'online'` →
`'Online'`, fallback al valor crudo) pero está duplicado/no exportado, así que Caja Diaria no
puede reutilizarlo.

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgo H-023).

## Cambio
- **Nuevo** `src/app/core/utils/payment-concept.utils.ts` — extrae `mapConcepto()` de
  `pagos.facade.ts` a una función pura exportada (Núcleo Funcional, `.claude/rules/architecture.md`),
  mismo comportamiento exacto (sin cambios de lógica, solo movida).
- `src/app/core/facades/pagos.facade.ts` — elimina la definición local de `mapConcepto()`,
  importa la del util nuevo. Los 2 call sites (`row.type` en `L323` y `L511`) quedan iguales.
- `src/app/core/facades/cuadratura.facade.ts` — `mapPaymentToIngreso()` (línea 28): `glosa: p.type ?? '—'`
  → `glosa: mapConcepto(p.type) ?? '—'`.

## Test de Regresión
- **Nuevo** `src/app/core/utils/payment-concept.utils.spec.ts`: casos `'enrollment'` → `'Matrícula'`,
  `'online'` → `'Online'`, tipo desconocido (ej. `'monthly_fee'`) → se devuelve tal cual (fallback),
  `null` → `null`, case-insensitive (`'ENROLLMENT'` → `'Matrícula'`).
- `src/app/core/facades/cuadratura.facade.spec.ts`: se exporta `mapPaymentToIngreso` (mismo
  patrón ya usado en este archivo para `mapSingularSaleToIngreso`) y se testea directo con
  `type: 'enrollment'` → `glosa: 'Matrícula'`, `type: 'online'` → `glosa: 'Online'`,
  `type: null` → `glosa: '—'`. Se evitó extender el mock de Supabase del describe principal
  (no soporta `.in()`, y ningún test existente ejercía `initialize()`) — probar la función pura
  exportada directamente es más simple y sigue el precedente ya establecido en el archivo.
- **Verificación en vivo (parcial, decisión consciente):** se intentó reproducir end-to-end
  insertando pagos sintéticos de hoy vía REST directo (mismo patrón usado en fix-059/fix-061),
  pero `payments` tiene un trigger que valida el monto contra `pending_balance` de la matrícula
  real — no se pudo aislar sin mutar el saldo de un alumno real, y Caja Diaria no tiene selector
  de fecha para verificar con datos históricos sin insertar. Se descartó el insert por riesgo
  sobre datos financieros reales (a diferencia de `class_b_exam_scores`, sin ese trigger).
  Se confirmó en cambio: `ng build`/`ng serve` compila sin errores (detectó y se corrigió un
  error de tipos real: `Payment.type` es `string | null | undefined`, `mapConcepto` amplió su
  firma para aceptarlo) y los 8 tests unitarios (5 del util + 3 del facade) cubren exactamente
  el escenario del bug (`'enrollment'`→`'Matrícula'`, `'online'`→`'Online'`).

## Notas
- Fix acotado al mapeo de concepto — no se rediseña la columna GLOSA / ALUMNO ni se agregan
  conceptos nuevos no solicitados por la asignación.
