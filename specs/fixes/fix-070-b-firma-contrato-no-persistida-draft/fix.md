# Fix: Firma del contrato no se persiste en el draft de matrícula pública
> id: fix-070-b-firma-contrato-no-persistida-draft
> refs: ASG-b-052
> status: done
> closed: 2026-07-29
> created: 2026-07-29

## Root Cause
[Heredado de ASG-b-052, a confirmar]: el objeto `PublicEnrollmentDraft` que persiste
`saveDraft()` en `public-enrollment.facade.ts` **no incluye `contractSignatureBase64`**.
Confirmado tanto leyendo el código como en un flujo real completo (formulario real, 12
clases reales, foto real, firma real, pago real cancelado en el sandbox de Transbank):
al reanudar la matrícula con `?resume=true&branchId=X`, el wizard aterriza correctamente
en el paso "Contrato" con nombre, curso, horario y foto intactos — pero el checkbox de
aceptación y la firma digital vuelven vacíos, obligando a firmar de nuevo.

No es tan grave como perder todo el draft (eso ya lo resolvió fix-069-b), pero sigue
siendo fricción evitable: el alumno ya firmó una vez y tiene que repetir el trámite.

Alcance sugerido (de la Asignación):
- Agregar `contractSignatureBase64` (y el estado de "términos aceptados") al objeto que
  arma `saveDraft()` en `public-enrollment.facade.ts`.
- Restaurarlo en `restoreDraft()` para que el paso "Contrato" aparezca ya firmado si el
  alumno solo está reanudando tras un pago rechazado (no cambió nada del contrato).

## ACs Afectados
Ninguno — fix autónomo. Hallazgo derivado de fix-069-b (H-033), ver
`specs/fixes/fix-069-b-matricula-publica-varios/fix.md`.

## Cambio
- **Archivo:** `src/app/core/facades/public-enrollment.facade.ts`
  **Qué cambia:**
  1. `PublicEnrollmentDraft` gana el campo `contractSignatureBase64: string | null`.
  2. `saveDraft()` lo incluye en el objeto persistido.
  3. `restoreDraft()` lo restaura en `_contractSignatureBase64`, y si el draft quedó en
     `currentStep: 'contract'` **con firma ya hecha**, salta directo a `'payment'` (el
     mismo salto que hace `confirmContract()`) en vez de repetir el paso de firma.

**Decisión de diseño (no ampliaba archivos tocados):** no se modificó
`PublicContractComponent` (el canvas de firma) para agregar una UI de "firma ya
existente, ¿mantener o rehacer?" — eso hubiera requerido un input/output nuevo en un
componente Dumb y una decisión de UX no pedida en la Asignación. La solución más simple
y ya cubierta por el propio `Alcance sugerido` ("que aparezca ya firmado") es no volver
a mostrar el paso de firma si ya se firmó — se salta directo a pago, sin tocar el Dumb
component.

## Verificación (Playwright, datos realistas)

Con un draft en `currentStep: 'contract'` y `contractSignatureBase64` seteado
(nombre completo, curso, 12 slots reales del flujo de fix-069, `carnetStoragePath` real),
`?resume=true` aterriza directo en **"Revisa y confirma"** (paso 7/8, "Pago"), sin pasar
por el paso "Contrato" — nombre "Ana Torres Rojas", "12 clases agendadas", "$180.000"
correctos. Con un draft equivalente pero `contractSignatureBase64: null`, se queda
correctamente en `'contract'` (test unitario).

## Test de Regresión
- `src/app/core/facades/public-enrollment.facade.spec.ts > draft persistence > restaura la firma y se queda en "contract" si el draft NO tenía firma todavía` ✓
- `src/app/core/facades/public-enrollment.facade.spec.ts > draft persistence > restaura la firma y AVANZA a "payment" si el draft ya tenía el contrato firmado (fix-070)` ✓
- Suite completa: `npm run test:ci` → 1523 passed, 0 failed (2026-07-29)
