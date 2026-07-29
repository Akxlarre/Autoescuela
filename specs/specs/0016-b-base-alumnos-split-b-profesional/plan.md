# Plan 0016-b — Separación de Base de Alumnos en páginas Clase B / Profesional

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-06-23
> **Talla:** **L** (⚠️ revisar este plan antes de implementar — tamaño alto)

---

## 1. Resumen ejecutivo

Separar la base de alumnos (hoy unificada) en páginas dedicadas por tipo de licencia, en Admin y Secretaria, **sin migración de BD** (el discriminador `enrollments.license_group` ya existe). Se ejecuta en **3 fases** independientes y testeables:

- **Fase 1 — Base B:** acotar la lista existente a `class_b`, arreglar el filtro de curso, quitar el acceso profesional (pre-inscritos) y renombrar el acceso a Ex-Alumnos. Bajo riesgo.
- **Fase 2 — Base Profesional:** facade + componente + modelo + rutas + menú nuevos; mover Pre-inscritos a esta base.
- **Fase 3 — Ex-Alumnos split:** dividir el archivo histórico en B y Profesional, reubicándolos en sus academias.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/models/ui/alumno-profesional-table-row.model.ts` | UI Model | Fila de la base profesional: Nº matrícula, promoción/curso, progreso módulos 1–7, semáforo asistencia, estado, saldo. |
| `src/app/core/facades/admin-alumnos-profesional.facade.ts` | Facade | Lista plana branch-scoped de alumnos `license_group='professional'` (SWR + Realtime en `enrollments`). |
| `src/app/core/facades/admin-alumnos-profesional.facade.spec.ts` | Test | Cobertura: filtrado por grupo, branch-scope, mapeo, edge case sin promoción. |
| `src/app/shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts` | Dumb | Tabla/cards profesional (columnas propias) + filtros + export. Espejo conceptual de `alumnos-list-content` pero con columnas profesional. |
| `src/app/features/admin/alumnos-profesional/admin-alumnos-profesional.component.ts` | Smart | Página Base Alumnos Profesional (Admin). |
| `src/app/features/secretaria/alumnos-profesional/secretaria-alumnos-profesional.component.ts` | Smart | Página Base Alumnos Profesional (Secretaria). |
| `src/app/features/admin/ex-alumnos-profesional/admin-ex-alumnos-profesional.component.ts` | Smart | Ex-Alumnos Profesional (Admin) — Fase 3. |
| `src/app/features/secretaria/ex-alumnos-profesional/secretaria-ex-alumnos-profesional.component.ts` | Smart | Ex-Alumnos Profesional (Secretaria) — Fase 3. |

### Archivos a MODIFICAR

| Path | Cambio | Fase |
|------|--------|------|
| `src/app/core/facades/admin-alumnos.facade.ts` | `fetchAlumnosData`: filtrar a `license_group='class_b'`; elegir "enrollment representativo" **dentro del grupo B** (no global). | 1 |
| `src/app/core/facades/admin-alumnos.facade.spec.ts` | Tests del filtro class_b + selección within-group. | 1 |
| `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts` | Quitar acción "Pre-inscritos" del hero; renombrar "Ex-Alumnos" → "Ex-Alumnos B"; arreglar `filteredAlumnos()` para filtrar por `licenseGroup`/clase (no por nombre exacto). | 1 |
| `src/app/features/admin/alumnos/admin-alumnos.component.ts` | Quitar `preInscritosRequested`/`navigateToPreInscritos` (ya no aplica a la B). | 1 |
| `src/app/app.routes.ts` | +rutas `clase-profesional/alumnos` (admin) y `profesional/alumnos` (secretaria); mover `pre-inscritos` a path profesional; +rutas ex-alumnos profesional. | 2,3 |
| `src/app/core/services/auth/menu-config.service.ts` | +"Base Alumnos Prof." y +"Ex-Alumnos Prof." en *Academia Profesional* (admin+secretaria, `requiresProfessional`); renombrar/mover "Ex Alumnos" a "Ex-Alumnos B" en *Academia Clase B*. | 2,3 |
| `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscritos.component.ts` | `backRoute` → base profesional. | 2 |
| `src/app/features/secretaria/alumnos-pre-inscritos/secretaria-alumnos-pre-inscritos.component.ts` | `backRoute` → base profesional. | 2 |
| `src/app/core/facades/ex-alumnos.facade.ts` | Exponer egresados filtrados por grupo (ya hay `egresadosClaseB`/`egresadosProfesional`; agregar selección de grupo o listas separadas para cada página). | 3 |
| `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` | Acotar a `class_b` (renombrar a Ex-Alumnos B). | 3 |
| `src/app/features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts` | Acotar a `class_b`. | 3 |
| `indices/COMPONENTS.md`, `indices/FACADES.md`, `indices/MODELS.md` | Registrar lo nuevo. | cada fase |

### Archivos a ELIMINAR
Ninguno (el detalle `/alumnos/:id` se mantiene; es dual-mode vía `AdminAlumnoDetalleFacade`).

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-section-hero`, `app-action-kpi-card`, `app-empty-state`, `app-skeleton-block`, `app-icon` — para la nueva página profesional.
- `[appBentoGridLayout]`, `[appAnimateIn]`, `GsapAnimationsService.animateBentoGrid()` — layout/animación canónica.
- `eliminar-alumno-modal` — reusable para archivar en la base profesional.

