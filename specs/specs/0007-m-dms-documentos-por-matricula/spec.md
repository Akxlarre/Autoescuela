# Spec 0007-m — DMS: documentos por matrícula (no por alumno) + unificación de carpetas de Storage

> **Status:** draft
> **Created:** 2026-08-09
> **Owner:** Matías
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** conversación 2026-08-09, revisión de la inconsistencia entre las carpetas de Storage
`student_docs/` (subida desde DMS) y `students/` (subida desde matrícula). Empezó como fix-146-m
pero el alcance real (facade + 6 componentes + script de migración + SQL) excede "un fix = un
archivo", así que se convierte en spec.

**Persona afectada:** Admin y Secretaria (usuarios del módulo DMS / Repositorio de Documentos).

**Problema que resuelve:**
`student_documents` está scoped por `(enrollment_id, type)` — cada matrícula tiene su propio
juego de documentos (carnet, hoja de vida, cédula, licencia, contrato). Pero la capa de
presentación del DMS (`dms.facade.ts`) no respeta ese scope: la lista de "alumnos con
documentos" agrupa por `studentId` (una sola fila aunque el alumno tenga 2+ matrículas,
sumando `docCount` de todas mezclado) y el detalle (`loadStudentDocuments`) trae documentos de
TODAS las matrículas del alumno sin filtrar por `enrollment_id`. Un alumno con dos matrículas
(reforzamiento, renovación) ve sus documentos de ambas mezclados sin poder distinguir cuál
corresponde a cuál. Además, los documentos subidos desde la pestaña DMS se guardan en
`student-docs/{studentId}/...`, mientras que los subidos desde matrícula usan
`students/{enrollmentId}/...` — dos convenciones para el mismo concepto.

**Hipótesis de valor:**
Secretaria/Admin pueden distinguir de un vistazo qué documento pertenece a qué matrícula de un
alumno con historial de re-matrículas, sin ambigüedad, y el equipo deja de arrastrar dos
convenciones de carpeta paralelas en Storage.

---

## 2. User Stories

- **US1**: Como Secretaria, quiero ver una fila por matrícula (no por alumno) en la lista de
  documentos del DMS, para poder identificar a cuál matrícula corresponde cada carnet/contrato
  cuando el alumno tiene más de una.
- **US2**: Como Secretaria, quiero que al abrir el detalle de una matrícula específica solo vea
  los documentos de esa matrícula, para no confundirlos con los de una matrícula anterior del
  mismo alumno.
- **US3**: Como Secretaria, quiero que al subir un documento desde el detalle de una matrícula
  específica, ese documento quede asociado a esa misma matrícula (no a la última matrícula del
  alumno por defecto).

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un alumno con 2 matrículas (enrollments) que tienen documentos propios, When se
  carga la lista de "alumnos con documentos" del DMS, Then aparecen 2 filas para ese alumno, cada
  una con su propio número de matrícula, sede y `docCount` (contando solo los documentos de esa
  matrícula, no de ambas).
- **AC2**: Given una de esas dos filas, When la Secretaria hace clic en "Ver →", Then el detalle
  muestra únicamente los documentos cuyo `enrollment_id` corresponde a esa matrícula.
- **AC3**: Given el detalle de una matrícula específica abierto, When la Secretaria sube un nuevo
  documento desde ese drawer, Then el documento queda asociado a esa misma matrícula (mismo
  `enrollment_id`) y el archivo se guarda bajo `students/{enrollmentId}/...` en Storage.
- **AC4**: Given un documento subido desde el selector genérico de "Subir documento" (sin venir
  de una matrícula específica), When no hay matrícula preseleccionada, Then se mantiene el
  comportamiento actual de fallback (usar la última matrícula del alumno).
- **AC5**: Given los objetos ya existentes en Storage bajo `student-docs/{studentId}/...`, When
  se corre el script de migración una vez contra Supabase local, Then cada objeto queda movido a
  `students/{enrollmentId}/...` (mismo contenido, resuelto vía `student_documents.enrollment_id`)
  y `student_documents.storage_url` queda actualizado a la nueva ruta.
- **AC6**: Given que la migración de datos ya corrió, When se aplica la migración SQL de limpieza,
  Then no quedan filas de `storage.objects` bajo el prefijo `student-docs/%` en el bucket
  `documents`.

### Edge cases obligatorios

- **AC-E1**: Given un alumno con una sola matrícula, When se ve la lista del DMS, Then se
  comporta igual que hoy (una sola fila, sin cambios visibles).
- **AC-E2**: Given el selector genérico "Subir documento" (modo `student`, dropdown de alumnos),
  When el alumno tiene 2+ matrículas con documentos, Then el dropdown de alumnos NO muestra el
  nombre duplicado (una entrada por alumno, deduplicado por `studentId`) y, tras elegir un alumno
  con 2+ matrículas, aparece un segundo selector para elegir a cuál matrícula corresponde el
  documento; el documento sube asociado al `enrollment_id` elegido en ese segundo paso.
