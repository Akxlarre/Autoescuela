# Fix: "Ver" evaluación en Ficha Técnica no muestra lo guardado y permite reeditar
> id: fix-121-b-evaluacion-ver-reutiliza-form-editable
> refs: fix-117-b-cierre-clase-orden-nota-y-pasos
> status: done
> closed: 2026-08-07
> created: 2026-08-04

## Root Cause

En `instructor-ficha.component.ts` (tabla "Ficha Técnica"), cuando una clase ya fue evaluada
(`row.status === 'completed'` y `!row.canEvaluate`) el link "Ver" apunta a la misma ruta que
"Evaluar Clase": `/app/instructor/alumnos/:id/evaluacion/:sessionId` →
`InstructorEvaluacionComponent`.

Dos problemas, misma causa raíz (el componente nunca distinguió "evaluar" de "revisar"):

1. **No carga los datos guardados.** `checklistItems` se inicializa siempre desde
   `EVALUATION_CHECKLIST_ITEMS` con todo en `checked: true` (`instructor-evaluacion.component.ts`
   línea ~275), y `evalForm` arranca con `grade: null` / `observations: ''`, sin leer nunca
   `cls.evaluationGrade`, `cls.evaluationChecklist` ni `cls.notes` — a diferencia de
   `InstructorClaseDetailComponent`, que sí sincroniza esos campos vía `effect()`. Además, ni
   siquiera es posible cargarlos hoy: el `select` de `loadClassDetail()` en
   `instructor-clases.facade.ts` (línea ~168) no pide `evaluation_checklist` ni las columnas de
   firma. Resultado: "Ver" muestra un formulario en blanco, no la evaluación real.

   > ⚠️ Corrección durante la implementación: el `fix.md` original asumía columnas
   > `student_signature_url`/`instructor_signature_url` (texto/URL) en `class_b_sessions`,
   > copiadas de lo que escribe `saveEvaluation()` (línea ~370). Verificado el schema real vía
   > Supabase MCP (`information_schema.columns`): esas columnas **no existen**. Las reales son
   > `student_signature`/`instructor_signature` — **booleanas**, sin URL de imagen. Es decir,
   > `saveEvaluation()` tiene un bug preexistente y no relacionado (intenta hacer `UPDATE` contra
   > columnas inexistentes → falla siempre con 42703) — **no se toca en este fix**, queda anotado
   > para un fix aparte. Este fix usa las columnas reales (`student_signature`/
   > `instructor_signature`) y muestra un estado "Firmado"/"Sin firma registrada" en vez de una
   > imagen (no hay imagen que mostrar en este schema).
2. **Nada impide reenviar.** Al no haber modo de solo lectura, el instructor puede tocar
   checklist/nota/observaciones/firmas de una clase ya cerrada y pisar la evaluación original con
   `submit()`.

## ACs Afectados

Ninguno — fix autónomo, hallazgo de UX/datos sobre una pantalla en producción, sin spec previa.

## Cambio

- **`src/app/core/models/ui/instructor-portal.model.ts`** — agrega `studentSigned: boolean` e
  `instructorSigned: boolean` a `InstructorClassRow`.
- **`src/app/core/facades/instructor-clases.facade.ts`**:
  - `loadClassDetail()`: agrega `evaluation_checklist, student_signature, instructor_signature`
    al `select` (columnas reales, ver nota arriba).
  - `mapSessionToRow()` y `getMockClasses()`: agregan los dos campos nuevos mapeados desde
    `row.student_signature`/`row.instructor_signature` (booleanos).
- **`src/app/features/instructor/evaluacion/instructor-evaluacion.component.ts`**:
  - `readonlyMode = computed(...)`: `true` cuando `cls.status === 'completed' && !cls.canEvaluate`.
  - `effect()` en el constructor: si `cls.evaluationChecklist`/`notes`/`evaluationGrade` vienen
    con datos, precargan `checklistItems` y `evalForm` (mismo patrón que
    `InstructorClaseDetailComponent`); si `readonlyMode()`, deshabilita `evalForm`.
  - `canAdvance()`: en modo lectura no bloquea el avance de paso por validez del form (un control
    `disabled` nunca es `.valid`, así que sin este bypass "Siguiente" quedaría permanentemente
    deshabilitado).
  - Paso 3: en modo lectura no renderiza `<app-signature-pad>` (canvas editable) — muestra un
    indicador "Firmado" (ícono `check-circle`) o "Sin firma registrada" según
    `cls.studentSigned`/`instructorSigned`.
  - Footer: en modo lectura el último paso muestra un botón "Volver" en vez de "Finalizar
    Evaluación" (no se puede reenviar `submit()`).
  - Badge "Modo lectura" (`app-badge` variant `info`) junto al título cuando `readonlyMode()`.
- **`src/app/shared/components/evaluation-checklist/evaluation-checklist.component.ts`** — nuevo
  input opcional `readonly` (default `false`): bloquea `toggleItem()` y aplica estilo deshabilitado
  al botón. Backward-compatible — el único otro consumidor (`InstructorClaseDetailComponent`) no
  pasa el input y sigue editable.

## Test de Regresión

- `instructor-clases.facade.spec.ts` — 2 casos nuevos en `describe('loadClassDetail')`: mapea
  `student_signature`/`instructor_signature` (booleanos) a `studentSigned`/`instructorSigned`, y
  `evaluation_checklist` a `evaluationChecklist`.
- Verificación manual en `ng serve` (real, contra Supabase remoto — no mock): entrar a Ficha
  Técnica de un alumno con una clase `completed`, click en "Ver" → el checklist y la nota deben
  reflejar lo guardado (no todo marcado/nota vacía), los controles deben estar deshabilitados, el
  paso 3 debe mostrar "Firmado"/"Sin firma registrada" según corresponda, y el último paso debe
  mostrar "Volver" sin poder reenviar.
- `npx ng build` sin errores.