### Facades/Services existentes que extendemos o referenciamos
- `AdminAlumnosFacade` — se **acota** a `class_b` (Fase 1).
- `ExAlumnosFacade` — ya tiene `egresadosClaseB`/`egresadosProfesional`; se parametriza por grupo (Fase 3).
- `AdminPreInscritosFacade` — sin cambios de lógica (ya es 100% profesional); solo se re-ubica su página.
- `ArchivoFacade` (`archivo-profesional.facade.ts`) y `AdminAlumnoDetalleFacade` — **referencia de queries** para joins `enrollments + students + users + promotion_courses + professional_*_attendance + professional_module_grades`.
- `BranchFacade` — scope de sede (regla facades.md §7).

### Lo que NO existe y debemos crear (justificación)
- `AdminAlumnosProfesionalFacade`: `ArchivoFacade` es un selector en cascada (promoción→curso) y solo `status='finished'`; necesitamos una **lista plana** de profesionales activos branch-scoped. No es reutilizable directamente.
- `alumnos-profesional-list-content`: el `alumnos-list-content` actual tiene columnas propias de Clase B (Expediente CI/foto/médico/SEMEP, examen teórico/práctico) que no aplican a profesional. Decisión confirmada: **componente propio**.

---

## 4. Modelo de datos

**N/A — sin cambios de esquema.** Se usan tablas/vistas existentes: `enrollments` (`license_group`, `pending_balance`, `number`, `status`), `students`, `users`, `promotion_courses`+`courses`, `v_professional_attendance` (semáforo), `professional_module_grades` (módulos 1–7). RLS existente cubre todo.

### Modelo UI nuevo
```ts
// core/models/ui/alumno-profesional-table-row.model.ts
export interface AlumnoProfesionalTableRow {
  id: string;                 // students.id
  nombre: string; apellido: string; rut: string; email: string;
  nroMatricula: string;       // enrollments.number ('—' si draft)
  promocion: string;          // promotion_courses → courses.name + license_class
  semaforo: 'green' | 'yellow' | 'red';  // v_professional_attendance
  progresoModulos: number;    // módulos aprobados / 7
  estado: AlumnoStatus;       // reutiliza el tipo existente
  saldo: number;              // enrollments.pending_balance
  enrollmentId?: number;
}
```

---

## 5. Arquitectura del feature

```
ADMIN / SECRETARIA
  ├─ Base Alumnos B (existe)
  │    features/{admin|secretaria}/alumnos → AdminAlumnosFacade(class_b)
  │      └─ <app-alumnos-list-content>  (Dumb, compartido)   [Fase 1]
  │
  ├─ Base Alumnos Profesional (NUEVA)                         [Fase 2]
  │    features/{admin|secretaria}/alumnos-profesional
  │      ├─ inject(AdminAlumnosProfesionalFacade)  ── enrollments.license_group='professional'
  │      ├─ effect: branchFacade.selectedBranchId()
  │      └─ <app-alumnos-profesional-list-content> (Dumb nuevo)
  │           └─ acción "Pre-inscritos" → /…/pre-inscritos (AdminPreInscritosFacade)
  │
  └─ Ex-Alumnos B / Profesional (split)                       [Fase 3]
       features/{admin|secretaria}/{ex-alumnos|ex-alumnos-profesional} → ExAlumnosFacade(group)
```

