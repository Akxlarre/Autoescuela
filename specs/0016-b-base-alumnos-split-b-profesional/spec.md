# Spec 0016-b — Separación de Base de Alumnos en páginas Clase B / Profesional

> **Status:** approved
> **Created:** 2026-06-23
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** iniciativa interna (conversación 2026-06-23 — análisis de la base de alumnos).

**Persona afectada:** Admin y Secretaria.

**Problema que resuelve:**
La "Base de Alumnos" muestra hoy a los alumnos de Clase B y de Clase Profesional **mezclados en una sola tabla**, pese a que el menú ya rotula esa página como "Base Alumnos B" y a que el grupo *Academia Profesional* no tiene su propia base. Son procesos académicos distintos (Clase B: expediente CI/foto/médico/SEMEP + progreso práctico 12 clases; Profesional: promoción, módulos 1–7, semáforo de asistencia), por lo que verlos juntos confunde la operación y obliga a filtrar manualmente. Además, la sub-página "Pre-inscritos" ya es 100% profesional pero cuelga de la página B, y "Ex-Alumnos" es mixta.

**Hipótesis de valor:**
Separar la gestión en páginas dedicadas por tipo de licencia reduce el tiempo de búsqueda y los errores operativos, y deja cada base alineada con su flujo académico real.

---

## 2. User Stories

> Borrador 2026-06-23 — pendiente de confirmación del usuario.

- **US1**: Como **Admin/Secretaria**, quiero que la "Base Alumnos B" muestre **solo alumnos de Clase B**, para gestionar la academia B sin el ruido de los alumnos profesionales.
- **US2**: Como **Admin/Secretaria**, quiero una **"Base Alumnos Profesional" dedicada** dentro del menú *Academia Profesional*, con columnas propias del flujo profesional (promoción, módulos 1–7, semáforo de asistencia, estado), para seguir el avance profesional sin adaptar columnas pensadas para Clase B.
- **US3**: Como **Admin/Secretaria**, quiero acceder a los **Pre-inscritos profesionales desde la base Profesional** (no desde la base B), para que la navegación sea coherente con el tipo de licencia.
- **US4**: Como **Admin/Secretaria**, quiero **Ex-Alumnos separados** por tipo de licencia (B y Profesional), cada uno en su academia, para consultar el archivo histórico correcto sin mezclar egresados.
- **US5**: Como **Admin/Secretaria de una sede sin profesional** (ej. Autoescuela Chillán), quiero que las páginas profesionales **no aparezcan en mi menú**, para no ver opciones irrelevantes a mi sede.
- **US6**: Como **Admin/Secretaria**, quiero que un alumno con matrícula **B y Profesional a la vez** aparezca correctamente en **ambas bases**, mostrando en cada una los datos de su matrícula de ese grupo, para no perder de vista a la persona ni confundir su información.

---

## 3. Acceptance Criteria (Gherkin)

> Borrador 2026-06-23 — pendiente de confirmación del usuario.
> Cada AC aplica tanto al portal **Admin** como al **Secretaria** (paridad), salvo que se indique.

### Base Alumnos B (US1)

- **AC1**: Given estoy en `/app/admin/alumnos` (o `/app/secretaria/alumnos`), When carga la lista, Then **solo** veo alumnos cuya matrícula representativa es `license_group = 'class_b'` (ningún alumno exclusivamente profesional aparece).
- **AC2**: Given la lista B, When observo el hero/acciones, Then **no existe** el botón "Pre-inscritos" (ese acceso vive ahora en la base Profesional).
- **AC3**: Given la lista B con el filtro de curso, When selecciono "Clase B SENCE", Then la lista filtra correctamente esos alumnos (el filtro opera por `licenseGroup`/clase, corrigiendo el bug actual de match por nombre exacto).
- **AC4**: Given la lista B, When miro la acción de archivo histórico del hero, Then dice **"Ex-Alumnos B"** y navega a la página de Ex-Alumnos de Clase B.

### Base Alumnos Profesional (US2)

