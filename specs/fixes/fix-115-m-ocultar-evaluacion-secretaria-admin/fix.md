# Fix: Secretaría y Admin no deben ver ni completar evaluación en Iniciar/Finalizar Clase
> id: fix-115-m-ocultar-evaluacion-secretaria-admin
> refs: ASG-b-048
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
[Heredado de ASG-b-048, a confirmar]: La evaluación del alumno (`evaluation_grade`,
`evaluation_checklist`, `performance_notes`) es materia exclusiva del instructor. Sin embargo,
`AdminFinalizarClaseDrawerComponent` — que es literalmente el **mismo componente** usado tanto
por `AdminAsistenciaComponent` como por `SecretariaAsistenciaComponent` (ver
`secretaria-asistencia.component.ts:9-10,95,104`, que importa e instancia directamente los
componentes con prefijo `Admin*`) — le pide Calificación General, Checklist de evaluación y
Observaciones a **cualquiera de los dos roles**, y además **bloquea el cierre de la clase**
si no se completa la nota (`canFinalize()` exige `selectedGrade() !== null`).

**Ampliación de alcance confirmada por el dueño (2026-08-05, no estaba en la Asignación
original):** el pedido no es "ocultar solo de secretaría" — ni admin ni secretaría deben
tocar la evaluación en absoluto, nunca. Es exclusiva del instructor. Además, en la práctica
el instructor **casi nunca evalúa al cerrar la clase**: lo hace después, desde la ficha
técnica del alumno (ya existe una pantalla dedicada para esto:
`instructor-evaluacion.component.ts`, alcanzable desde
`/app/instructor/alumnos/:id/ficha`, que llama a
`InstructorClasesFacade.saveEvaluation()`). La evaluación **nunca** debe ser requisito para
que ninguno de los 3 roles (admin/secretaría/instructor) pueda cerrar una clase — solo el
kilometraje final es obligatorio.

## ⚠️ Aviso técnico heredado (ya no aplica tal como estaba planteado)
La Asignación original advertía que "ocultar en UI no esconde de la API" para la policy
`select_class_b_sessions`. Sigue siendo cierto para **lectura** (secretaría/admin todavía
pueden ver `evaluation_grade` de una clase ya evaluada en otras pantallas, ej. ficha del
alumno — fuera de alcance de este fix), pero el problema central de este track es de
**escritura**: hoy `AdminFinalizarClaseDrawerComponent` deja a admin/secretaría *grabar* una
nota, no solo verla. Eso sí se resuelve completamente sacando los campos del formulario — no
hay API alternativa que permita esa escritura si el frontend no la ofrece (RLS ya limita
`class_b_sessions` UPDATE a los roles esperados; ningún cambio de policy es necesario para
este fix).

## Archivos involucrados
- `src/app/features/admin/asistencia/admin-finalizar-clase-drawer.component.ts` — quitar
  sección "Calificación General", `<app-evaluation-checklist>` y textarea de Observaciones;
  `canFinalize()` deja de exigir `selectedGrade()`; `FinishClassPayload` deja de enviar
  `grade`/`checklist`/`observations` desde este componente.
- `src/app/features/instructor/clase-detail/instructor-clase-detail.component.ts` —
  `canFinalize()`/lógica equivalente deja de exigir `selectedGrade() !== null` para cerrar la
  clase; el checklist/nota/observaciones quedan como opcionales en el flujo de cierre (no se
  retiran del todo porque el instructor sí puede seguir usándolos ahí si quiere evaluar al
  toque — solo dejan de bloquear).
- `src/app/core/models/ui/asistencia-clase-b.model.ts` (`FinishClassPayload`) — revisar si
  `grade` debe pasar a opcional en el tipo si el drawer de admin/secretaría deja de enviarlo.
- `src/app/core/facades/asistencia-clase-b.facade.ts` (`finishClass`, línea ~416) — confirmar
  que `evaluation_grade: payload.grade` tolera `undefined`/`null` sin romper el UPDATE.

