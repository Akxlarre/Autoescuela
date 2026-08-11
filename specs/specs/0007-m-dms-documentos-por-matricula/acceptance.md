# Acceptance 0007-m — DMS: documentos por matrícula (no por alumno) + unificación de carpetas de Storage

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-09
> **Verifier:** Claude (implementación + QA) · validado por Matías

---

## Resumen

- AC totales: 9 (AC1-AC6 + AC-E1, AC-E2, AC-E3)
- AC cumplidos: 9
- AC fallidos: 0
- AC con evidencia: 9

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Lista agrupa por matrícula, no por alumno

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `src/app/core/facades/dms.facade.spec.ts` — caso `fetchAllData() (spec 0007-m, AC1): alumno con 2 matrículas produce 2 filas, cada una con su propia sede/N° y docCount solo de su enrollment` — PASA.
  - Código: `src/app/core/facades/dms.facade.ts` — `fetchAllData()` agrupa `enrollmentDocCount` por `enrollment_id` (no `student_id`); `enrollmentInfoMap` resuelve `matriculaNumber`/`branchName` desde `enrollments.branch_id` de cada matrícula.
  - QA manual: verificado en browser real (`ng serve` + Playwright MCP, admin@test.com) — tabla "Alumnos con documentos" muestra 1 fila por alumno con 1 matrícula (sin regresión, ver AC-E1); el dataset local no tiene un alumno con 2+ matrículas con documentos para confirmar visualmente las 2 filas, cubierto solo por el test unitario.

