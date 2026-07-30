# Spec 0003-m — Repositorio de documentos: sección Instructores + poder abrir el archivo

> **Status:** done
> **Created:** 2026-07-29
> **Owner:** m
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación ASG-b-042 (`specs/assignments/ASG-b-042-repositorio-documentos-instructores.md`),
originada en la reunión con el cliente del 2026-07-28.

**Persona afectada:** Admin y Secretaría (confirmado por el owner 2026-07-29 — ambos roles
gestionan documentos de instructores, igual que ya ocurre con documentos de alumnos).

**Problema que resuelve:**
Anotación de la reunión (2026-07-28), una sola viñeta con dos partes: *"Añadir opción ver
instructores en el repositorio de documentos que tenemos. Añadir opción ver pruebas
documentos."*

Parte 1 — hoy el repositorio de documentos solo cubre alumnos: las rutas existentes son
`/app/admin/documentos` y `/app/admin/documentos/alumnos/:id` (+ los equivalentes de
secretaría). Falta la sección paralela para **documentos de los instructores** (licencia,
antecedentes, etc.).

Parte 2 — "ver pruebas documentos": interpretación confirmada con el owner (2026-07-28) es
poder **abrir/previsualizar el archivo** de un documento, no solo ver su estado
(aprobado/pendiente). "Pruebas" = el respaldo.

> ⚠️ **El owner dio esta interpretación como probable, no como certeza.** Confirmar con el
> cliente antes de construir. Las otras dos lecturas descartadas eran: (a) ver los
> ensayos/exámenes rendidos por el alumno dentro del repositorio, (b) poder adjuntar la hoja
> física de la prueba rendida — hoy `class_b_exam_scores` es *"ingreso manual"* del puntaje,
> sin lugar para escanear la hoja. Si resulta ser (b), esto deja de ser un fix chico y
> necesita migración.

**Hipótesis de valor:**
Admin y Secretaría dejan de gestionar documentos de instructores fuera del sistema (correo,
carpetas físicas/compartidas) y pueden verificar el respaldo real de un documento sin salir
de la app.

---

## 2. User Stories

- **US1**: Como Admin o Secretaría, quiero ver una sección de documentos de Instructores en
  paralelo a la de Alumnos, para gestionar los documentos requeridos de cada instructor en el
  mismo lugar donde ya gestiono los de alumnos.
- **US2**: Como Admin o Secretaría, quiero subir un documento para un instructor y marcar su
  estado (aprobado/pendiente), igual que ya hago con documentos de alumnos.
- **US3**: Como Admin o Secretaría, quiero poder abrir/previsualizar el archivo real subido de
  un documento de instructor, para verificar su contenido sin descargarlo aparte.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given que un Admin o Secretaría navega al repositorio de documentos, When entra,
  Then ve una sección/pestaña "Instructores" en paralelo a la de "Alumnos" ya existente,
  listando los instructores con sus documentos.
- **AC2**: Given que abre el detalle de un instructor, When consulta sus documentos, Then ve
  cada documento con su tipo y su estado (aprobado/pendiente), mismo patrón visual que el
  detalle de documentos de un alumno.
- **AC3**: Given que sube un documento nuevo para un instructor, When completa el formulario,
  Then debe elegir el tipo de documento de un enum predefinido (ver sección 6) y adjuntar el
  archivo.
- **AC4**: Given un documento de instructor con archivo ya subido, When hace clic en la opción
  de previsualizar/ver, Then el sistema abre el archivo real (vía signed URL, reutilizando
  `createSignedUrl()` de `dms.facade.ts:171`), no solo el estado.
- **AC5**: Given que Secretaría navega a la sección de Instructores del repositorio, When
  consulta la lista, Then solo ve instructores de su propia sede (mismo patrón de scope por
  `branch_id` que el resto de facades multi-sede del proyecto).

### Edge cases obligatorios

- **AC-E1**: Given un documento de instructor sin archivo subido todavía, When el usuario
  intenta previsualizarlo, Then la opción de ver archivo aparece deshabilitada (no falla ni
  muestra un visor vacío).
