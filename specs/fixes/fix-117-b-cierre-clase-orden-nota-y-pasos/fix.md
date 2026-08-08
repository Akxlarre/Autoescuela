# Fix: Cierre de clase (evaluación práctica) — reordenar Nota Global y dividir en pasos
> id: fix-117-b-cierre-clase-orden-nota-y-pasos
> refs: —
> status: done
> closed: 2026-08-07
> created: 2026-08-04

## Root Cause

`InstructorEvaluacionComponent` (formulario de cierre de clase que usa el instructor) presenta
todo el formulario en una sola card con scroll largo, en el orden: **Nota Global → Checklist de
aspectos a evaluar → Observaciones → Firmas** (`instructor-evaluacion.component.ts:101-174`).

Esto invierte el orden natural de evaluación: se le pide al instructor una calificación global
*antes* de repasar los 7 aspectos concretos (control de volante, espejos, frenado, etc.) que
deberían sustentar esa nota. Además, al ser un único scroll largo con checklist + nota +
observaciones + firmas, no hay foco por etapa — el instructor completa todo de una pasada, típico
uso desde el celular al lado del vehículo.

**Contexto adicional (hallado durante la investigación):** existe un segundo flujo de cierre,
`InstructorClaseDetailComponent` (`/app/instructor/clase/:id`, ruta a la que navega
`instructor-clase.component.ts` tras iniciar la clase), que **ya** resuelve este mismo problema
correctamente — 2 pasos (checklist+observaciones, luego km final + calificación + firmas), nota
después del checklist. Ese componente NO se toca en este fix. `InstructorEvaluacionComponent` es
un segundo punto de entrada independiente (enlazado desde `instructor-horario.component.ts` para
evaluar una sesión ya cerrada, sin captura de km) que quedó con el diseño antiguo de un solo
scroll — este fix lo alinea al mismo criterio de orden/pasos, sin fusionar ambos componentes.

## ACs Afectados

Ninguno — fix autónomo, ajuste de UX sobre una pantalla ya en producción, sin spec previa.

## Cambio

- **Archivo:** `src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts`
- **Qué cambia:**
  1. Reordena el bloque "Nota Global" para que quede **después** del checklist de aspectos a
     evaluar (antes iba primero).
  2. Convierte el formulario en un wizard de 3 pasos secuenciales dentro del mismo componente
     (sin nuevas rutas): **Paso 1 — Checklist + Nota Global**, **Paso 2 — Observaciones**,
     **Paso 3 — Firmas**. Navegación con Siguiente/Atrás; el submit final ("Finalizar
     Evaluación") solo aparece en el último paso. Se reutiliza el mismo `FormGroup` reactivo
     existente — no cambia el modelo de datos ni el contrato con `InstructorClasesFacade`.

## Test de Regresión

- Verificación manual/`/verify` (Playwright) en `ng serve`: abrir
  `/app/instructor/alumnos/:id/evaluacion/:sessionId`, confirmar que el Paso 1 muestra checklist
  arriba y Nota Global debajo, que no se puede avanzar de paso con el form inválido (nota
  obligatoria), y que las firmas y el submit final quedan en el Paso 3. Sin errores de consola.
- `npx ng build` sin errores (no hay lógica nueva testeable en `core/`, es reordenamiento +
  estado de wizard dentro de un Smart Component sin `computed()` de negocio).
