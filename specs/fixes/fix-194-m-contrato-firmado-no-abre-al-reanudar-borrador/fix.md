# Fix: Botón "Contrato Firmado" no abre el PDF al reanudar un borrador de matrícula
> id: fix-194-m-contrato-firmado-no-abre-al-reanudar-borrador
> refs: —
> status: done
> closed: 2026-08-19
> created: 2026-08-19

## Root Cause
`EnrollmentFacade.openContractPdf()` (`src/app/core/facades/enrollment.facade.ts:210`) abre el
contrato firmado leyendo el signal privado `_contractFileUrl`. Ese signal solo se setea dentro de
`uploadSignedContract()` (línea 1200), es decir, únicamente cuando el contrato se sube en la
misma sesión del wizard. Al reanudar un borrador (`resumeDraft()`) cuyo paso ya pasó el 4
(`onStep4Next()` toma la rama `else if (this.enrollment.contractAccepted())` — "re-entrada:
contrato ya aceptado en sesión anterior"), `_contractFileUrl` nunca se rehidrata desde BD. El
botón "Contrato Firmado" en la pantalla de confirmación queda con `path` null y `openContractPdf()`
retorna sin hacer nada, sin error visible.

## ACs Afectados
Ninguno — fix autónomo (bug reportado directamente por el usuario, no ligado a spec previa).
- El botón "Contrato Firmado" de `confirmation.component.html` debe abrir el PDF firmado también
  cuando la matrícula se completó reanudando un borrador previo (no solo en la sesión donde se
  subió el archivo).

## Cambio
- **Archivo:** `src/app/core/facades/enrollment.facade.ts`
- **Qué cambia:** en `resumeDraft()`, agregar rehidratación del paso 4 (contrato): si
  `currentStep >= 4`, consultar `digital_contracts.file_url` por `enrollment_id` y setear
  `_contractFileUrl` con el valor encontrado, igual que ya se hace para los pasos 3 (documentos) y
  5 (pago).

## Test de Regresión
- Verificación manual: reanudar un borrador con contrato ya firmado (paso >= 4), llegar a la
  confirmación y confirmar que "Contrato Firmado" abre el PDF en una pestaña nueva.
