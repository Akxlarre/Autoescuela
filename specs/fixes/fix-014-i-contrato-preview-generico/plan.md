# Plan — fix-014-i-contrato-preview-generico

> refs: ASG-b-029

## Root cause confirmada

**H-022 (fecha vacía + texto distinto):**
- El preview del wizard (`contract.component.html:159-202`) es un bloque HTML
  **hardcodeado**, con título y cláusulas distintas a las del PDF real.
- `secretaria-matricula.component.ts:309` (`step4Data`) setea
  `contractGeneration.generatedAt: null` **siempre, sin importar si el PDF ya
  se generó** — nunca se actualiza tras `onGenerateContract()` (línea
  677-682), donde solo se actualizan `_contractPdfUrl` y `_contractStatus`.
  Por eso la fecha del preview siempre sale vacía, incluso después de generar
  el PDF real (que sí calcula su propia fecha en el momento, en
  `contract-pdf.ts:67`).

**H-030 (sin contenido específico Profesional):**
- El preview no tiene ningún dato dinámico (ni curso, ni convalidación, ni
  evaluación/examen).
- El PDF real (`buildStructuredPdf`) ya muestra curso/licencia/horas reales y
  agrega una cláusula "SÉPTIMA" cuando hay convalidación — pero no tiene
  ninguna cláusula sobre evaluaciones/examen final para cursos Profesional.

## Cambio (scope acotado al wizard interno secretaria/admin — la matrícula
pública no tiene el mismo flujo de generación de PDF en ese paso, no está en
el repro original de H-022/H-030)

1. `secretaria-matricula.component.ts`: agregar signal `_contractGeneratedAt`,
   seteado a `new Date().toISOString()` cuando `onGenerateContract()` obtiene
   una URL válida (y a `null` en el reset existente de línea 477-478). Usarlo
   en `step4Data.contractGeneration.generatedAt` en vez del `null` fijo.
2. `enrollment-contract.model.ts`: agregar `isProfessional: boolean` a
   `EnrollmentContractData`, derivado de `pd.courseCategory === 'professional'`
   en `step4Data`.
3. `contract.component.html`: alinear título/estructura del preview con el
   PDF real (mismo título "CONTRATO DE PRESTACIÓN DE SERVICIOS EDUCACIONALES",
   mismos títulos de cláusulas relevantes); agregar párrafo condicional
   (`@if (data().isProfessional)`) mencionando evaluaciones/examen final.
4. `contract-pdf.ts` (`buildStructuredPdf`): agregar cláusula condicional
   (mismo patrón que la de convalidación) cuando el curso es Profesional,
   mencionando evaluaciones y examen final.

## Archivos

- `src/app/features/secretaria/matricula/secretaria-matricula.component.ts`
- `src/app/core/models/ui/enrollment-contract.model.ts`
- `src/app/shared/components/matricula-steps/contract/contract.component.html`
- `supabase/functions/_shared/contract-pdf.ts`

## Test de Regresión

- No hay test unitario existente para `contract.component.ts` (dumb component,
  sin lógica en TS — el cambio es solo de template/HTML condicional).
- Test manual: generar contrato para curso Profesional A2 → preview y PDF
  muestran la misma fecha y mencionan evaluación/examen final; generar para
  Clase B → sin esa cláusula, resto sin cambios.

## ACs

1. `secretaria-matricula.component.ts` fija `generatedAt` real tras generar
   el PDF (ya no `null` fijo).
2. Preview y PDF comparten título y mencionan la misma fecha una vez generado.
3. Cursos Profesional muestran cláusula de evaluación/examen final tanto en
   preview como en PDF; Clase B no la muestra.