- **AC5**: Given soy Admin/Secretaria en una sede **con** profesional, When abro el grupo de menú *Academia Profesional*, Then aparece el ítem **"Base Alumnos Prof."** que navega a `/app/admin/clase-profesional/alumnos` (admin) o `/app/secretaria/profesional/alumnos` (secretaria).
- **AC6**: Given estoy en la Base Alumnos Profesional, When carga, Then **solo** veo alumnos con matrícula `license_group = 'professional'`, con columnas propias: **Nº matrícula, promoción/curso, progreso de módulos 1–7, semáforo de asistencia** (`v_professional_attendance`), **estado** y **saldo/deuda**.
- **AC7**: Given la Base Alumnos Profesional, When uso su acción de Pre-inscritos, Then llego a "Pre-inscritos Clase Profesional".
- **AC8**: Given la lista profesional, When no hay alumnos profesionales en la sede activa, Then se muestra un empty-state (no error, no skeleton infinito).

### Pre-inscritos Profesional (US3)

- **AC9**: Given estoy en "Pre-inscritos Clase Profesional", When miro su botón "volver"/breadcrumb (`backRoute`), Then apunta a la **Base Alumnos Profesional** (ya no a `/…/alumnos` de Clase B).

### Ex-Alumnos separados (US4)

- **AC10**: Given el menú, When lo recorro, Then "Ex-Alumnos B" está en *Academia Clase B* y "Ex-Alumnos Prof." en *Academia Profesional* — y **ninguno** sigue en el grupo *Finanzas y Caja*.
- **AC11**: Given estoy en "Ex-Alumnos B", When carga, Then **solo** veo egresados `class_b`; Given estoy en "Ex-Alumnos Profesional", When carga, Then **solo** veo egresados `professional`.

### Paridad de portales

- **AC12**: Given el portal **Secretaria**, When navego por Alumnos y Profesional, Then existen las mismas vistas separadas (Base B, Base Profesional, Pre-inscritos Prof., Ex-Alumnos B, Ex-Alumnos Prof.) que en **Admin**, respetando las restricciones de sede/rol.

### Edge cases obligatorios

- **AC-E1**: Given un alumno con matrícula **B y Profesional** simultáneas, When abro cada base, Then aparece en ambas, mostrando en cada una los datos de la matrícula **del grupo correspondiente** (el "enrollment representativo" se elige dentro del grupo, no global — sin datos cruzados).
- **AC-E2**: Given una sede **sin** profesional (sede 1 — Autoescuela Chillán), When carga el menú, Then "Base Alumnos Prof." y "Ex-Alumnos Prof." **no se muestran** (`requiresProfessional`), y sus rutas no son alcanzables desde esa sede.
- **AC-E3**: Given un alumno profesional **sin promoción asignada o sin notas de módulos**, When aparece en la Base Profesional, Then sus columnas muestran estados vacíos legibles ("—" / "Sin promoción") sin romper el render.
- **AC-E4**: Given la papelera/archivado de alumnos, When la uso en cualquiera de las dos bases, Then opera **solo** sobre alumnos del grupo de esa base.

---

## 4. Out of scope

- ❌ Cambios de esquema en base de datos / migraciones (el split es frontend: `license_group` ya existe en `enrollments`).
- ❌ Rediseño del **detalle de alumno** `/alumnos/:id` (sigue siendo por persona, license-agnóstico).
- ❌ Cambios en el flujo de matrícula / pre-inscripción pública.
- ❌ Unificar o cambiar el comportamiento de papelera/archivado (se mantiene).
- ❌ Portal Instructor y Alumno (solo Admin y Secretaria).

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante.

### Capacidades del proyecto que se asumen existentes
- `enrollments.license_group` ('class_b' | 'professional') poblado por trigger desde `courses.license_class`.
- `BranchFacade.selectedBranchId()` + `requiresProfessional` en el menú (`menu-config.service.ts`) ya filtran por sede.
- `AdminAlumnosFacade` + `alumnos-list-content` (compartido admin+secretaria) para la base B.
- `ExAlumnosFacade` con computeds `egresadosClaseB` / `egresadosProfesional`.
- `AdminPreInscritosFacade` (lee `professional_pre_registrations`) para pre-inscritos profesional.
- Vistas/tablas profesional: `v_professional_attendance` (semáforo), `professional_module_grades`, `promotion_courses`.

