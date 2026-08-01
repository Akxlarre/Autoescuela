# Fix: Vista previa de contrato distinta al PDF real + texto genérico para Profesional
> id: fix-014-i-contrato-preview-generico
> refs: ASG-b-029
> status: in_progress
> created: 2026-08-01

## Root Cause
[Heredado de ASG-b-029, a confirmar]: 2 hallazgos del mismo módulo (generación de contrato de matrícula):
- **H-022**: en el wizard interno, el HTML de vista previa del contrato tiene estructura y redacción distinta al PDF real generado ("CONTRATO DE PRESTACIÓN DE SERVICIOS DE ENSEÑANZA DE CONDUCCIÓN" vs "...SERVICIOS EDUCACIONALES" en el PDF), y la vista previa muestra la fecha vacía mientras el PDF real sí la trae correcta. El PDF (documento oficial) está bien formado — el problema es solo el HTML de preview.
- **H-030**: el contrato usa idénticamente el mismo texto genérico para Clase B y Profesional — no menciona el curso profesional (A2), la promoción, ni condiciones específicas (evaluaciones, examen final).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- H-022: alinear el HTML de vista previa (`src/app/shared/components/matricula-steps/contract/contract.component.ts`) con el contenido/estructura real del PDF generado (`supabase/functions/generate-contract-pdf/index.ts`), incluyendo que la fecha se calcule igual en ambos lugares.
- H-030: agregar contenido específico para matrículas Profesional (mención del curso/promoción, cláusulas de evaluación/examen final) en vez de reutilizar el texto genérico de Clase B.

## Test de Regresión
- Pendiente de definir al implementar, una vez investigados ambos archivos.
