# Plan 0007-m — DMS: documentos por matrícula (no por alumno) + unificación de carpetas de Storage

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-08-09

---

## 1. Resumen ejecutivo

`DmsFacade` deja de agrupar los documentos del DMS por `studentId` y pasa a agrupar por
`(studentId, enrollmentId)`, resolviendo sede/N° de matrícula por matrícula (no por la última
del alumno). El drawer de detalle y el de subida propagan ese `enrollmentId` de punta a punta;
el selector genérico de subida se deduplica por alumno y agrega un segundo selector de matrícula
cuando corresponde. Al final, un script mueve los objetos físicos de Storage de `student-docs/`
a `students/{enrollmentId}/` y barre cualquier residuo (Storage API — Supabase bloquea el
`DELETE` directo sobre `storage.objects`, no hay migración SQL para esto).

Orden grueso: (1) modelo UI + facade (grouping, queries, nuevas capacidades) → (2) drawers UI →
(3) migración de datos + limpieza (mismo script).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `scripts/migrate-student-docs-storage.mjs` | Script (Node, fuera de `src/app/`) | Mueve objetos de Storage `student-docs/{studentId}/...` → `students/{enrollmentId}/...` vía `.move()` (service role), actualiza `student_documents.storage_url` en la misma fila, y al final barre (vía Storage API `.remove()`, no SQL) cualquier residuo bajo `student-docs/`. Ejecución manual, una vez. Soporta `--dry-run`. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/dms.model.ts` | `StudentWithDocsRow` gana `enrollmentId: number`. Nueva interfaz `StudentEnrollmentOption { enrollmentId, label, branchName }`. | AC1, AC-E2 |
| `src/app/core/facades/dms.facade.ts` | Ver detalle en §3/§5 — grouping por enrollment, `loadStudentDocuments(studentId, enrollmentId?)`, `preselectedEnrollmentId`, `loadStudentEnrollmentOptions()`, `uploadStudentDocument()` con nuevo path de Storage, `openStudentDocsDrawer`/`openUpload` con `enrollmentId`. | AC1-AC5, AC-E2 |
| `src/app/core/facades/dms.facade.spec.ts` | Nuevos casos (ver §7 Plan de testing). | testing-tdd.md |
| `src/app/shared/components/dms-list-content/dms-list-content.component.ts` | `viewStudentDocs` cambia de `output<number>()` a `output<{studentId: number; enrollmentId: number}>()`. Fila de tabla ya no dedup por alumno (una fila por matrícula, sin cambio visual salvo alumnos con 2+). | AC1, AC2 |
| `src/app/features/admin/documentos/admin-documentos.component.ts` | `onViewStudentDocs()` recibe `{studentId, enrollmentId}` y lo pasa a `facade.openStudentDocsDrawer()`. | AC2 |
| `src/app/features/secretaria/documentos/secretaria-documentos.component.ts` | Idéntico a admin. | AC2 |
| `src/app/features/admin/documentos/dms-student-docs-drawer/dms-student-docs-drawer.component.ts` | Subtítulo con matrícula/sede (`facade.studentDetail()?.matriculaNumber`/`branchName`, nuevos campos). `openUploadDrawer()` pasa `enrollmentId` a `facade.openUpload()`. `onDeleteDoc()` recarga con `loadStudentDocuments(studentId, enrollmentId)`. | AC2, AC3 |
| `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts` | Dropdown de alumnos deduplicado por `studentId` (computed nuevo). Segundo selector "Matrícula" (`p-select`) visible solo si el alumno elegido tiene 2+ matrículas (`facade.studentEnrollmentOptions()`). `usedStudentTypes`/carga de docs ahora se ancla a `(studentId, enrollmentId)`. `onSubmit()` pasa el `enrollmentId` elegido a `uploadStudentDocument()`. | AC3, AC-E2 |
| `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.spec.ts` | Nuevos casos (ver §7). | testing-tdd.md |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-drawer-form>`, `<app-async-btn>`, `<app-skeleton-block>`, `<p-select>` — sin cambios de shell, solo se agrega un segundo `p-select` al mismo patrón ya usado para alumno/instructor en `dms-upload-drawer.component.ts`.
- `<app-dms-list-content>` — ya tiene columnas "N° Mat." y "Sede" (fix ya implementado en spec 0003-m); no se crea tabla nueva, solo cambia qué representa cada fila.