### AC2 — Detalle de una matrícula solo muestra sus propios documentos

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `dms.facade.spec.ts` — caso `loadStudentDocuments(studentId, enrollmentId) (AC2): filtra v_dms_student_documents por enrollment_id además de student_id` — PASA.
  - Código: `dms.facade.ts` `loadStudentDocuments(studentId, enrollmentId?)` agrega `.eq('enrollment_id', enrollmentId)`; `openStudentDocsDrawer(studentId, enrollmentId, name)` lo invoca con ambos.
  - QA manual: click "Ver →" en fila de "Aguilar Díaz Patricia" (#0019) → drawer muestra subtítulo **"Matrícula #0019 — Conductores Chillán"** y solo sus 2 documentos (Foto + Contrato). Sin errores de consola.

### AC3 — Subida desde el detalle de una matrícula queda asociada a esa matrícula

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `dms.facade.spec.ts` — `uploadStudentDocument() (AC3): sube al path students/{enrollmentId}/... cuando viene enrollmentId` — PASA.
  - Test: `dms-upload-drawer.component.spec.ts` — `AC3: con preselectedEnrollmentId, no muestra el segundo selector y usa ese id directo` — PASA.
  - QA manual: desde el drawer de detalle de Patricia, "Subir documento" abre el drawer con alumno preseleccionado, sin segundo selector visible, y el dropdown "Tipo de documento" excluye Contrato/Foto (Carnet) — ya subidos en esa matrícula.

### AC4 — Selector genérico sin preselección mantiene el fallback (última matrícula)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `dms.facade.spec.ts` — `uploadStudentDocument() (AC4): sin enrollmentId, cae al fallback de la última matrícula del alumno` — PASA.
  - Test: `dms-upload-drawer.component.spec.ts` — caso del alumno con 1 sola matrícula: auto-selección sin selector visible — PASA.
  - QA manual: selector genérico "Subir documento" de cabecera → elegir "Aguilar Díaz Patricia" (1 sola matrícula) → sin segundo selector, tipos filtrados correctamente.

### AC5 — Migración de datos mueve objetos de Storage a la convención nueva

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Archivo: `scripts/migrate-student-docs-storage.mjs` (nuevo) — usa Storage API `.move()`, idempotente por fila, actualiza `student_documents.storage_url`.
  - Ejecución real contra Supabase local (`SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-student-docs-storage.mjs` y con `--dry-run`): corre sin errores. El dataset local no tenía objetos bajo `student-docs/` (0 documentos a migrar) — la lógica de query/conexión/move quedó validada end-to-end sin poder ejercer una fila real movida.

### AC6 — Sin residuos bajo `student-docs/` tras la limpieza

- **Estado:** ✅ cumplido (con corrección de diseño respecto al plan original)
- **Evidencia:**
  - **Hallazgo durante implementación:** Supabase bloquea `DELETE` directo sobre `storage.objects` ("Direct deletion from storage tables is not allowed. Use the Storage API instead.", `SQLSTATE 42501`) — confirmado corriendo `npx supabase migration up` con la migración SQL originalmente planeada, que falló con ese error. La migración SQL fue **eliminada**.
  - Corrección: el mismo `scripts/migrate-student-docs-storage.mjs` agrega un barrido final (`listAllFilesUnder()` recursivo + `supabase.storage.from('documents').remove(leftovers)`) que reemplaza la migración SQL.
  - Ejecución real: `Sin residuos bajo student-docs/ — limpieza completa.` (stdout del script contra Supabase local).
  - `spec.md`, `plan.md` y `tasks.md` actualizados con el Changelog de esta corrección.

### AC-E1 — Alumno con 1 sola matrícula sin cambios visibles

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `dms.facade.spec.ts` — `fetchAllData(): arma name en orden paterno-materno-nombre — alumno con 1 sola matrícula (AC-E1, sin regresión)` — PASA.
  - QA manual: "Aguilar Díaz Patricia" (1 matrícula) se ve como 1 sola fila en la tabla, igual que antes del cambio.

### AC-E2 — Selector genérico deduplicado + segundo selector de matrícula

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Test: `dms.facade.spec.ts` — `loadStudentEnrollmentOptions(studentId) (AC-E2): devuelve TODAS las matrículas del alumno, no solo las que ya tienen documentos` — PASA.
  - Test: `dms-upload-drawer.component.spec.ts` — `AC-E2: alumno con 2+ matrículas muestra el segundo selector y no carga documentos hasta elegir una` — PASA.
  - QA manual (Claude): dropdown de alumnos del selector genérico verificado deduplicado (47 alumnos, sin nombres repetidos) contra el dataset local real.
  - QA manual (owner): verificado personalmente por Matías el 2026-08-09 — confirma el comportamiento del segundo selector con un alumno de 2+ matrículas.

### AC-E3 — Foto carnet (`id_photo`) sin cambios

- **Estado:** ✅ cumplido
- **Evidencia:** ningún archivo relacionado con el flujo copy-on-confirm de fix-020 (`enrollment-documents.facade.ts`, lógica de `photoNeedsConfirmation`) fue tocado en esta spec. `git status` confirma que los únicos archivos modificados son los listados en el plan (§2).

---

## Out-of-scope respetado

- ❌ Cambiar el comportamiento de reutilización de `id_photo` — confirmado: no se tocó (ver AC-E3).
- ❌ Generalizar "reutilizar documento anterior" a hoja_vida/cédula/licencia — confirmado: no se tocó ningún código de esos tipos de documento.
- ❌ Cambiar la semántica de upsert de `uploadStudentDocument()` — confirmado: sigue con `upsert: true` + timestamp en el nombre de archivo, sin cambios en esa lógica.
- ❌ Migrar convenciones de Storage de otros módulos (instructor-docs, school-docs, templates) — confirmado: solo se tocó el path de `uploadStudentDocument()`.

---

## Deuda técnica detectada

- `dms.facade.ts` — `fetchAllData()` y `loadStudentDocuments()` superan el límite recomendado de 50 líneas por método (ARCH-10, warning no bloqueante) tras esta spec. Mismo patrón preexistente en ~15 otras facades del proyecto (`public-enrollment.facade.ts`, `student-home.facade.ts`, etc.) — no se refactoriza acá para no exceder el alcance de la spec.

---

## Cambios en índices

- `indices/MODELS.md` — pendiente: documentar `StudentEnrollmentOption` (nueva, `core/models/ui/dms.model.ts`) y el campo `enrollmentId` agregado a `StudentWithDocsRow`.
- `indices/FACADES.md` — pendiente: actualizar la entrada de `DmsFacade` con `loadStudentEnrollmentOptions()`, `preselectedEnrollmentId`, grouping por matrícula y el nuevo path de Storage.
- `indices/COMPONENTS.md` — pendiente: actualizar `dms-list-content` (shape de `viewStudentDocs`) y `dms-upload-drawer` (segundo selector).
- `indices/DATABASE.md` — sin cambios de esquema; no requiere entrada nueva.

(Se completa en el siguiente paso — `/sync-indices`.)

---

## Post-mortem

- **Qué salió mejor de lo esperado:** la spec quedó completamente cubierta por tests unitarios antes de tocar el browser — el QA visual solo confirmó lo que los tests ya predecían, sin sorpresas de comportamiento.
- **Qué fricciones encontramos:** el plan original asumía que una migración SQL podía hacer `DELETE FROM storage.objects` — Supabase lo bloquea a nivel de guardrail interno ("Direct deletion from storage tables is not allowed"). Esto no está documentado en `indices/DOMAIN-GOTCHAS.md` todavía; vale la pena agregarlo ahí para que el próximo track que toque `storage.objects` desde SQL no repita el mismo intento fallido.
- **Qué cambiaríamos en el siguiente ciclo SDD:** al planificar una migración de Storage, validar temprano (antes de escribir el plan) si la operación necesita `DELETE`/`UPDATE` directo sobre `storage.objects` — si es así, resolver siempre vía Storage API en un script, nunca en SQL.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (9/9)
- [x] Out-of-scope respetado
- [ ] Índices actualizados (pendiente — siguiente paso `/sync-indices`)
- [x] Tests pasando en CI (`dms.facade.spec.ts` 23/23, `dms-upload-drawer.component.spec.ts` 5/5, `npx tsc --noEmit` limpio)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta (deuda registrada es menor y no bloqueante)

**Cerrado por:** Matías
**Fecha:** 2026-08-09