## Cambios
- **`admin-finalizar-clase-drawer.component.ts`** (compartido admin/secretaría): eliminada por
  completo la sección "Calificación General" (selector de nota), `<app-evaluation-checklist>`
  y el textarea de Observaciones. `canFinalize()` ahora solo exige kilometraje válido.
  `selectedGrade`, `checklistItems`, `onChecklistChange` y el `FormControl observations` se
  eliminaron del componente. `onFinalize()` construye el payload sin `grade`/`checklist`/
  `observations`. Importaciones de `EvaluationChecklistComponent`,
  `EVALUATION_CHECKLIST_ITEMS`/`EvaluationChecklistItem` removidas.
- **`asistencia-clase-b.model.ts` (`FinishClassPayload`)**: se sacaron los campos `grade`,
  `observations` y `checklist` — el tipo ahora refleja que admin/secretaría nunca envían
  evaluación.
- **`asistencia-clase-b.facade.ts` (`finishClass`)**: el `UPDATE` a `class_b_sessions` ya no
  escribe `evaluation_grade`/`notes`/`evaluation_checklist` — solo cierra status, km_end y
  firmas. Si el instructor ya había evaluado antes de que admin/secretaría cerrara, esos
  valores quedan intactos (antes se sobrescribían con `null`/`undefined`).
- **`instructor-clase-detail.component.ts`**: `canFinalize()` deja de exigir
  `selectedGrade() !== null` — solo el kilometraje de retorno es obligatorio para cerrar la
  clase. `onFinalize()` solo llama a `saveEvaluation()` si el instructor efectivamente
  seleccionó una nota en ese momento; si no, la clase se cierra igual y la evaluación queda
  pendiente para completarse después desde `instructor-evaluacion.component.ts` (ya existente,
  sin cambios). Se agregó "(opcional)" al label de "Calificación General" para que quede
  explícito en la UI.
- No se tocó `instructor-evaluacion.component.ts` ni la policy `select_class_b_sessions` — no
  hacía falta para el alcance acordado.

## Test de Regresión
- `admin-finalizar-clase-drawer.component.spec.ts` — nuevo describe "fix-115-m": (1)
  `canFinalize()` devuelve `true` con solo kilometraje válido, sin nota; (2) el payload pasado
  a `facade.finishClass()` nunca incluye `grade`/`checklist`/`observations`; (3) el componente
  ya no expone `selectedGrade` ni `checklistItems`.
- Suite completa verificada en verde tras el cambio: `admin-finalizar-clase-drawer.component.spec.ts`
  (4/4), `admin-iniciar-clase-drawer.component.spec.ts` (2/2), `asistencia-clase-b.facade.spec.ts`
  (16/16), `instructor-clases.facade.spec.ts` (20/20). `npx tsc --noEmit` sin errores.
  `npm run lint:arch` → 0 errores (169 advertencias pre-existentes, ninguna nueva).
- No se agregó spec nuevo para `instructor-clase-detail.component.ts` (no tenía spec previo;
  fuera del alcance mínimo de este fix, que es acotar el gate, no auditar cobertura previa).

## Notas
- ⚠️ Se solapa con ASG-b-036 (ciclo de vida de la clase) según la Asignación original — ese
  track ya se cerró (`0001-i-ciclo-vida-clase-exclusion-cierre`, 2026-08-04), no debería haber
  conflicto activo, pero repasar su alcance si aparece fricción en `class_b_sessions`.
- No se toca la policy `select_class_b_sessions` ni RLS de lectura — fuera de alcance
  explícito (el dueño no lo pidió por privacidad, sino por higiene de interfaz + regla de
  negocio de "quién evalúa").
- Originado de Asignación ASG-b-048 (specs/assignments/ASG-b-048-ocultar-evaluacion-a-secretaria.md)