### Capacidades nuevas requeridas
- `AdminAlumnosProfesionalFacade` (branch-scoped, datos de alumnos profesional).
- Componente `alumnos-profesional-list-content` (columnas profesional).
- Model UI `alumno-profesional-table-row.model.ts`.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: **ninguna**.
- Modelos UI nuevos: `alumno-profesional-table-row.model.ts` (Nº matrícula, promoción, progreso módulos 1–7, semáforo asistencia, estado, saldo/deuda).
- RLS requerida: ninguna nueva (se reusan las policies existentes de `enrollments`/`students`/vistas profesional).
- Decisión técnica a confirmar en `plan.md`: ¿la base B reusa `AdminAlumnosFacade` filtrando a `class_b`, o se introduce un filtro `licenseGroup`? El "enrollment principal" debe elegirse **dentro del grupo**, no global.

---

## 7. UX y flujos (preliminar)

**Pantallas afectadas (Admin y Secretaria):**

| Página | Antes | Después |
|--------|-------|---------|
| Base Alumnos B | `/…/alumnos` (mixta) | `/…/alumnos` solo Clase B. Sin botón "Pre-inscritos" (es prof.). Filtro de curso → `licenseGroup`. "Ex-Alumnos" → "Ex-Alumnos B". |
| Base Alumnos Profesional | ❌ no existe | **Nueva** `/app/admin/clase-profesional/alumnos` y `/app/secretaria/profesional/alumnos`, en grupo *Academia Profesional* (`requiresProfessional`). |
| Pre-inscritos Profesional | `/…/alumnos/pre-inscritos` (cuelga de B) | Cuelga de la base Profesional (`backRoute` y enlaces actualizados). |
| Ex-Alumnos | `/…/ex-alumnos` (mixta, grupo Finanzas) | Dividida: *Ex-Alumnos B* (Academia B) + *Ex-Alumnos Profesional* (Academia Profesional). |

**Menú:** +2 ítems en *Academia Profesional* (Base Alumnos Prof., Ex-Alumnos Prof.); reubicar "Ex-Alumnos B" desde *Finanzas y Caja* a *Academia Clase B*.

**Estados especiales:** loading (skeleton ya existente / nuevo para lista profesional), vacío (empty-state), error (signal de error en facade).

---

## 8. Métricas de éxito post-launch

- (Opcional) Reducción de uso del filtro manual de curso en la lista de alumnos.
- 0 reportes de "no encuentro al alumno profesional / B".

---

## 9. Notas / decisiones abiertas

Decisiones YA tomadas (2026-06-23):
- [x] Páginas separadas (no tabs).
- [x] Base Profesional con **componente propio nuevo** (no reusar el compartido).
- [x] **Ex-Alumnos también se separa** (B / Profesional).
- [x] Aplica a **Admin y Secretaria**.

Decisiones cerradas (2026-06-23):
- [x] Redactar User Stories (§2) y Acceptance Criteria (§3) por página — confirmadas por el usuario.
- [x] Columnas de la lista profesional: **Nº matrícula, promoción/curso, módulos 1–7, semáforo, estado, saldo/deuda**.
- [x] Prioridad **P1**.
- [x] Rutas: admin `/app/admin/clase-profesional/alumnos`, secretaria `/app/secretaria/profesional/alumnos` (paridad con el patrón de cada portal).

---

## Changelog

- 2026-06-23 — draft inicial por Akxlarre (contexto y secciones técnicas pre-llenadas desde el análisis; US/AC pendientes).
- 2026-06-23 — borrador de User Stories (US1–US6) y Acceptance Criteria (AC1–AC12 + AC-E1–E4) agregado; pendiente de confirmación.
- 2026-06-23 — US/AC confirmados por el usuario; columnas profesional + rutas + P1 cerradas; status → **approved**.
