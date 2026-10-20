# Fix: Si falla el pago o un documento en el wizard de matrícula, no aparece ningún mensaje
> id: fix-059-i-wizard-error-pago-documentos-mudo
> refs: fix-058-i-testing-matricula-presencial (B2-1, sospecha S10)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Root Cause

El banner de error del wizard (`secretaria-matricula.component.html`) solo pinta
`enrollment.error()`. Los errores del paso Pago quedan en `EnrollmentPaymentFacade.error()` y los
de Documentos en `EnrollmentDocumentsFacade.error()`, que nadie muestra: el spinner se apaga y el
wizard queda en el mismo paso sin explicar por qué. Confirmado en `fix-058-i` (Playwright): con la
RPC del pago respondiendo el aviso de caja cerrada (fix-051-i), `payment.error()` tenía "Error al
registrar pago: La caja del 18-10-2026 ya está cerrada…" y la pantalla no mostraba nada.

## ACs Afectados

Ninguno de una spec — bug encontrado en testing (`fix-058-i` B2-1). Criterios de este fix:

- **AC-F1:** un error del paso Pago se ve en el banner del wizard (ej. "caja cerrada").
- **AC-F2:** un error de Documentos (subir foto o documento) se ve en el mismo banner.
- **AC-F3:** sin errores no hay banner; el error del propio wizard (`enrollment.error()`) se sigue
  mostrando como antes.

## Cambio

- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.ts`
- **Qué cambia:** `computed` `wizardError` = el primero de `enrollment.error()`,
  `payment.error()`, `docs.error()`.
- **Archivo:** `src/app/features/secretaria/matricula/secretaria-matricula.component.html`
- **Qué cambia:** el banner usa `wizardError()`.

## Test de Regresión

- `secretaria-matricula.component.spec.ts` (`wizardError` toma el error del pago y de documentos).
- QA Playwright: RPC del pago con el aviso de caja cerrada → el banner lo muestra.

## Verificación

- 2026-10-20: `secretaria-matricula.component.spec.ts` 24/24 (3 casos nuevos), suite completa 4351,
  `tsc` limpio, `lint:arch` 0 errores.
- QA Playwright como secretaria (sede 2), RPC del pago simulada con el aviso de caja cerrada y el
  resto de las escrituras interceptadas: el banner rojo (`role="alert"`) muestra "Error al registrar
  pago: La caja del 20-10-2026 ya está cerrada: no se puede registrar un pago con esa fecha." y el
  wizard queda en el paso 4.
- Cada acción de Pago y de Documentos limpia su error al empezar, así que el banner no queda pegado
  con un error viejo.
