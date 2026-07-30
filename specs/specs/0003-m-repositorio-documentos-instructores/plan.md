# Plan 0003-m — Repositorio de documentos: sección Instructores + poder abrir el archivo

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-07-29

---

## 1. Resumen ejecutivo

Se extiende el módulo DMS existente (`DmsFacade` + `DmsListContentComponent`) con un 4º tab
"Instructores", análogo al ya existente de "Documentos del Alumno", cubriendo únicamente
`instructors` (Clase B). Requiere una tabla nueva (`instructor_documents`, sin columna de
branch propia — se deriva vía join a `users.branch_id`) y reutiliza el visor de archivo ya
existente (`DmsFacade.openDocument()`, signed URL sobre el bucket `documents`). Orden grueso:
migración SQL → modelos UI → extensión del facade → extensión de componentes compartidos
(tab, drawer de subida) → página de detalle nueva → rutas.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260729120000_dms_create_instructor_documents.sql` | Migration | Tabla `instructor_documents` + RLS, análoga a `student_documents` |
| `src/app/features/admin/documentos/instructor-docs-detalle/admin-instructor-docs-detalle.component.ts` | Smart | Subruta `:id` — detalle de documentos de un instructor, calcado de `admin-alumno-docs-detalle.component.ts` (mismo patrón: reutilizable entre admin y secretaría vía `isAdmin()` derivado de `AuthFacade`) |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/models/ui/dms.model.ts` | `DmsTab` += `'instructors'`; nuevas interfaces `InstructorWithDocsRow`, `DmsInstructorDocRow`, `UploadInstructorDocPayload` | Modelos UI del tab nuevo, mismo patrón que `StudentWithDocsRow`/`DmsStudentDocRow` |
| `src/app/core/facades/dms.facade.ts` | Nuevos signals `_instructorsWithDocs`/`_instructorDetail`/`_instructorDocs`/`_instructorDocsLoading`; métodos `loadInstructorDocuments()`, `uploadInstructorDocument()`, `deleteInstructorDocument()`; `fetchAllData()` agrega query de `instructors` con conteo de docs; `openUpload()` y `_currentUploadMode` extienden su tipo a `'student' \| 'school' \| 'instructor'` | Extiende el facade existente — no se crea uno nuevo (regla `facades.md`) |
| `src/app/shared/components/dms-list-content/dms-list-content.component.ts` | Nuevo `@case ('instructors')` (tabla instructores + doc count, calcada de `@case ('students')`); entrada en `tabs`; nuevos `input()`/`output()` (`instructorsWithDocs`, `viewInstructorDocs`, `uploadInstructorDoc`) | Componente Dumb compartido admin/secretaría — un tab más, mismo patrón |
| `src/app/features/admin/documentos/admin-documentos.component.ts` | Pasar `instructorsWithDocs`, handlers `openUploadInstructorDrawer()`, `onViewInstructorDocs()` | Smart page admin |
| `src/app/features/secretaria/documentos/secretaria-documentos.component.ts` | Idem (sin botones de eliminar, `isAdmin=false`, mismo patrón que ya aplica a alumnos) | Smart page secretaría |
| `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts` | `UploadMode` += `'instructor'`; selector de instructor (`p-select` análogo al de alumno); `instructorDocTypes` (enum de sección 6 de spec.md); rama en `onSubmit()` | Drawer compartido de subida |
| `src/app/app.routes.ts` | 2 rutas nuevas: `admin/documentos/instructores/:id` y `secretaria/documentos/instructores/:id`, ambas apuntando al componente nuevo (mismo patrón que `alumnos/:id` hoy, que comparte `AdminAlumnoDocsDetalleComponent` entre ambos árboles de rutas) | Navegación al detalle |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `DmsListContentComponent` — se extiende con un tab más, no se crea un componente Dumb nuevo.
- `DmsUploadDrawerComponent` — se extiende con un modo más, mismo drawer para los 3 flujos de subida.
- Patrón de `admin-alumno-docs-detalle.component.ts` — se calca para el detalle de instructor
  (breadcrumb, header, lista de documentos, botón subir).
- `AlertCardComponent`, `EmptyStateComponent`, `SkeletonBlockComponent`, `IconComponent`,
  `BadgeComponent` — ya importados en los componentes que se modifican, sin cambios.

### Facades/Services existentes que extendemos
- `DmsFacade` — se agregan signals/métodos para instructores, mismo patrón que los 2 dominios
  ya cubiertos (alumno, escuela). **No se crea un facade nuevo** (regla `facades.md` — un
  Facade por dominio ya existente, DMS es el dominio, instructores es un tab más).
