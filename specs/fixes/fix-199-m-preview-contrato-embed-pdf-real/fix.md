# Fix: Preview del contrato del wizard no coincide con el PDF real
> id: fix-199-m-preview-contrato-embed-pdf-real
> refs: fix-192-m-contrato-pdf-no-coincide-con-real
> status: done
> closed: 2026-08-21
> created: 2026-08-21

## Root Cause
`fix-014-i-contrato-preview-generico` alineó el preview HTML del paso "Contrato"
(`contract.component.html:159-213`) con el PDF real de ese momento. Luego
`fix-192-m-contrato-pdf-no-coincide-con-real` reescribió `buildStructuredPdf()`
(`supabase/functions/_shared/contract-pdf.ts`) para replicar el contrato físico real
(membrete por sede, cláusulas PRIMERO–SÉXTIMO reales condicionadas por sede/curso/pago/
convalidación), pero **solo tocó esa Edge Function** — nunca actualizó el preview HTML,
que sigue mostrando el texto genérico anterior (Primera: Objeto del Contrato / Segunda:
Obligaciones del Alumno / Tercera: Vigencia y Devoluciones). El PDF descargable hoy es
fiel al físico; lo que ve el usuario en pantalla antes de descargarlo, no.

Duplicar de nuevo el texto legal en Angular repetiría el mismo problema (dos lugares con
la misma lógica legal que alguien puede volver a desincronizar). En vez de eso, una vez
generado el PDF, el preview embebe el PDF real (mismo documento, cero riesgo de divergir)
con el patrón ya usado en `dms-viewer-modal.component.ts` (`<iframe [src]="url | safe:
'resourceUrl'">`). Antes de generarlo, se muestra un placeholder simple en vez de texto
inventado.

## ACs Afectados
Ninguno — fix autónomo (bug de UI descubierto en UAT, `docs/UAT-PLAN.md`).

## Cambio
- **Archivo:** `src/app/shared/components/matricula-steps/contract/contract.component.html`
  — reemplazar el bloque de preview HTML hardcodeado (líneas 159-213) por: `@if` PDF
  generado → `<iframe [src]="data().contractGeneration.pdfUrl | safe: 'resourceUrl'">`;
  `@else` → placeholder simple ("Genera el PDF para ver la vista previa del contrato").
- **Archivo:** `src/app/shared/components/matricula-steps/contract/contract.component.ts`
  — importar `SafePipe` (`@core/pipes/safe.pipe`) en `imports`.

## Test de Regresión
- Sin test unitario existente para `contract.component.ts` (dumb, sin lógica en TS —
  cambio de template/imports únicamente).
- Manual: generar contrato (Clase B y Profesional) → el preview muestra el PDF real
  embebido, idéntico al que se descarga. Sin PDF generado → placeholder, sin texto legal
  inventado. ✓ Verificado visualmente 2026-08-21 (Clase B, contrato folio N° 0018).
