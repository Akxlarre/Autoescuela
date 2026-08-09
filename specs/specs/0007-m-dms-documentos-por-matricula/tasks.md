# Tasks 0007-m — DMS: documentos por matrícula (no por alumno) + unificación de carpetas de Storage

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-08-09

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Modelo UI

- [x] **T1.1** — Extender `core/models/ui/dms.model.ts`
  - **AC ref:** AC1, AC-E2
  - **DoD:**
    - [x] `StudentWithDocsRow` gana `enrollmentId: number`
    - [x] Nueva interfaz `StudentEnrollmentOption { enrollmentId: number; label: string; branchName: string | null }`
    - [x] Documentado en `indices/MODELS.md`

---

## Fase 2 — Capa Facade

- [x] **T2.1** — Escribir/extender `dms.facade.spec.ts` PRIMERO (TDD) con los casos nuevos
  - **DoD:**
    - [x] Caso: alumno con 2 enrollments con docs → 2 filas en `studentsWithDocs()`, `matriculaNumber`/`branchName` resueltos desde **`enrollments.branch_id`** de cada fila (no `users.branch_id`), `docCount` solo de ese `enrollment_id`
    - [x] Caso: alumno con 1 sola matrícula → 1 fila, sin cambios visibles (AC-E1)
    - [x] Caso: `loadStudentDocuments(studentId, enrollmentId)` filtra por ambos campos, aunque exista otra matrícula del mismo alumno con documentos
    - [x] Caso: `loadStudentEnrollmentOptions(studentId)` devuelve TODAS las matrículas (no solo las con documentos), con `label` `"{course.name} · #{number}"`
    - [x] Caso: `uploadStudentDocument()` construye el path `students/{enrollmentId}/...`; sin `enrollmentId` cae al fallback existente (última matrícula, AC4)
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T2.2** — Implementar cambios en `dms.facade.ts` — grouping y queries
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] `studentsQuery` amplía el select de `enrollments` a `id, number, created_at, branch_id, branches(name)`
    - [x] `fetchAllData()` agrupa `studentDocCount`/`studentsWithDocsUnsorted` por `(studentId, enrollmentId)` en vez de solo `studentId`
    - [x] `matriculaNumber`/`branchName` de cada fila se resuelven desde el `enrollment` correspondiente, no desde `latestEnrollment` del alumno
    - [x] Tests de T2.1 relacionados PASAN

- [x] **T2.3** — Implementar `loadStudentDocuments(studentId, enrollmentId?)` y `loadStudentEnrollmentOptions(studentId)`
  - **AC ref:** AC2, AC-E2
  - **DoD:**
    - [x] `loadStudentDocuments` acepta `enrollmentId` opcional y agrega `.eq('enrollment_id', enrollmentId)` cuando viene
    - [x] `loadStudentEnrollmentOptions` es un método nuevo, expone su resultado vía un signal readonly nuevo (`studentEnrollmentOptions`)
    - [x] Tests de T2.1 relacionados PASAN

- [x] **T2.4** — Propagar `enrollmentId` en el flujo de apertura de drawers
  - **AC ref:** AC2, AC3
  - **DoD:**
    - [x] Nuevo signal privado/público `preselectedEnrollmentId` (análogo a `preselectedStudentId`)
    - [x] `openStudentDocsDrawer(studentId, enrollmentId, name)` — llama `loadStudentDocuments(studentId, enrollmentId)` y guarda `enrollmentId` en `_studentDetail`
    - [x] `_studentDetail` gana el campo `enrollmentId`
    - [x] `openUpload(mode, preselectedStudentId, preselectedEnrollmentId?)` — nuevo parámetro opcional
    - [x] `notifyUploadSaved()` recarga `loadStudentDocuments(studentId, enrollmentId)` cuando ambos están presentes

- [x] **T2.5** — Actualizar `uploadStudentDocument()` al nuevo path de Storage
  - **AC ref:** AC3
  - **DoD:**
    - [x] Path cambia de `student-docs/{studentId}/...` a `students/{enrollmentId}/...`
    - [x] Fallback de "última matrícula del alumno" se mantiene intacto si `payload.enrollmentId` no viene (AC4)
    - [x] Tests PASAN (`npm run test:ci`)
    - [x] Documentado en `indices/FACADES.md`

---

## Fase 3 — Capa UI

- [x] **T3.1** — Actualizar `dms-list-content.component.ts`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] `viewStudentDocs` cambia de `output<number>()` a `output<{studentId: number; enrollmentId: number}>()`
    - [x] Template: `(click)="viewStudentDocs.emit({studentId: row.studentId, enrollmentId: row.enrollmentId})"`
    - [x] Sin cambios visuales para alumnos con 1 sola matrícula (AC-E1)
    - [x] Documentado en `indices/COMPONENTS.md`