- `DmsFacade.openDocument()` / `getSignedDocumentUrl()` — visor de archivo ya genérico sobre
  el bucket `documents`, no requiere ningún cambio para servir documentos de instructor (AC4).
- `resolveBranchScope()` (`branch-scope.utils.ts`) — ya usado en `fetchAllData()` del propio
  `DmsFacade` para `students`; se reutiliza el mismo `branchId` ya calculado para filtrar
  instructores (AC5/AC-E2).

### Componentes/Facades que NO existen y debemos crear
- Ninguno a nivel de componente reutilizable — solo la página de detalle (Smart,
  específica de la ruta `:id`, no es reutilizable por definición, igual que su análoga de
  alumno).

---

## 4. Modelo de datos

### Migración(es) requerida(s)

```sql
-- supabase/migrations/20260729120000_dms_create_instructor_documents.sql
CREATE TABLE IF NOT EXISTS instructor_documents (
  id SERIAL PRIMARY KEY,
  instructor_id INT NOT NULL REFERENCES instructors(id),
  type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_url TEXT NOT NULL, -- path relativo, igual que school_documents/student_documents
  status TEXT NOT NULL DEFAULT 'pending',
  uploaded_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE instructor_documents ENABLE ROW LEVEL SECURITY;

-- Pseudo-SQL — sentencias finales van en tasks.md
-- SELECT: admin sin filtro; secretaria solo instructores de su sede (join a users.branch_id)
-- INSERT/UPDATE: admin y secretaria
-- DELETE: solo admin (mismo criterio que school_documents/student_documents)
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `instructor_documents` | admin | SELECT/INSERT/UPDATE/DELETE | `auth_user_role() = 'admin'` sin filtro de sede |
| `instructor_documents` | secretaria | SELECT/INSERT/UPDATE | `auth_user_role() = 'secretary' AND (auth_can_access_both_branches() OR EXISTS (SELECT 1 FROM instructors i JOIN users u ON u.id = i.user_id WHERE i.id = instructor_documents.instructor_id AND u.branch_id = auth_user_branch_id()))` |
| `instructor_documents` | secretaria | DELETE | — (no permitido, mismo criterio que `student_documents`/`school_documents`: solo admin elimina) |

### Modelos UI/DTO

- `core/models/ui/dms.model.ts` — agrega (sin DTO nuevo separado; sigue el patrón ya usado de
  mapear directo del raw Supabase al UI model dentro del Facade, como `SchoolDocRow`):
  - `InstructorWithDocsRow { instructorId: number; name: string; licenseNumber: string; docCount: number }`
  - `DmsInstructorDocRow { id: number; instructorId: number; type: string; fileName: string; fileUrl: string | null; status: string; documentAt: string; instructorName: string; typeLabel: string }`
  - `UploadInstructorDocPayload { file: File; type: string; instructorId: number }`
  - `DmsTab` pasa a `'students' | 'school' | 'templates' | 'instructors'`

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Usuario (Admin/Secretaría) → AdminDocumentosComponent / SecretariaDocumentosComponent
            ├─ inject(DmsFacade)
            ├─ effect: observa branchId() (ya existente)
            └─ <app-dms-list-content>
                  input: instructorsWithDocs, recentDocs, ...
                  output: viewInstructorDocs(instructorId) → router.navigate(['instructores', id])
                  output: uploadInstructorDoc() → facade.openUpload('instructor')

Router → AdminInstructorDocsDetalleComponent (:id)
            ├─ inject(DmsFacade)
            ├─ ngOnInit: facade.loadInstructorDocuments(id)
            └─ template: lista de DmsInstructorDocRow
                  (click) → facade.openDocument(doc.fileUrl, doc.fileName)  ← AC4, ya existe

DmsUploadDrawerComponent (mode='instructor')
            ├─ p-select instructor (facade.instructorsWithDocs())
            ├─ p-select tipo (instructorDocTypes, enum spec.md §6)
            └─ (submit) → facade.uploadInstructorDocument(payload)
                  → storage.upload('documents', 'instructor-docs/{id}/...')
                  → insert instructor_documents
                  → refreshSilently()
```

### Capas tocadas

- **Smart**: `admin-documentos.component.ts`, `secretaria-documentos.component.ts`,
  `admin-instructor-docs-detalle.component.ts` (nuevo)
- **Dumb**: `dms-list-content.component.ts`, `dms-upload-drawer.component.ts`
- **Facade**: `dms.facade.ts` (extendido)
- **Migration**: `supabase/migrations/20260729120000_dms_create_instructor_documents.sql`

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Patrón Facade (se extiende `DmsFacade`, no se inyecta Supabase en
  componentes), OnPush ya presente en todos los componentes tocados, Signals.
