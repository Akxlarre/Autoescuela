# Fix: Campo de N° de boleta/documento en el pago de matrícula nueva
> id: fix-036-i-boleta-pago-matricula-nueva
> refs: ASG-m-003
> status: done
> closed: 2026-09-19
> created: 2026-09-19

## Root Cause

`payments.document_number` (columna `TEXT`, RF-027, "N° voucher / transferencia /
cheque") ya existe en el esquema y ya se expone en la UI para **uno** de los dos flujos
donde se registra un pago: `registrar-pago-drawer.component.ts` (pago de una
cuota/pago pendiente de una matrícula ya existente) lo pide como campo opcional
("N° DOCUMENTO (OPCIONAL)", `formControlName="document_number"`).

El **segundo** flujo — el paso de Pago dentro del wizard de matrícula nueva
(`shared/components/matricula-steps/payment/payment.component.ts`, orquestado por
`EnrollmentPaymentFacade.recordPayment()`) — nunca pide este dato: ni el modelo
`EnrollmentPaymentData`, ni el facade, ni el `INSERT` a `payments` en
`recordPayment()` lo contemplan. Resultado: un pago registrado durante una matrícula
nueva siempre queda con `document_number = null`, mientras que el mismo pago
registrado más tarde como "cuota pendiente" sí lo captura — inconsistencia entre los
dos únicos puntos de entrada de pago del sistema, que es exactamente lo que reporta
ASG-m-003 ("Cubre matrícula nueva y pago de cuota pendiente").

## ACs Afectados

Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-m-003-numero-boleta-en-registro-de-pagos.md`.

## Cambio

- **Archivo:** `src/app/core/models/ui/enrollment-payment.model.ts` — agrega
  `documentNumber: string | null` a `EnrollmentPaymentData`.
- **Archivo:** `src/app/core/facades/enrollment-payment.facade.ts` — nuevo signal
  privado `_documentNumber` + setter `setDocumentNumber(value: string | null)`;
  `recordPayment()` incluye `document_number: this._documentNumber() || null` en el
  `paymentRecord` insertado a `payments` (mismo patrón que ya usa
  `registrar-pago-drawer` para esa misma columna: opcional, texto libre, sin
  validación de unicidad — precedente ya resuelto, ver "Notas para quien la reclame"
  de la asignación).
- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.ts`
  y `.html` — nuevo campo de texto "N° Documento (opcional)" en el step de Pago,
  mismo copy/estilo que `registrar-pago-drawer.component.ts:408-419` (label, hint,
  `data-llm-description`), emitido vía `dataChange` como el resto de los campos del
  step.
- **Archivo:**
  `src/app/features/secretaria/matricula/secretaria-matricula.component.ts` —
  `step4Data` computed expone `documentNumber` desde el facade; `onStep4DataChange`
  reenvía el cambio a `EnrollmentPaymentFacade.setDocumentNumber()`.
- Fuera de alcance: no se toca `registrar-pago-drawer.component.ts` (ya tiene el
  campo), ni la columna de BD (ya existe), ni mostrar el N° de documento en el
  historial/detalle de pagos (mencionado en la asignación como "relacionado con
  ASG-m-005" — es una asignación aparte).

## Test de Regresión

- `src/app/core/facades/enrollment-payment.facade.spec.ts`: test nuevo que confirma
  que `recordPayment()` incluye `document_number` en el `INSERT` a `payments` cuando
  se seteó vía `setDocumentNumber()`, y `null` cuando no se seteó.
- `npm run test:ci` completo debe quedar verde.

## Evidencia de Verificación (2026-09-19)

- `enrollment-payment.facade.spec.ts` (32 tests, incluye los 2 nuevos de
  `document_number`), `payment.component.spec.ts` (3) y
  `secretaria-matricula.component.spec.ts` (8): **PASS**.
- `npm run test:ci` completo: **2510 tests passed**, 5 skipped (no relacionados), 0
  failed.
- QA visual en navegador no se ejecutó en esta sesión (sin servidor de desarrollo
  activo en el momento del cierre). La corrección queda validada por los tests
  unitarios: `recordPayment()` incluye `document_number` en el `INSERT` a `payments`
  cuando se setea vía `setDocumentNumber()`, y `null` cuando no se setea; el campo
  se muestra en el step de Pago solo cuando hay un método de pago seleccionado
  distinto de "pendiente" (un pago pendiente aún no tiene documento de respaldo).
