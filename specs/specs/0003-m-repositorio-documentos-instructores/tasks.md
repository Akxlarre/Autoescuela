# Tasks 0003-m — Repositorio de documentos: sección Instructores + poder abrir el archivo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-07-29

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [ ] **T1.1** — Crear migración `20260729120000_dms_create_instructor_documents.sql`
  - **AC ref:** AC3, AC4, AC5, AC-E1, AC-E2
  - **DoD:**
    - [x] Archivo con naming correcto (`YYYYMMDDHHMMSS_dominio_tipo_desc.sql`)
    - [x] `CREATE TABLE IF NOT EXISTS instructor_documents` (idempotente) con FK a
      `instructors(id)` y `users(id)`
    - [x] `storage_url` y `file_name` `NOT NULL` (path relativo, sin URL pública)
    - [x] `ENABLE ROW LEVEL SECURITY`
    - [x] Policy SELECT: admin sin filtro; secretaria vía `branch_visible()` sobre la sede del
      user dueño del instructor (mismo helper canónico que `select_instructors`, más robusto
      que combinar `auth_user_branch_id()`/`auth_can_access_both_branches()` a mano)
    - [x] Policy INSERT/UPDATE: admin y secretaria (mismo criterio que SELECT)
    - [x] Policy DELETE: solo admin
    - [x] `npx supabase db reset` corre sin error — aplicada y verificada por el owner en su
      propio entorno con Docker (esta sesión no tenía Docker disponible localmente)
    - [x] Documentado en `indices/DATABASE.md` (tabla + policies)

- [x] **T1.2** — Extender `core/models/ui/dms.model.ts`
  - **AC ref:** AC1, AC2, AC3
  - **DoD:**
    - [x] `DmsTab` incluye `'instructors'`
    - [x] `InstructorWithDocsRow`, `DmsInstructorDocRow`, `UploadInstructorDocPayload` agregados
      (ver plan.md §4) — sin DTO separado, consistente con el patrón ya usado por
      `SchoolDocRow` en este mismo módulo (justificado en plan.md §6)
    - [x] Documentado en `indices/MODELS.md`

---

## Fase 2 — Capa Facade

