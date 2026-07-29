# fix-020-m — Re-matrícula de ex-alumnos: guard 3-estados + precarga datos/foto

## Contexto

Un alumno que ya completó un curso puede necesitar volver a matricularse: en el
**mismo curso** (ej. obtuvo la licencia hace años, tuvo un accidente y debe
re-aprender) o en **otro curso** distinto al que cursó. El modelo de datos ya
soporta N matrículas por alumno (`enrollments.student_id`), así que el bloqueo
es puramente una **regla de negocio**, no un límite de esquema.

Hoy esa re-matrícula está rota para el caso del **mismo curso**: el guard de
duplicados trata `completed` igual que `active`, bloqueando en duro. Además, el
wizard **no precarga nada**: para un alumno que vuelve, la secretaria re-tipea
todos los datos a mano (`findUserByRut` solo se usa para los mensajes de
duplicado, no para rellenar el formulario).

Se quiere: (1) permitir re-matrícula con una regla correcta, (2) precargar datos
personales y foto del alumno que vuelve, (3) ofrecer un botón "Re-matricular"
desde la vista de Ex-alumnos que reutilice el **mismo wizard** (sin flujo nuevo).

## Decisiones de negocio (confirmadas con el dueño)

- La re-matrícula la puede **iniciar la secretaria** (no requiere aprobación del
  admin/dueño).
- **Dos puntos de entrada, un solo motor:** "Nueva matrícula" (escribir RUT) y
  "Ex-alumnos" (botón Re-matricular) convergen en el wizard de `EnrollmentFacade`.
  **PROHIBIDO** construir un flujo de matrícula paralelo en Ex-alumnos.
- **Mismo curso completado, flujo público (online, sin secretaria):** NO se
  permite auto-re-matricularse; el sitio muestra un mensaje para **contactar a la
  autoescuela** (que la secretaria lo haga por el flujo interno con confirmación).
  Evita cobros automáticos sin validación humana.
- **Otro curso distinto:** permitido libremente en ambos flujos (ya funciona hoy
  porque el guard filtra por `license_class`).
- **Foto precargada (flujo interno):** se muestra la foto anterior como preview
  pero la secretaria **debe confirmarla o reemplazarla** antes de avanzar. No se
  da por buena automáticamente (un alumno de hace años se ve distinto).
- **Foto en flujo público:** NUNCA se precarga (usuario anónimo → IDOR/PII sobre
  el documento de identidad). El alumno re-sube siempre.

## Hallazgos / Lógica afectada

### Flujo interno (`EnrollmentFacade`)

1. **Guard de duplicados** `core/facades/enrollment.facade.ts`:
   - `checkDuplicateEnrollment` (:456-469) bloquea `['active','pending_payment','completed']`
     por igual. Convertir en veredicto 3-estados.
   - Hay **dos checks divergentes** con mensajes distintos: Step 0 por RUT
     (:481-504) y Step 3.5 tras resolver `courseId` (:559-572). Consolidar ambos
     para que consuman la **misma** función pura.
2. **Función pura nueva** `core/utils/`: `evaluateReenrollment(existingStatus) → 'block' | 'confirm' | 'allow'`.
   - `active` / `pending_payment` / `draft` → `block`
   - `completed` / `cancelled` → `confirm`
   - sin matrícula previa en el curso → `allow`
3. **Precarga de datos** `core/facades/enrollment.facade.ts`:
   - `findUserByRut` (:404) ya devuelve los datos; agregar `prefillFromStudent(rut)`
     que haga `this._personalData.set(...)` para rellenar el form del paso 1.
   - `personal-data.component.ts` (`shared/components/matricula-steps/personal-data/`):
     agregar `onRutBlur` que emita al smart component para disparar la precarga.
   - Botón "Re-matricular" en la vista de Ex-alumnos llama directo a la misma
     precarga y navega al wizard.
4. **Precarga de foto** (interno):
   - Buscar el `id_photo` más reciente de enrollments previos del student
     (`student_documents.type='id_photo'`, scopeado por `enrollment_id`).
   - Mostrar preview con confirmación obligatoria (confirmar / reemplazar).
   - Si reutiliza: copiar el objeto de storage al path del enrollment nuevo
     (`students/{enrollmentId}/id_photo`) + insert en `student_documents`.

### Flujo público (Edge Function)

5. **Guard duplicado en 3 lugares** `supabase/functions/public-enrollment/index.ts`:
   - `handleSubmitClaseB` → `checkDuplicateEnrollmentByLicenseClass` (:597-605)
   - `handleInitiatePayment` → `checkDuplicateByRut` (:928-936)
   - `handleSubmitPreInscription` (:778-792)
   - Espejo de la regla en `supabase/functions/_shared/` (Deno no puede importar
     `core/utils`). La regla de negocio queda escrita en UN solo lugar
     (este `fix.md` / DOMAIN_DICTIONARY) para que ambas copias no diverjan.
   - Mismo curso completado online → mensaje de **derivación a la autoescuela**
     (no auto-permitir). Otro curso → permitir.

## Acceptance Criteria

- [ ] AC1: Un alumno con matrícula `completed` en un curso puede re-matricularse
  en **ese mismo curso** desde el flujo interno, tras un modal de confirmación que
  indica que se crea una matrícula nueva y la anterior queda como historial.
- [ ] AC2: El guard sigue **bloqueando en duro** la re-matrícula cuando existe una
  matrícula `active`, `pending_payment` o `draft` en el mismo curso.
- [ ] AC3: Al ingresar/seleccionar un RUT conocido (blur en "Nueva matrícula" o
  botón "Re-matricular" en Ex-alumnos), el paso 1 del wizard se **precarga** con
  los datos personales del alumno existente. Ambas entradas usan la misma función.
- [ ] AC4: La foto del alumno que vuelve se muestra como preview, pero el avance
  está **bloqueado hasta confirmar o reemplazar**. Al confirmar, la foto se asocia
  (copia) al nuevo enrollment.
- [ ] AC5: En el flujo público, intentar matricularse en un curso ya `completed`
  muestra un mensaje de **derivación a la autoescuela** (no crea matrícula ni
  cobra). Matricularse en otro curso distinto funciona normalmente.
- [ ] AC6: La regla de duplicado está **centralizada**: los 2 checks internos
  consumen la misma función pura `evaluateReenrollment`, sin mensajes/lógica
  divergentes; la Edge Function usa un helper espejo en `_shared/`.

## Test de regresión

- `src/app/core/utils/<reenrollment>.spec.ts` — `evaluateReenrollment`: tabla de
  estados → veredicto (block/confirm/allow), incluido `cancelled`.
- `src/app/core/facades/enrollment.facade.spec.ts` — `savePersonalData` permite
  re-matrícula en mismo curso con `completed` (confirm) y bloquea con `active`;
  `prefillFromStudent` rellena `_personalData`.
- `src/app/core/facades/ex-alumnos.facade.spec.ts` — entrada "Re-matricular"
  resuelve los datos del alumno seleccionado.
