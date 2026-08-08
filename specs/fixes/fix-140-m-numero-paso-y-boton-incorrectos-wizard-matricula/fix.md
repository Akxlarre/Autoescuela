# Fix: Número de paso y botón incorrectos en Contrato/Pago del wizard de matrícula
> id: fix-140-m-numero-paso-y-boton-incorrectos-wizard-matricula
> refs: —
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause
En el wizard de matrícula de secretaria/admin (`secretaria-matricula.component.html`), el
paso de Contrato es en realidad el paso 4 de 6 (Personal → Asignación → Documentos →
**Contrato** → Pago → Confirmación), pero su botón de acción decía "Confirmar y Finalizar"
(sugiriendo que es el último paso, cuando en realidad avanza a Pago). El paso de Pago
(paso 5) además tenía el número de paso hardcodeado como "Paso 4" en su título, en vez de
recibirlo como input dinámico igual que el resto de los pasos del wizard.

## ACs Afectados
- Ninguno — fix autónomo (bug de copy/label detectado en QA visual manual, no en una spec).

## Cambio
- **Archivo:** `src/app/shared/components/matricula-steps/contract/contract.component.html`
  **Qué cambia:** el botón del flujo no-público pasa de "Confirmar y Finalizar" a "Continuar
  al Pago" (mismo texto que ya usaba el flujo público), ya que este paso no finaliza la
  matrícula.
- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.ts`
  **Qué cambia:** se agrega `stepNumber = input<number>(5);` para que el número de paso sea
  configurable como en `ContractComponent`.
- **Archivo:** `src/app/shared/components/matricula-steps/payment/payment.component.html`
  **Qué cambia:** el título hardcodeado "Paso 4: ..." pasa a `Paso {{ stepNumber() }}: ...`.
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.html`
  **Qué cambia:** se pasa `[stepNumber]="5"` explícito a `<app-payment-step>`, igual que ya
  se hace con `[stepNumber]="4"` en `<app-contract-step>`.

## Test de Regresión
- Verificación visual manual (QA): en el wizard de matrícula (secretaria/admin), el paso de
  Contrato muestra "Paso 4" y botón "Continuar al Pago"; el paso de Pago muestra "Paso 5" y
  botón "Confirmar y Finalizar" (este sí finaliza la matrícula vía `confirmWithPayment()`).