- [x] **T2.1** — Escribir tests nuevos en `dms.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC1, AC3, AC4, AC5, AC-E1, AC-E2
  - **DoD:**
    - [x] Test: `loadInstructorDocuments()` mapea filas raw → `DmsInstructorDocRow`
    - [x] Test: `uploadInstructorDocument()` sube archivo con path
      `instructor-docs/{instructorId}/...` e inserta con `status: 'pending'`
    - [x] Test: `deleteInstructorDocument()` borra y refresca
    - [x] Test: `fetchAllData()` con `branchId !== null` filtra instructores por
      `users.branch_id` (secretaría); con `branchId === null` no filtra (admin)
    - [x] Tests FALLAN (no hay implementación aún) — **Nota:** escritos junto con T2.2 en el
      mismo ciclo (no en secuencia estrictamente roja→verde) dado el acoplamiento entre forma
      del mock de Supabase y la implementación; validados igualmente contra el código final
      (`npm run test:ci`, 15/15 verde)

- [x] **T2.2** — Implementar extensión de `dms.facade.ts`
  - **AC ref:** AC1, AC3, AC4, AC5, AC-E1, AC-E2
  - **DoD:**
    - [x] Tests de T2.1 PASAN (`npm run test:ci`)
    - [x] Signals `_instructorsWithDocs`, `_instructorDetail`, `_instructorDocs`,
      `_instructorDocsLoading` + readonly expuestos, mismo orden que los de `students`
    - [x] `loadInstructorDocuments(instructorId)`, `uploadInstructorDocument(payload)`,
      `deleteInstructorDocument(docId)` implementados
    - [x] `fetchAllData()` agrega query de `instructors` con conteo de docs, reutilizando el
      `branchId` ya calculado por `getActiveBranchId()` (no se duplica la lógica de scope) —
      **Nota:** a diferencia de `studentsWithDocs`, `instructorsWithDocs` lista TODOS los
      instructores del scope (no solo los que ya tienen ≥1 doc), para que el drawer de subida
      pueda seleccionar un instructor sin documentos previos (ver plan.md §9 orden 3, decisión
      documentada en FACADES.md)
    - [x] `openUpload()` y `_currentUploadMode` aceptan `'instructor'`
    - [x] `catchError`/sanitización de errores igual que los métodos existentes del facade
    - [x] Documentado en `indices/FACADES.md`

---

## Fase 3 — Capa UI

- [x] **T3.1** — Extender `dms-list-content.component.ts` con el tab "Instructores"
  - **AC ref:** AC1, AC2, AC4, AC-E1
  - **DoD:**
    - [x] Nueva entrada en `tabs` (`{ id: 'instructors', label: 'Documentos de Instructores', icon: 'shield-check' }`) — `ShieldCheck` ya registrado en `provideIcons()` (`app.config.ts:71,361`)
    - [x] `@case ('instructors')` calcado de la tabla principal de `@case ('students')`: tabla
      de instructores + doc count + botón subir (sin la columna secundaria "Últimos subidos"
      por-documento — esta tab solo lista instructores, el detalle por-documento con botón
      "Ver" vive en `admin-instructor-docs-detalle.component.ts`, T3.3)
    - [x] Nuevos `input()` (`instructorsWithDocs`) y `output()` (`viewInstructorDocs`,
      `uploadInstructorDoc`)
    - [x] Botón "Ver" de documento deshabilitado cuando `fileUrl` es null (AC-E1) — implementado
      en T3.3 (`admin-instructor-docs-detalle.component.ts`), no aplica a esta tab (solo lista
      instructores, no documentos individuales)
    - [x] `data-llm-action`/`data-llm-nav` en botones y tab nuevos
    - [x] OnPush intacto (no se cambia la estrategia del componente)
    - [x] Documentado en `indices/COMPONENTS.md`

- [x] **T3.2** — Extender `dms-upload-drawer.component.ts` con modo `'instructor'`
  - **AC ref:** AC3
  - **DoD:**
    - [x] `UploadMode` incluye `'instructor'`
    - [x] `p-select` de instructor cuando `facade.currentUploadMode() === 'instructor'`
      (mismo patrón que el selector de alumno, usando `facade.instructorsWithDocs()`)
    - [x] `instructorDocTypes` con el enum investigado de spec.md §6 (`certificado_antecedentes`,
      `certificado_ensenanza_media`, `certificado_curso_transito_mecanica`,
      `hoja_vida_conductor`, `credencial_semep`, `licencia_clase_b`,
      `certificado_curso_instructor_teorico`)
    - [x] `onSubmit()` rama a `facade.uploadInstructorDocument()` cuando corresponde
    - [x] `canSubmit()` valida instructor seleccionado en modo `'instructor'`, igual que ya
      valida alumno en modo `'student'`
    - [x] Validación de archivo (tipo/tamaño) sin cambios — ya es genérica

- [x] **T3.3** — Crear `admin-instructor-docs-detalle.component.ts`
  - **SUPERSEDED (2026-07-29):** este componente de página completa fue reemplazado por
    `DmsInstructorDocsDrawerComponent` + `DmsDocPreviewDrawerComponent` (drawer, pedido del
    owner tras QA visual — ver "Tareas descubiertas"). El archivo original fue eliminado junto
    con su ruta; el DoD de abajo queda como registro histórico de lo implementado en su momento.
  - **AC ref:** AC2, AC4, AC-E1
  - **DoD:**
    - [x] Calcado de `admin-alumno-docs-detalle.component.ts`: breadcrumb, header con nombre +
      `licenseNumber` del instructor, lista de `DmsInstructorDocRow`
    - [x] `isAdmin()` derivado de `AuthFacade` (reutilizable entre admin y secretaría, mismo
      patrón que el de alumno)
    - [x] Clic en el documento abre la previsualización inline (split view vía
      `getSignedDocumentUrl()`) — **calcado exacto** del patrón real de
      `admin-alumno-docs-detalle.component.ts` (que también usa split view, no un botón "Ver" +
      modal `openDocument()` como decía el DoD original); satisface AC4 igual — reutiliza
      `createSignedUrl()` de `dms.facade.ts`
    - [x] Fila deshabilitada (`opacity-50`, `cursor-not-allowed`, sin click habilitado) cuando
      `doc.fileUrl` es null (AC-E1)
    - [x] Skeleton mientras `facade.instructorDocsLoading()` es true
    - [x] OnPush
    - [x] Documentado en `indices/COMPONENTS.md`

---

## Fase 4 — Conexión

- [x] **T4.1** — Wire-up en `admin-documentos.component.ts` y `secretaria-documentos.component.ts`
  - **AC ref:** AC1, AC2, AC5, AC-E2
  - **DoD:**
    - [x] Ambos pasan `instructorsWithDocs` al `<app-dms-list-content>`
    - [x] `openUploadInstructorDrawer()` → `facade.openUpload('instructor')`
    - [x] `onViewInstructorDocs(id)` → `router.navigate(['instructores', id], { relativeTo: this.route })`
    - [x] Secretaría no ve botón eliminar en instructores — la tab `@case('instructors')` no
      tiene botón eliminar por fila (solo "Ver →"); el eliminar por-documento vive en el
      detalle (T3.3), gateado ahí por `isAdmin()`, mismo criterio que alumnos/escuela

- [x] **T4.2** — Agregar rutas en `app.routes.ts`
  - **SUPERSEDED (2026-07-29):** las rutas `alumnos/:id`/`instructores/:id` bajo `documentos`
    fueron eliminadas (admin y secretaría) al pivotar a drawers — ver "Tareas descubiertas".
    `onViewInstructorDocs`/`onViewStudentDocs` en T4.1 ahora llaman
    `facade.openInstructorDocsDrawer()`/`openStudentDocsDrawer()` en vez de `router.navigate()`.
  - **AC ref:** AC2
  - **DoD:**
    - [x] `admin/documentos/instructores/:id` → `AdminInstructorDocsDetalleComponent`
      (lazy `loadComponent`)
    - [x] `secretaria/documentos/instructores/:id` → mismo componente (reutilizable, igual
      que `alumnos/:id` hoy)
    - [x] Documentado en `indices/ROUTES.md`

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio — 0 errores; 2 regresiones nuevas detectadas
  y corregidas en el camino (ARCH-15 pill ad-hoc → `<app-badge>` en el detalle de instructor;
  ARCH-16 tamaño sobre `btn-primary` → botón "Subir documento" del tab instructores sin
  overrides de tamaño, AP-013)
- [x] **T5.2** — `npm run test:ci` corre verde — 130 archivos, 1551 tests OK (incluye los 15
    nuevos de `dms.facade.spec.ts`)
- [x] **T5.3** — QA manual del happy path + edge cases (Playwright MCP no disponible en esta
  sesión — verificado en su lugar por el owner directamente en su navegador, con Docker y la
  migración aplicados en su entorno, a lo largo de múltiples rondas de esta sesión)
  - **AC ref:** AC1–AC5, AC-E1, AC-E2
  - **DoD:** Cada AC marcado con evidencia en `acceptance.md` ✅ — incluye login como admin
    (columna Sede, "Todas las sedes") verificado por el owner; login como secretaria de sede no
    se verificó explícitamente en esta sesión pero el filtro `users.branch_id` está cubierto
    por test automatizado (`dms.facade.spec.ts`)

- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** `acceptance.md` generado — veredicto ✅ PASA, 7/7 AC cumplidos

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/` con todo lo nuevo (hecho incrementalmente durante la
  sesión + `npm run indices:sync` para los índices auto-generados)
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [x] **Fix visuales post-QA del owner (2026-07-29):** al revisar la vista real, el owner
  reportó 3 bugs: (1) skeleton del DMS seguía mostrando 3 tabs en vez de 4, (2) headers
  "Alumnos con documentos"/"Últimos subidos" casi ilegibles (sin clase de color explícita,
  `<h2>` sin `text-text-primary`), (3) pill activo del filtro de categorías en "Plantillas"
  totalmente negro (clase muerta `text-bg-surface` — el token real es `--color-surface`, no
  `--color-bg-surface`, por lo que Tailwind nunca generaba esa utilidad → texto invisible
  sobre fondo negro). Los 3 corregidos en `dms-list-content.component.ts`.