- **AC-E2**: Given un Admin, When consulta la sección de Instructores, Then ve instructores de
  todas las sedes (sin filtro de `branch_id`), a diferencia de Secretaría.

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Portal del propio instructor para autogestionar/subir sus propios documentos — decisión
  del owner (2026-07-29): solo Admin y Secretaría por ahora.
- ❌ Las dos lecturas descartadas de "ver pruebas documentos": ver ensayos/exámenes rendidos
  por el alumno, o adjuntar la hoja física de un examen escaneada — esta última necesitaría
  migración de `class_b_exam_scores` y es un feature distinto si el cliente la confirma.
- ❌ Documentos de relatores de Clase Profesional (`lecturers`) — decisión del owner
  (2026-07-29): esta spec cubre solo instructores de Clase B (`instructors`). `lecturers` es
  una tabla separada, sin cuenta de usuario (`indices/DATABASE.md:1070`); si el cliente lo
  pide, es una extensión a evaluar aparte, no parte de esta spec.

---

## 5. Dependencias

### Specs previas
- (IDs de specs que deben estar `done` antes, o "ninguna")

### Capacidades del proyecto que se asumen existentes
- Visor de archivo vía `createSignedUrl(path, 3600)` en `src/app/core/facades/dms.facade.ts:171`.
- Tabla `instructors` (`indices/DATABASE.md:1024`) con `id`, `user_id`, `license_*`, sin
  columna de branch propia — se deriva vía join a `users.branch_id` (mismo patrón ya usado en
  `instructores.facade.ts:262`, `.eq('users.branch_id', branchId)`, con `resolveBranchScope()`
  de `branch-scope.utils.ts`). Reutilizar tal cual, no reinventar.
- Patrón ya existente de repositorio de documentos de alumnos (`student_documents` +
  `AdminDocumentosComponent` / `AdminAlumnoDocsDetalleComponent`) como referencia de UX y
  estructura a replicar para instructores.
- Confirmado (2026-07-29): esta spec cubre solo `instructors` (Clase B), no `lecturers`
  (relatores de Clase Profesional, sin cuenta de usuario) — ver sección 4.

### Capacidades nuevas requeridas
- Tabla nueva para documentos de instructor (nombre y esquema exacto a definir en `plan.md`
  — candidato: `instructor_documents`, análoga a `student_documents`, con `storage_url` como
  **path relativo** igual que el resto desde `20260413000001`).
- Ruta(s) nuevas de documentos de instructores, en paralelo a
  `/app/admin/documentos/alumnos/:id` (y equivalente de secretaría).
- RLS scoped por sede para Secretaría (ver AC5/AC-E2).

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: tabla nueva de documentos de instructor (ver sección 5).
  Ninguna de las tablas existentes (`school_documents`, `student_documents`) tiene columna
  `instructor_id` — no se puede reutilizar ninguna sin migración.
- Enum de tipos de documento — investigado (Decreto Supremo N°39/1985 MTT, "Reglamento de
  Escuelas de Conductores [no profesionales / Clase B]"), adoptado como lista de trabajo por
  decisión del owner (2026-07-29). **No es asesoría legal formal** — validar con el cliente
  antes de cerrar producción (ver sección 9):
  - `certificado_antecedentes` — certificado de antecedentes penales
  - `certificado_ensenanza_media` — certificado de 4° medio rendido/aprobado
  - `certificado_curso_transito_mecanica` — curso de capacitación en tránsito y mecánica
  - `hoja_vida_conductor` — hoja de vida del conductor (Carabineros)
  - `credencial_semep` — credencial SEMEP (Carabineros; ex-INIVIP), habilita para instructor
    Clase B/C
  - `licencia_clase_b` — solo instructores prácticos: licencia clase B con antigüedad ≥ 7 años
  - Si el instructor es también director de la escuela: se suma
    `certificado_curso_instructor_teorico`
- Modelos UI nuevos: `InstructorDocument` (ui/) análogo a como se maneja `StudentDocument`
  hoy, a definir en `plan.md`.
- RLS requerida: SELECT scoped por sede para Secretaría (vía el `branch_id` que se determine
  para el instructor en `plan.md`); Admin sin filtro. INSERT/UPDATE para Admin y Secretaría.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): repositorio de documentos (Admin y Secretaría) — nueva
  sección/pestaña "Instructores" en paralelo a "Alumnos"; nueva vista de detalle por
  instructor (lista de documentos + estado).