- **AC-E3**: Given la foto carnet (`id_photo`), When se aplica este cambio, Then su comportamiento
  de reutilización (copy-on-confirm, fix-020) NO se modifica.

---

## 4. Out of scope

- ❌ Cambiar el comportamiento de reutilización de `id_photo` (carnet) — sigue usando
  copy-on-confirm de fix-020 sin cambios.
- ❌ Generalizar el patrón de "reutilizar documento anterior" a `hoja_vida_conductor`,
  `cedula_identidad` o `licencia_conducir` — esos documentos deben subirse actualizados en cada
  matrícula (decisión explícita del negocio, 2026-08-09).
- ❌ Cambiar la semántica de upsert de `uploadStudentDocument()` (sigue permitiendo múltiples
  archivos históricos por tipo vía timestamp en el nombre de archivo — no pasa a sobreescribir
  como hace `enrollment-documents.facade.ts`).
- ❌ Migrar convenciones de Storage de otros módulos (instructor-docs, school-docs, templates) —
  solo aplica a `student-docs/` vs `students/`.

---

## 5. Dependencias

### Specs previas
- Ninguna — depende de la spec 0005-m (request guard de `dms.facade.ts`) solo en el sentido de
  que toca el mismo archivo, pero no requiere cambios en ella.

### Capacidades del proyecto que se asumen existentes
- `v_dms_student_documents` (vista, ya expone `enrollment_id` por fila).
- `student_documents.enrollment_id` como FK (ya existe).
- Columnas "N° Mat." y "Sede" ya presentes en la tabla de `dms-list-content.component.ts`.

### Capacidades nuevas requeridas
- Signal `preselectedEnrollmentId` en `DmsFacade` (nuevo, análogo a `preselectedStudentId`).
- Script de migración de Storage (`scripts/migrate-student-docs-storage.mjs`), fuera de
  `src/app/` — usa Storage API (`.move()`) con service role, no SQL directo (un
  `UPDATE storage.objects SET name=...` no mueve el archivo físico, solo el metadato).

---

## 6. Datos y modelo (preliminar)

- **Sin tablas nuevas.** `student_documents.enrollment_id` ya existe y es la fuente de verdad.
- **Modelo UI modificado:** `StudentWithDocsRow` (`core/models/ui/dms.model.ts`) gana el campo
  `enrollmentId: number`.
- **Sin RLS nueva** — las políticas de Storage ya son por rol o por comparación exacta de
  `storage.objects.name` contra columnas de BD (`documents_student_own_certificate_read`), no por
  prefijo de carpeta, así que no hay impacto de seguridad al mover objetos de carpeta.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): DMS (`admin-documentos.component.ts`, `secretaria-documentos.component.ts`),
  drawer de detalle (`dms-student-docs-drawer.component.ts`), drawer de subida
  (`dms-upload-drawer.component.ts`).
- Flujo principal: lista → clic "Ver →" en la fila de una matrícula específica → drawer muestra
  solo esos documentos → "Subir documento" desde ahí asocia el archivo a esa misma matrícula.
- Estados especiales: alumno con una sola matrícula se comporta igual que hoy (sin fila
  duplicada); dropdown genérico de "Subir documento" deduplicado por alumno, y si el alumno
  elegido tiene 2+ matrículas se despliega un segundo selector de matrícula (selector en 2 pasos)
  antes de habilitar la subida.

---

## 8. Métricas de éxito post-launch

- N/A — spec interna de corrección de datos/UX, sin métrica de producto asociada.

---

## 9. Notas / decisiones abiertas

- [x] Carnet (`id_photo`) queda con copy-on-confirm sin cambios — confirmado por el dueño
  2026-08-09.
- [x] Los otros 3 tipos de documento (hoja de vida, cédula, licencia) NO se reutilizan entre
  matrículas — deben subirse actualizados, confirmado por el dueño.
- [x] Migración de Storage se ejecuta ahora porque el ambiente es development con alumnos
  ficticios — sin riesgo de pérdida de datos reales, confirmado por el dueño.
- [x] AC-E2 confirmado con el dueño 2026-08-09: el dropdown genérico se deduplica por alumno
  (paso 1), y si el alumno tiene 2+ matrículas se agrega un segundo selector de matrícula
  (paso 2) — no se deduplica "la matrícula", que sigue siendo relevante (contrato, estado,
  documentos exigidos difieren por matrícula). Se descartó agregar el detalle de matrícula al
  label del dropdown de alumnos (ej. "Juan Pérez — Clase B #1204") por preferir el selector en
  2 pasos.

---

## Changelog

- 2026-08-09 — draft inicial por Matías (a partir de fix-146-m, convertido a spec por exceder
  alcance de un fix)