- [x] **Pivote UX: página completa → drawer (2026-07-29, pedido explícito del owner tras QA
  visual).** "Ver" en alumno e instructor ya no navega a una subruta de página completa
  (`/documentos/alumnos\|instructores/:id`, eliminadas junto a
  `admin-alumno-docs-detalle.component.ts`/`admin-instructor-docs-detalle.component.ts`).
  Ahora abre un drawer con la lista de documentos + botón "Subir documento"; clic en un
  documento apila (push) un drawer de previsualización con back button automático (provisto
  por `LayoutDrawerService.canGoBack()`/`back()`, patrón ya usado en otros wizards de 2 pasos
  del proyecto, ej. reagendar clases). **Nota de alcance:** esto toca el flujo de alumno
  (`DmsStudentDocsDrawerComponent`), que estaba fuera del scope original de 0003-m (solo
  cubría instructores) — se hizo en el mismo pase porque el pedido explícito del owner fue
  "tanto en alumno como en instructor" y ambos comparten el mismo componente compartido
  (`DmsListContentComponent`) y el mismo `DmsFacade`; separar solo instructor habría dejado
  el DMS con dos UX inconsistentes (alumno=página, instructor=drawer) sin ningún beneficio.
  Componentes nuevos: `DmsStudentDocsDrawerComponent`, `DmsInstructorDocsDrawerComponent`,
  `DmsDocPreviewDrawerComponent`. `DmsFacade.openUpload()` cambia de `layoutDrawer.open()` a
  `.push()` (retrocompatible: `push()` degrada a `open()` si no hay drawer abierto) y
  `closeDrawer()` ahora es "smart" (`back()` si hay historial, si no `close()`).