- **Smart:** inyectan facades, controlan ciclo de vida (SWR `initialize()` + Realtime `dispose()`), reaccionan a `branchId`.
- **Dumb:** `input()`/`output()`, sin facades. Skeleton colocated vía `loading`.
- **Facade:** único acceso a Supabase; branch-scoped; mapea DTO→UI; selección de enrollment representativo **por grupo**.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade pattern, OnPush, Signals, control-flow nativo, clases semánticas.
- [x] `facades.md` — Branch-scoped (regla §7): el facade profesional filtra `branch_id`; el `effect()` vive en el Smart, no en el facade.
- [x] `models.md` — UI model nuevo en `core/models/ui/`; no duplicar interfaces; reusar `AlumnoStatus`.
- [x] `visual-system.md` — tokens, bento-grid root, `app-icon`, sin colores hardcodeados; semáforo con tokens de estado.
- [x] `swr-pattern.md` — facade nuevo cachea entre navegaciones + Realtime en `enrollments`.
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para el facade nuevo y los `computed()` de los Smart.
- [x] `ai-readability.md` — `data-llm-*` en acciones (archivar, exportar, ver ficha, pre-inscritos).
- [ ] `notifications.md` — no dispara notificaciones nuevas (solo toasts de archivar/restaurar ya existentes).

---

## 7. Plan de testing

- **Unitarios (vitest):**
  - `admin-alumnos-profesional.facade.spec.ts` — solo `professional`; branch-scope (null=todas vs id); mapeo a `AlumnoProfesionalTableRow`; semáforo; edge case sin promoción/sin notas (AC-E3).
  - `admin-alumnos.facade.spec.ts` — verifica que excluye `professional` y elige el enrollment representativo dentro de B (AC-E1).
  - `ex-alumnos.facade.spec.ts` — listas por grupo (AC11).
- **Smart components con `computed()`** — tests de filtros/derivados (regla testing-tdd).
- **QA visual (`/verify` Playwright):** ng serve; verificar en sede con profesional (lista profesional renderiza, semáforo, dark mode, 0 errores consola) y en sede sin profesional (ítems ocultos — AC-E2). Componentes Angular se validan además con `ng build` (ver memoria de tests).
- **Manual:** alumno con B+Profesional aparece en ambas bases sin datos cruzados (AC-E1).

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| `AdminAlumnosFacade` es compartido admin+secretaria → acotar a B afecta ambos. | Alta | Es el comportamiento deseado (ambas B-only). Verificar que la base profesional use su propio facade. |
| Enrollment representativo elegido global cruza datos en alumnos B+Prof. | Media | Seleccionar el más reciente **dentro del grupo** en cada facade (AC-E1) + test. |
| `v_professional_attendance` no dispara Realtime (es VIEW). | Media | Realtime se suscribe a la tabla base `enrollments`; el semáforo se refresca en cada fetch (regla swr-pattern: no suscribir VIEWs). |
| Mover ruta de Pre-inscritos rompe enlaces existentes. | Media | Buscar referencias a `/alumnos/pre-inscritos` y actualizarlas; mantener el componente, solo cambia path + `backRoute`. |
| Duplicar lógica de lista (B vs Prof) genera deuda. | Baja | Extraer helpers comunes (filtros, export) a utils si se repiten; columnas sí divergen por diseño. |

---

## 9. Orden de implementación

**Fase 1 — Base B** (1 PR, bajo riesgo)
1. `admin-alumnos.facade.ts` + spec: filtro `class_b` + selección within-group.
2. `alumnos-list-content`: quitar pre-inscritos, renombrar Ex-Alumnos B, arreglar filtro de curso.
3. Ajustar `admin-alumnos.component.ts`. `ng build` + tests + `/verify`.

**Fase 2 — Base Profesional** (1 PR)
4. `alumno-profesional-table-row.model.ts`.
5. `admin-alumnos-profesional.facade.ts` + spec (TDD).
6. `alumnos-profesional-list-content` (Dumb) + Smart admin/secretaria.
7. Rutas + menú (`requiresProfessional`) + mover Pre-inscritos (route + backRoute). `ng build` + tests + `/verify` (sede con y sin profesional).

**Fase 3 — Ex-Alumnos split** (1 PR)
8. `ex-alumnos.facade.ts`: listas por grupo.
9. Smart B (acotar) + Smart Profesional (nuevo) admin/secretaria.
10. Rutas + menú (mover fuera de Finanzas). `ng build` + tests + `/verify`.

**Cierre:** `/spec-verify` contra AC1–AC12 + AC-E1–E4 → `acceptance.md`; sync índices.

---

## 10. Estimación

**L — > 3 días.** Fase 1 ~0.5d · Fase 2 ~1.5–2d · Fase 3 ~1d.

---

## Changelog

- 2026-06-23 — plan inicial (talla L, 3 fases) por Akxlarre.
- 2026-06-23 — plan aprobado por el usuario; status → **approved**.
