# Acceptance 0003-m — Repositorio de documentos: sección Instructores + poder abrir el archivo

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-30
> **Verifier:** ac-verifier · validado visualmente por m (owner) en su propio entorno con Docker + migración aplicados

---

## Resumen

- AC totales: 7 (AC1–AC5 + AC-E1 + AC-E2)
- AC cumplidos: 7
- AC fallidos: 0
- AC con evidencia: 7 (código + tests automatizados + QA visual del owner en múltiples rondas)

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Tab "Instructores" en paralelo a "Alumnos", listando instructores con sus documentos

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/shared/components/dms-list-content/dms-list-content.component.ts` — 4º tab
    "Documentos de Instructores" (`tabs` array + `@case ('instructors')`), tabla con columna
    N° Licencia, Sede (condicional) y contador de documentos.
  - Facade: `DmsFacade.instructorsWithDocs` (`src/app/core/facades/dms.facade.ts`) — a
    diferencia de `studentsWithDocs`, lista TODOS los instructores del scope (docCount 0
    incluido) para permitir subir el primer documento.
  - Test: `src/app/core/facades/dms.facade.spec.ts` — describe `Instructor documents (spec
    0003-m)`, 6 casos (mapeo de filas, upload, delete, branch-scope, orden/nombre/matrícula).
  - QA manual: owner verificó visualmente el tab, la tabla y el listado en su entorno (varias
    rondas de esta sesión, con datos reales tras aplicar la migración).

### AC2 — Detalle de instructor: cada documento con tipo y estado, mismo patrón visual que alumno

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `DmsInstructorDocsDrawerComponent`
    (`src/app/features/admin/documentos/dms-instructor-docs-drawer/`) — lista de
    `DmsInstructorDocRow` con `typeLabel` y `status`, calcado de
    `DmsStudentDocsDrawerComponent`.
  - Nota de diseño (post-QA visual, aprobada por el owner): el detalle terminó siendo un
    **drawer apilable** en vez de una página completa como se planteó originalmente en
    plan.md — decisión tomada en sesión tras ver la UI real, documentada en tasks.md
    ("Pivote UX: página completa → drawer"). El patrón visual (tipo + estado) se mantiene
    igual al de alumno.
  - QA manual: owner confirmó explícitamente "Todo perfecto" tras revisar el drawer con datos
    reales (Carlos Henrique Casimiro, Carlos Eduardo Muñoz, etc.).

### AC3 — Subir documento: tipo de un enum predefinido + archivo adjunto

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `core/utils/instructor-doc-types.util.ts` — `INSTRUCTOR_DOC_TYPES`, enum de 7 tipos
    (Decreto 39/1985 MTT, spec.md §6), única fuente de verdad reutilizada por
    `dms-upload-drawer.component.ts` y `admin-instructor-crear-drawer.component.ts`.
  - Código: `DmsFacade.uploadInstructorDocument()` — sube a `instructor-docs/{id}/...` e
    inserta en `instructor_documents` con `status:'pending'`.
  - Test: `dms.facade.spec.ts` — caso "uploadInstructorDocument() sube el archivo con el path
    instructor-docs/{id}/... e inserta con status pending".
  - Extensión post-QA (pedida por el owner, "mayor consistencia"): el mismo flujo de subida
    ahora también está disponible desde `AdminInstructorCrearDrawerComponent` (documentos
    adjuntos al crear) y desde Ver/Editar Instructor (botón → mismo drawer).
  - QA manual: owner verificó el filtro de tipos ya usados y la corrección del caso 'contract'
    vs 'contrato' (DG-038) en varias rondas.

### AC4 — Previsualizar/ver documento abre el archivo real (signed URL), no solo el estado

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `DmsFacade.openDocPreview()` → `DmsDocPreviewDrawerComponent` — usa
    `getSignedDocumentUrl()` (misma función de `dms.facade.ts` referenciada en AC4, TTL 1h),
    switch imagen/PDF/no-soportado.
  - Fix aplicado en sesión: el host del componente no tenía la clase de flex necesaria para
    heredar altura del body del `LayoutDrawer`, causando que el visor se viera "cortado" —
    corregido agregando `host: { class: 'flex flex-col flex-1 min-h-0' }`.
  - QA manual: owner confirmó explícitamente que el visor se veía correctamente tras el fix
    ("Contrato_Matricula.pdf" y "Carnet Inicial.pdf" renderizando a pantalla completa).

### AC5 — Secretaría solo ve instructores de su propia sede

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `DmsFacade.fetchAllData()` — `instructorsQuery.eq('users.branch_id', branchId)`
    cuando `branchId !== null` (secretaría, vía `resolveBranchScope`).
  - Test: `dms.facade.spec.ts` — "fetchAllData(): secretaria con branchId numérico filtra
    instructores por users.branch_id".

### AC-E1 — Documento sin archivo: opción de ver deshabilitada, sin fallar

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `instructor_documents.storage_url` es `NOT NULL` en la migración (no puede existir
    fila sin archivo por diseño); `DmsFacade.openDocPreview()` hace `if (!path) return;` como
    guardia defensiva adicional.
  - Nota: dado el `NOT NULL`, este edge case es estructuralmente imposible de producir con el
    flujo normal de subida — la guardia defensiva cubre el caso igual (documentado en plan.md
    §8 riesgos).

### AC-E2 — Admin ve instructores de todas las sedes

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `DmsFacade.fetchAllData()` — sin `branchId !== null` (admin, `resolveBranchScope`
    devuelve `null` con "Todas las sedes" seleccionado), no se aplica `.eq()`.
  - Test: `dms.facade.spec.ts` — "fetchAllData(): admin con branchId===null no filtra
    instructores por sede".
  - Extensión post-QA (pedida por el owner): columna "Sede" visible en la tabla de alumnos e
    instructores solo cuando admin + "Todas las sedes" está seleccionado en el topbar —
    refuerzo visual directo de este AC.

---

## Out-of-scope respetado

- ❌ Portal del propio instructor para autogestionar sus documentos — confirmado: no entró.
- ❌ Ver ensayos/exámenes rendidos, o adjuntar hoja física de examen escaneada — confirmado: no
  entró (esa ambigüedad de "ver pruebas documentos" se resolvió como visor de archivo, AC4).
- ❌ Documentos de relatores de Clase Profesional (`lecturers`) — confirmado: no entró; toda la
  implementación quedó acotada a `instructors` (Clase B).

---

## Deuda técnica detectada

- **Ninguna deuda crítica abierta.** Toda la deuda identificada durante la sesión se corrigió
  en el mismo ciclo (ver tasks.md → "Tareas descubiertas durante implementación" para el
  historial completo: bugs visuales, claves de tipo de documento inconsistentes DG-038, host
  de flex en el preview drawer, selector de clase de licencia A2-A5 heredado en Crear y Editar
  Instructor).
- **Scope creep documentado y aprobado por el owner** (no es deuda, pero se declara por
  transparencia): esta sesión terminó tocando bastante más que el DMS de instructores original:
  - El flujo de alumno (`DmsStudentDocsDrawerComponent`) — pivote página→drawer pedido por el
    owner para "alumno e instructor" a la vez.
  - El módulo Instructores completo (`AdminInstructorCrearDrawerComponent`,
    `EditarDrawerComponent`, `VerDrawerComponent`) — botones para ver/subir documentos
    reutilizando la infraestructura de esta spec, más la corrección del selector de clase de
    licencia (B/A2-A5 → fijo 'B').
  - Todo fue pedido explícitamente por el owner en la misma sesión de trabajo ("para mayor
    consistencia e intuitividad") y verificado visualmente por él antes de este cierre.

---

## Cambios en índices

- `indices/COMPONENTS.md` — agregados: `DmsStudentDocsDrawerComponent`,
  `DmsInstructorDocsDrawerComponent`, `DmsDocPreviewDrawerComponent`; actualizados:
  `DmsListContentComponent`, `DmsUploadDrawerComponent`, `AdminInstructorCrearDrawerComponent`,
  `AdminInstructorVerDrawerComponent`, `AdminInstructorEditarDrawerComponent`.
- `indices/FACADES.md` — actualizado: `DmsFacade` (métodos de instructor, drawers apilados,
  nombres/orden/matrícula/sede), `InstructoresFacade` (`crearInstructor()` retorna
  `instructorId`).
- `indices/DATABASE.md` — agregada: `instructor_documents` (tabla + RLS).
- `indices/MODELS.md` — agregados: `InstructorWithDocsRow`, `DmsInstructorDocRow`,
  `UploadInstructorDocPayload`, campos nuevos en `StudentWithDocsRow`.
- `indices/UTILS.md` — agregados: `instructor-doc-types.util.ts`,
  `document-file-validation.util.ts`.
- `indices/DOMAIN-GOTCHAS.md` — agregado: DG-038 (vocabularios duplicados de tipo de documento).
- `indices/ROUTES.md` — eliminadas las subrutas de página completa
  `documentos/alumnos\|instructores/:id` (reemplazadas por drawers).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** la infraestructura de `LayoutDrawerService`
  (push/back/canGoBack) ya existente resultó directamente reutilizable para el patrón
  lista→preview con back button, sin necesitar diseño nuevo — y luego también para conectar
  Instructores con DMS sin acoplar los dos módulos.
- **Qué fricciones encontramos:** el plan original (`plan.md`) diseñó una página completa para
  el detalle; la UX real terminó siendo un drawer, decidido recién al ver la UI renderizada.
  Esto confirma el valor de QA visual temprano — varias correcciones (bugs de color, tipos de
  documento con claves inconsistentes, host de flex faltante) solo se detectaron probando la
  app real, no por lint ni tests.
- **Qué cambiaríamos:** el enum de tipos de documento (`INSTRUCTOR_DOC_TYPES`) sigue siendo
  investigación propia, no asesoría legal formal — pendiente de validar con el cliente antes de
  producción (ya señalado en spec.md §9).

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (131 archivos, 1556 tests)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta

**Cerrado por:** m (owner, verificado visualmente)
**Fecha:** 2026-07-30