### Facades/Services existentes que extendemos
- `DmsFacade` — se extiende, no se crea. Ya tiene el signal `preselectedStudentId` (análogo directo para `preselectedEnrollmentId`) y el patrón SWR + `createRequestGuard()` (spec 0005-m) que ya protege `fetchAllData()` — no requiere guard nuevo porque no se agrega ningún método `fetchXxxData()` adicional, solo se amplía el existente.
- `sortByPaternalLastNameAsc()`, `buildStudentDisplayName()` (`core/utils/`) — reutilizados tal cual, sin cambios.

### Componentes/Facades que NO existen y debemos crear
- Ninguno. Todo el cambio vive dentro de `DmsFacade` + los 2 drawers ya existentes. No se justifica un Facade nuevo (mismo dominio, mismo Facade dueño) ni un componente nuevo (el "segundo selector" es un `p-select` adicional dentro del drawer ya existente, mismo patrón que el selector de alumno/instructor de al lado).

---

## 4. Modelo de datos

### Migración(es) requerida(s)

Ninguna migración SQL — `student_documents.enrollment_id` y `storage.objects` ya existen, y
Supabase **bloquea el `DELETE` directo sobre `storage.objects`** ("Direct deletion from storage
tables is not allowed. Use the Storage API instead.", confirmado contra Supabase local vía
`npx supabase migration up`). La limpieza de `student-docs/` se hace en
`scripts/migrate-student-docs-storage.mjs` con la Storage API (`.remove()`), no con SQL.

### RLS

Sin cambios — las políticas de Storage no son por prefijo de carpeta (confirmado en spec §6),
así que mover objetos de `student-docs/` a `students/` no tiene impacto de seguridad.

### Modelos UI/DTO

- `core/models/ui/dms.model.ts`:
  - `StudentWithDocsRow` +`enrollmentId: number`.
  - Nueva `StudentEnrollmentOption { enrollmentId: number; label: string; branchName: string | null }` — alimenta el segundo selector del upload drawer. `label` = `"{course.name} · #{number}"`.
- Sin DTOs nuevos — se leen columnas ya existentes (`enrollments.id/branch_id/course_id`, `courses.name`) con selects ampliados.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Lista (dms-list-content)
  fila = 1 por (studentId, enrollmentId)
  click "Ver →" → viewStudentDocs.emit({studentId, enrollmentId})
        │
        ▼
admin/secretaria-documentos.component (Smart)
  onViewStudentDocs({studentId, enrollmentId})
        │
        ▼
DmsFacade.openStudentDocsDrawer(studentId, enrollmentId, name)
  → loadStudentDocuments(studentId, enrollmentId)   // filtra v_dms_student_documents por AMBOS
  → push(DmsStudentDocsDrawerComponent)
        │
        ▼
DmsStudentDocsDrawerComponent (subtítulo: matrícula/sede)
  "Subir documento" → facade.openUpload('student', studentId, enrollmentId)
        │
        ▼
DmsFacade.openUpload(mode, preselectedStudentId, preselectedEnrollmentId)
  → push(DmsUploadDrawerComponent)
        │
        ▼
DmsUploadDrawerComponent
  si preselectedEnrollmentId → oculta ambos selectores, usa ese id directo
  si NO (selector genérico "Subir documento" de cabecera):
    Paso 1: dropdown alumnos DEDUPLICADO (computed local sobre studentsWithDocs())
    al elegir alumno → facade.loadStudentEnrollmentOptions(studentId)
    Paso 2: si options.length > 1 → segundo p-select "Matrícula"
            si options.length === 1 → auto-selecciona esa (sin selector visible, AC4)
  onSubmit() → facade.uploadStudentDocument({..., enrollmentId})
        │
        ▼
DmsFacade.uploadStudentDocument()
  path Storage: students/{enrollmentId}/{Date.now()}_{type}.{ext}
  INSERT student_documents { enrollment_id, ... }
  → refreshSilently()