- Flujo principal (happy path): el usuario entra al repositorio → cambia a la pestaña
  Instructores → selecciona un instructor → ve/sube documentos → puede abrir el archivo de un
  documento ya subido para previsualizarlo.
- Estados especiales: instructor sin ningún documento subido (vacío, no error); documento sin
  archivo (opción de previsualizar deshabilitada, AC-E1); Secretaría sin instructores en su
  sede (vacío).

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Cero solicitudes de documentos de instructores gestionadas fuera del sistema (correo,
  carpetas compartidas) después del despliegue.
- Uso real del visor de previsualización (evidencia de que "ver pruebas documentos" era la
  interpretación correcta).

---

## 9. Notas / decisiones abiertas

- [x] **Roles con acceso:** Admin y Secretaría — confirmado por el owner 2026-07-29 (ver
  sección 1 y AC5/AC-E2). El propio instructor queda fuera de scope (sección 4).
- [x] **Cómo avanzar mientras no hay respuesta legal:** placeholder mínimo (sección 6),
  ajustable después sin necesidad de spec nueva — confirmado por el owner 2026-07-29.
- [x] **Interpretación de "ver pruebas documentos":** se construye el visor de
  abrir/previsualizar archivo con esa lectura — confirmado por el owner 2026-07-29, ver AC4.
- [x] **¿Qué documentos necesitamos de los instructores para cumplir la ley?** Investigado
  2026-07-29 vía Decreto Supremo N°39/1985 del MTT ("Reglamento de Escuelas de Conductores
  no profesionales o Clase B") — lista adoptada como enum de trabajo en sección 6. **No es
  asesoría legal formal**: sigue pendiente que el cliente la valide antes de ir a producción
  (son documentos de un trabajador, alcanzados por la Ley 21.719 — pasar por el skill
  `compliance-cl` antes de definir retención/campos sensibles). Fuentes: Decreto 39/1985
  (subtrans.gob.cl/pdf/DEC_39.1985.pdf), Decreto 251/1998 (conaset.cl, Escuelas de Conductores
  Profesionales — sin detalle equivalente para relatores, no aplica porque `lecturers` queda
  fuera de scope, ver sección 4).
- [x] **Alcance de entidad:** solo `instructors` (Clase B), no `lecturers` (relatores
  Profesional) — confirmado por el owner 2026-07-29, ver sección 4.
- [x] **Derivación de `branch_id` de un instructor:** vía join a `users.branch_id`, mismo
  patrón que `instructores.facade.ts:262` — no requiere diseño nuevo, ver sección 5.
- [ ] Verificar en `plan.md` si `student_documents` tiene el mismo visor que
  `school_documents` o solo este último, y extenderlo donde falte.
- Originado de Asignación ASG-b-042 (specs/assignments/ASG-b-042-repositorio-documentos-instructores.md)

---

## Changelog

- 2026-07-29 — draft inicial por m, a partir de ASG-b-042.
- 2026-07-29 — User Stories, ACs, out of scope y modelo preliminar completados con decisiones
  del owner: acceso Admin+Secretaría, enum de tipos de documento como placeholder ajustable,
  visor de archivo se construye con la interpretación de "ver pruebas documentos" = abrir el
  archivo real.
- 2026-07-29 — Cerradas las 2 preguntas abiertas restantes: (1) enum de tipos de documento
  investigado vía Decreto 39/1985 y 251/1998 del MTT, adoptado como lista de trabajo (a validar
  con el cliente antes de producción, no es asesoría legal); en el camino se acotó el alcance a
  solo `instructors` (Clase B), excluyendo `lecturers` (Profesional) por decisión del owner —
  (2) `branch_id` de instructor se deriva vía join a `users.branch_id`, reutilizando el patrón
  ya existente en `instructores.facade.ts`, sin diseño nuevo.