- [x] **T3.2** — Actualizar `admin-documentos.component.ts` y `secretaria-documentos.component.ts`
  - **AC ref:** AC2
  - **DoD:**
    - [x] `onViewStudentDocs()` recibe `{studentId, enrollmentId}` y los pasa a `facade.openStudentDocsDrawer(studentId, enrollmentId, name)`
    - [x] `name` sigue resolviéndose buscando la fila en `facade.studentsWithDocs()` por `(studentId, enrollmentId)`
    - [x] Cambio replicado idéntico en ambos archivos (admin/secretaria)

- [x] **T3.3** — Actualizar `dms-student-docs-drawer.component.ts`
  - **AC ref:** AC2, AC3
  - **DoD:**
    - [x] Subtítulo/línea de contexto muestra matrícula y sede (computed `matriculaSubtitle`, deriva de `studentsWithDocs()` cruzado con `studentDetail()`)
    - [x] `openUploadDrawer()` pasa `enrollmentId` a `facade.openUpload('student', studentId, enrollmentId)`
    - [x] `onDeleteDoc()` recarga con `facade.loadStudentDocuments(studentId, enrollmentId)` (no solo `studentId`)

- [x] **T3.4** — Actualizar `dms-upload-drawer.component.ts` — dedupe + segundo selector
  - **AC ref:** AC3, AC-E2, AC4
  - **DoD:**
    - [x] Nuevo `computed()` local que deduplica `facade.studentsWithDocs()` por `studentId` para el dropdown de alumnos (paso 1)
    - [x] Al elegir alumno (sin `preselectedEnrollmentId`), llama `facade.loadStudentEnrollmentOptions(studentId)`
    - [x] Si `studentEnrollmentOptions().length > 1` → muestra segundo `p-select` "Matrícula"; si `=== 1` → auto-selecciona esa sin mostrar el selector (AC4/AC-E1)
    - [x] Si `preselectedEnrollmentId` viene seteado → oculta el segundo selector, usa ese id directo (AC3)
    - [x] `usedStudentTypes` se ancla a `(studentId, enrollmentId)` en vez de solo `studentId` (extiende fix-147 sin duplicar su lógica)
    - [x] `onSubmit()` incluye `enrollmentId` en el payload de `uploadStudentDocument()`
    - [x] `canSubmit()` exige `enrollmentId` resuelto antes de habilitar el botón

---

## Fase 4 — Conexión

- [x] **T4.1** — Verificación de wire-up end-to-end en browser (sin AC formal, previo a QA)
  - **DoD:**
    - [x] Lista → "Ver →" → detalle correcto (subtítulo "Matrícula #0019 — Conductores Chillán") → "Subir documento" → alumno/matrícula preseleccionados, tipos ya subidos filtrados, sin errores de consola (verificado con Playwright MCP contra `ng serve` real, login admin@test.com)

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (0 errores, warnings pre-existentes sin relación a esta spec)
- [x] **T5.2** — `npm run test:ci` corre verde (`dms.facade.spec.ts` 23/23, `dms-upload-drawer.component.spec.ts` 5/5, `npx tsc --noEmit` sin errores)
- [x] **T5.3** — QA manual del happy path + edge cases funcionales (AC1-AC4, AC-E1, AC-E3 verificados en browser real por Claude; AC-E2 verificado por tests unitarios + confirmación visual personal del owner)
  - **DoD:** Cada AC marcado con evidencia en `acceptance.md`

---

## Fase 6 — Migración de datos (Storage)

- [x] **T6.1** — Crear y correr `scripts/migrate-student-docs-storage.mjs`
  - **AC ref:** AC5, AC6
  - **DoD:**
    - [x] Usa Storage API `.move()` (service role), no `UPDATE storage.objects` directo
    - [x] Idempotente por fila: si el destino ya existe, hace skip (permite re-correr sin duplicar)
    - [x] Actualiza `student_documents.storage_url` a la ruta nueva en la misma fila movida
    - [x] Loguea cada operación a stdout
    - [x] Corrido contra Supabase local, verificado: sin objetos bajo `student-docs/{studentId}/...` (dataset local no tenía ninguno — 0 movidos, 0 residuos)
    - [x] Barrido final (AC6) vía Storage API `.remove()` — **NO migración SQL**: Supabase bloquea `DELETE` directo sobre `storage.objects` ("Direct deletion from storage tables is not allowed", confirmado con `npx supabase migration up`)

---

## Fase 7 — Cierre

- [x] **T7.1** — Ejecutar `/spec-verify` — `acceptance.md` generado, 9/9 AC cumplidos, ✅ PASA

- [x] **T7.2** — `/verify` (Playwright) sobre DMS admin/secretaria — golden path + AC-E2 (verificado por Claude vía Playwright MCP + confirmación visual personal del owner para AC-E2)
- [ ] **T7.3** — Actualizar `indices/` con todo lo nuevo (`/sync-indices`)
- [ ] **T7.4** — Marcar spec como `done` en `ROADMAP.md`
- [ ] **T7.5** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [x] Supabase bloquea `DELETE` directo sobre `storage.objects` (guardrail interno de Storage) — la migración SQL de limpieza planeada en T6.2/AC6 no es viable. Resuelto moviendo la limpieza al mismo script `.mjs` vía Storage API `.remove()`. Ver Changelog de `plan.md`/`spec.md`.