```

### Capas tocadas

- **Smart**: `features/admin/documentos/admin-documentos.component.ts`, `features/secretaria/documentos/secretaria-documentos.component.ts`, `dms-student-docs-drawer.component.ts`, `dms-upload-drawer.component.ts` (estos 2 drawers son Smart — inyectan `DmsFacade` directo).
- **Dumb**: `shared/components/dms-list-content/dms-list-content.component.ts` (solo cambia el shape del output, sigue sin inyectar Facades).
- **Facade**: `core/facades/dms.facade.ts`.
- **Migration de datos**: `scripts/migrate-student-docs-storage.mjs` (fuera de `src/app/`, ejecución manual con service role) — mueve + limpia, sin migración SQL.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Patrón Facade sin cambios de capa; `DmsListContentComponent` sigue Dumb puro (input/output); OnPush ya presente en todos los archivos tocados.
- [ ] `facades.md` — No aplica branch-scoping nuevo: `DmsFacade` ya es branch-scoped (sin cambios en esa lógica).
- [x] `models.md` — `StudentEnrollmentOption` nuevo va en `core/models/ui/` (no existe en BD tal cual, es UI-only combinando `enrollments`+`courses`+`branches`).
- [ ] `visual-system.md` — Sin componentes/tokens nuevos; el segundo `p-select` reutiliza el patrón visual ya existente en el mismo drawer.
- [x] `swr-pattern.md` — `fetchAllData()` sigue el mismo patrón SWR + `createRequestGuard()` ya implementado (spec 0005-m); no se agrega un `fetchXxxData()` nuevo que requiera guard propio.
- [ ] `notifications.md` — No aplica, sin toasts/notificaciones nuevas.
- [x] `testing-tdd.md` — `dms.facade.ts` y los 2 drawers tienen lógica nueva (grouping, dedupe, selección condicional) → `.spec.ts` obligatorio en los 3.
- [ ] `ai-readability.md` — El segundo selector reutiliza el mismo patrón `data-llm-description` que ya tienen los selectores de alumno/instructor vecinos; sin atributo nuevo que inventar.

---

## 7. Plan de testing

### Tests unitarios — `dms.facade.spec.ts`
- Alumno con 2 enrollments (ambos con docs) → `studentsWithDocs()` produce 2 filas, cada una con su propio `enrollmentId`, `matriculaNumber` y `branchName` resueltos desde **su propio** `enrollments.branch_id` (no desde `users.branch_id`), y `docCount` contando solo los docs de ese `enrollment_id`.
- Alumno con 1 sola matrícula → 1 sola fila (AC-E1, sin regresión).
- `loadStudentDocuments(studentId, enrollmentId)` — filtra `v_dms_student_documents` por AMBOS campos; devuelve solo los docs de esa matrícula aunque el alumno tenga otra con documentos.
- `loadStudentDocuments(studentId)` sin `enrollmentId` — comportamiento legacy sin cambios (usado por callers que aún no lo pasan, ninguno tras este cambio, pero el parámetro es opcional para no romper la firma).
- `loadStudentEnrollmentOptions(studentId)` — devuelve TODAS las matrículas del alumno (no solo las que tienen documentos), con label `"{course.name} · #{number}"` y `branchName` desde `enrollments.branch_id`.
- `uploadStudentDocument()` — construye el path `students/{enrollmentId}/...` (no `student-docs/{studentId}/...`); si no recibe `enrollmentId` cae al fallback existente (última matrícula del alumno, AC4).

### Tests unitarios — `dms-upload-drawer.component.spec.ts`
- Dropdown de alumnos deduplicado: 2 filas de `studentsWithDocs()` con el mismo `studentId` (2 matrículas) → 1 sola entrada en el selector de alumno.
- Alumno con 2+ matrículas elegido desde el selector genérico → aparece el segundo selector "Matrícula"; al elegir una, `onSubmit()` pasa ese `enrollmentId`.
- Alumno con 1 sola matrícula → NO aparece el segundo selector, se auto-asigna ese único `enrollmentId` (AC4/AC-E1 en el flujo de subida).
- `preselectedEnrollmentId` seteado (viene del drawer de detalle) → ambos selectores ocultos, se usa ese id directo (AC3).
- Regresión de fix-147: filtrado de tipos ya subidos sigue funcionando ahora anclado a `(studentId, enrollmentId)` en vez de solo `studentId`.

### QA manual (golden path + edge cases)
- Golden path: alumno con 2 matrículas → 2 filas en la lista → "Ver →" en cada una → detalle muestra solo sus propios docs → subir doc desde ahí queda en esa matrícula.
- Edge case AC-E1: alumno con 1 matrícula, verificar 0 cambios visibles.
- Edge case AC-E2: selector genérico "Subir documento" de cabecera, elegir alumno con 2+ matrículas, verificar selector de matrícula y que el doc sube al `enrollment_id` correcto (revisar en BD).
- Edge case AC-E3: `id_photo` sigue con copy-on-confirm sin tocar (fix-020) — no probar cambios ahí, solo confirmar que no se rompió.
- Migración de Storage: correr `scripts/migrate-student-docs-storage.mjs` contra Supabase local, verificar que los objetos aparecen bajo `students/{enrollmentId}/` y que `student_documents.storage_url` apunta a la ruta nueva (AC5), y que el barrido final del mismo script deja `student-docs/` sin residuos (AC6).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El script de migración de Storage falla a mitad de camino (deja algunos objetos movidos y otros no) | Media | Script debe ser **idempotente por fila**: antes de mover, verificar si el objeto destino ya existe (`.list()`); si ya se movió, skip. Loggear cada operación a stdout para poder re-correr sin duplicar trabajo. |
| Resolver `branchName`/`matriculaNumber` por `enrollments.branch_id` en vez de `users.branch_id` cambia el valor mostrado para alumnos cuya sede de matrícula difiere de su sede de usuario actual | Baja | Es el comportamiento correcto según AC1 ("cada una con su propia sede") — documentar el cambio en el Changelog del facade si `indices/FACADES.md` lo requiere. |
| El segundo selector "Matrícula" queda vacío o con opciones incorrectas si `loadStudentEnrollmentOptions()` falla silenciosamente | Baja | Mismo patrón de `catch` + `_error.set()` que el resto del facade; el drawer debe deshabilitar "Subir documento" (`canSubmit`) si no hay `enrollmentId` resuelto, igual que ya hace con `selectedFile()`/`selectedType()`. |
| El barrido final del script (AC6) borra un objeto que en realidad SÍ tenía una fila en `student_documents` sin migrar (bug en la query de selección) | Baja | El barrido solo corre DESPUÉS del loop de migración de filas de BD, y la lista de residuos se imprime a stdout antes de borrar (visible en `--dry-run`) — permite auditar antes de confirmar en un ambiente con datos reales. |

---

## 9. Orden de implementación

1. `core/models/ui/dms.model.ts` — agregar `enrollmentId` a `StudentWithDocsRow` + `StudentEnrollmentOption`.
2. `core/facades/dms.facade.ts` + `.spec.ts` (TDD: tests primero) — grouping por enrollment, `loadStudentDocuments(studentId, enrollmentId?)`, `loadStudentEnrollmentOptions()`, `preselectedEnrollmentId`, `openStudentDocsDrawer`/`openUpload` con enrollmentId, `uploadStudentDocument()` con el path nuevo.
3. `shared/components/dms-list-content/dms-list-content.component.ts` — output `viewStudentDocs` con `{studentId, enrollmentId}`.
4. `admin-documentos.component.ts` / `secretaria-documentos.component.ts` — propagar el nuevo shape.
5. `dms-student-docs-drawer.component.ts` — subtítulo de matrícula + pasar `enrollmentId` al abrir upload/al recargar tras delete.
6. `dms-upload-drawer.component.ts` + `.spec.ts` (TDD) — dedupe de alumnos, segundo selector condicional, wiring de `enrollmentId` al submit.
7. `npm run test:ci` — verificar todo verde.
8. QA manual golden path + AC-E1/E2/E3 (ver §7).
9. Correr `scripts/migrate-student-docs-storage.mjs` contra Supabase local, verificar AC5 y AC6 (el barrido final es parte del mismo script).
10. `npm run lint:arch` + `/verify` (Playwright) sobre DMS admin/secretaria.

---

## 10. Estimación

M — 1 a 3 días.

---

## Changelog

- 2026-08-09 — plan inicial
- 2026-08-09 — corregido durante implementación: se elimina la migración SQL de limpieza (Supabase
  bloquea `DELETE` directo sobre `storage.objects`); AC6 se cumple con un barrido final dentro del
  mismo `scripts/migrate-student-docs-storage.mjs` vía Storage API.
