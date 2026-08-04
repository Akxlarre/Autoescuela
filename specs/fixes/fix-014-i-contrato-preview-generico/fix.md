# Fix: Vista previa de contrato distinta al PDF real + texto genérico para Profesional
> id: fix-014-i-contrato-preview-generico
> refs: ASG-b-029
> status: done
> closed: 2026-08-04
> created: 2026-08-01

## Root Cause
Confirmado, en el wizard interno (secretaria/admin):
- **H-022**: el preview (`contract.component.html:159-202`) es HTML hardcodeado con título/cláusulas distintas al PDF real (`buildStructuredPdf` en `supabase/functions/_shared/contract-pdf.ts:128`, título "CONTRATO DE PRESTACIÓN DE SERVICIOS EDUCACIONALES"). La fecha vacía se debe a que `secretaria-matricula.component.ts:309` fija `contractGeneration.generatedAt: null` **siempre**, sin actualizarlo tras `onGenerateContract()` — el PDF real sí calcula su fecha en el momento (`contract-pdf.ts:67`).
- **H-030**: el preview no tiene ningún dato dinámico. El PDF real ya muestra curso/licencia/horas reales y una cláusula de convalidación, pero no tiene cláusula de evaluación/examen final para cursos Profesional.

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- `secretaria-matricula.component.ts`: setear `generatedAt` real tras generar el PDF (signal `_contractGeneratedAt`).
- `enrollment-contract.model.ts`: agregar `isProfessional: boolean`.
- `contract.component.html`: alinear título con el PDF real + párrafo condicional de evaluación/examen final para Profesional.
- `contract-pdf.ts`: agregar cláusula condicional de evaluación/examen final para cursos Profesional (mismo patrón que la cláusula de convalidación).
- Fuera de scope: matrícula pública (`public-enrollment.component.ts`) — no está en el repro original de H-022/H-030 y su flujo de generación de PDF es distinto.

## Test de Regresión
- Sin test unitario existente para `contract.component.ts` (dumb, sin lógica en TS — cambio de template).
- Manual: generar contrato Profesional A2 → preview y PDF muestran la misma fecha y mencionan evaluación/examen final; Clase B → sin esa cláusula, resto sin cambios.