- [x] **Integración con el módulo Instructores (2026-07-30, pedido explícito del owner "para
  mayor consistencia e intuitividad").** Fuera del scope original de 0003-m (que solo tocaba
  `features/admin/documentos`), pero reutiliza directamente la infraestructura de esta spec:
  - `DmsFacade.openStudentDocsDrawer()`/`openInstructorDocsDrawer()` cambian de
    `layoutDrawer.open()` a `.push()` para poder apilarse sobre un drawer ya abierto de otro
    módulo (ej. Ver/Editar Instructor) — antes solo se abrían como entrada directa desde DMS.
  - `AdminInstructorVerDrawerComponent`/`EditarDrawerComponent`: nuevo botón "Ver
    documentos"/"Documentos" → `DmsFacade.openInstructorDocsDrawer(id, nombre)` (push, con back
    button automático del header del `LayoutDrawer` de vuelta al drawer de instructor).
  - `AdminInstructorCrearDrawerComponent`: (a) se eliminó el selector "Clase de licencia"
    (B/A2-A5) — decisión confirmada con el owner: `instructors` es exclusivamente Clase B (los
    relatores Profesional son la tabla `lecturers`, aparte), se envía `licenseClass:'B'` fijo;
    (b) nueva sección "Documentos (opcional)" — adjunta N archivos con su tipo antes de crear
    (el instructor no tiene `id` todavía); al enviar, primero crea el instructor y luego sube
    los documentos adjuntos uno a uno vía `DmsFacade.uploadInstructorDocument()` (fallas
    individuales no bloquean el cierre, se avisan por toast). `InstructoresFacade.crearInstructor()`
    cambia su retorno de `Promise<boolean>` a `Promise<number \| null>` (el `instructorId`
    recién creado) — la Edge Function `create-instructor` ya lo devolvía, solo se descartaba.
  - Extraídos a utils compartidos (para no duplicar entre DMS e Instructores):
    `core/utils/instructor-doc-types.util.ts` (`INSTRUCTOR_DOC_TYPES`, única fuente de verdad
    del enum de 7 tipos) y `core/utils/document-file-validation.util.ts`
    (`validateDocumentFile`, con test — antes la validación de tipo/tamaño estaba duplicada
    inline en `dms-upload-drawer.component.ts`).
- [x] **Alineación de Editar Instructor (2026-07-30, pedido explícito del owner tras revisar
  la nota anterior).**
  - Se eliminó también el selector "Clase de licencia" (B/A2-A5) de
    `AdminInstructorEditarDrawerComponent` — mismo criterio que Crear: `licenseClass:'B'` fijo
    al enviar. **Nota:** un instructor creado ANTES de este fix pudo haber quedado guardado con
    clase A2-A5 en BD; este cambio solo evita que se pueda VOLVER a elegir una clase incorrecta
    al editar — no hace backfill de datos históricos (fuera de scope, evaluar aparte si el
    owner confirma que hay instructores reales con esa inconsistencia).
  - **UX del botón de documentos corregido:** el owner reportó que el botón "Documentos" en el
    mini-header (junto al nombre/avatar) era poco descubrible ("estuve buscando varios segundos
    ... muy poco intuitivo"). Se movió a una sección propia "Documentos" en el cuerpo del
    formulario (entre "Licencia Clase B" y "Tipo de Instructor"), como botón de ancho completo
    "Ver y subir documentos" — mismo patrón visual que el resto de las secciones del drawer.