- [x] `facades.md` — Branch-scoped: reutiliza `resolveBranchScope()` ya usado en el mismo
  facade, no se reinventa.
- [x] `models.md` — UI models nuevos en `dms.model.ts` (no hay DTO separado porque, igual que
  `SchoolDocRow`, el mapeo Supabase→UI ocurre directo en el Facade sin tabla `dto/` dedicada;
  consistente con el resto de este mismo módulo).
- [x] `visual-system.md` — Reutiliza tokens y componentes DS ya usados en `dms-list-content`
  (`.bento-card`, `<app-badge>`, `<app-icon>`, sin colores hardcodeados nuevos).
- [ ] `swr-pattern.md` — No aplica cambio: `DmsFacade` ya implementa SWR en `initialize()`, el
  tab nuevo entra dentro del mismo `fetchAllData()` sin lógica SWR adicional.
- [ ] `notifications.md` — No aplica: la subida de documentos usa `ToastService` vía el mismo
  patrón de error ya existente (`ErrorSanitizerService`), no dispara notificaciones persistentes.
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para los métodos nuevos del facade
  (`loadInstructorDocuments`, `uploadInstructorDocument`, `deleteInstructorDocument`, y el
  branch-scope del `fetchAllData()` extendido).
- [x] `ai-readability.md` — `data-llm-action`/`data-llm-nav` en los botones nuevos (subir,
  ver, eliminar documento de instructor), mismo patrón que los tabs existentes.
- [x] `database.md` — Migración idempotente (`CREATE TABLE IF NOT EXISTS`), RLS activada,
  policies documentadas, `indices/DATABASE.md` actualizado al cerrar.

---

## 7. Plan de testing

- Tests unitarios (`dms.facade.spec.ts`, ya existente — extender):
  - `loadInstructorDocuments()` mapea correctamente filas raw → `DmsInstructorDocRow`.
  - `uploadInstructorDocument()` sube el archivo con el path `instructor-docs/{id}/...` e
    inserta en `instructor_documents` con `status: 'pending'`.
  - `deleteInstructorDocument()` borra la fila y refresca.
  - `fetchAllData()` con `branchId !== null` filtra instructores por `users.branch_id`
    (secretaría) y con `branchId === null` no filtra (admin) — mismo test que ya existe para
    `students`, replicado para `instructors`.
- QA manual (golden path + edge cases), vía `/verify` (Playwright):
  - AC1–AC3: tab Instructores visible, detalle abre, subida de documento con tipo del enum.
  - AC4: abrir/previsualizar archivo real de un documento de instructor ya subido.
  - AC5/AC-E2: login como secretaria de una sede → solo ve instructores de esa sede; login
    como admin → ve todos.
  - AC-E1: documento sin archivo (no debería poder existir tras esta spec porque el upload
    siempre requiere archivo — verificar que no queden filas legacy sin `storage_url`, dado
    que la columna es `NOT NULL`).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El enum de tipos de documento (investigado, no asesoría legal formal) queda desactualizado cuando el cliente confirme la lista real | Media | Enum como `TEXT` libre en BD (no `ENUM` de Postgres), igual que `student_documents`/`school_documents` — cambiarlo después es solo actualizar el objeto `instructorDocTypes` en el drawer, sin migración |
| RLS de secretaría mal probada permite ver instructores de otra sede | Baja | Test dedicado en `dms.facade.spec.ts` + verificación manual con 2 usuarios secretaria de sedes distintas antes de cerrar la spec |
| Confusión de scope con `lecturers` (relatores Profesional) durante implementación | Baja | Ya explícito en Out of scope de spec.md — el nombre de tabla `instructor_documents` (no genérico `staff_documents`) ayuda a que el código no se preste a confusión |

---

## 9. Orden de implementación

1. Migración SQL (`instructor_documents` + RLS) + actualizar `indices/DATABASE.md`
2. Modelos UI en `dms.model.ts`
3. Extender `DmsFacade` (signals, métodos, `fetchAllData()`) + `.spec.ts`
4. Extender `DmsListContentComponent` (tab nuevo) + `DmsUploadDrawerComponent` (modo nuevo)
5. Extender `AdminDocumentosComponent` / `SecretariaDocumentosComponent`
6. Crear `AdminInstructorDocsDetalleComponent` + rutas en `app.routes.ts`
7. QA (`npm run test:ci`, `npm run lint:arch`, `/verify` con los 2 roles)
8. Sincronizar `indices/*.md` (DATABASE, FACADES, COMPONENTS, MODELS, ROUTES)

---

## 10. Estimación

M (1–3 días).

---

## Changelog

- 2026-07-29 — plan inicial.
