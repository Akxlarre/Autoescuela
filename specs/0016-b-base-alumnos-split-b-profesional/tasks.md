# Tasks 0016-b — Separación de Base de Alumnos en páginas Clase B / Profesional

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-06-23

---

## Cómo usar este archivo

- Cada tarea es **atómica** (un sitting, ~30–90 min).
- Marcá `[x]` apenas pase su DoD (no en bloque).
- Estructurado en las **3 fases** del plan + cierre. Cada fase es un entregable testeable/mergeable.
- Sin migración SQL (el discriminador `enrollments.license_group` ya existe).

---

## Fase 1 — Base B (acotar la lista existente a `class_b`)

- [x] **T1.1** — Tests primero: `admin-alumnos.facade.spec.ts` (TDD)
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [ ] Test: `fetchAlumnosData` excluye alumnos solo-profesional (resultado solo `class_b`)
    - [ ] Test: alumno con B + Profesional → el "enrollment representativo" elegido es el más reciente **dentro de B** (no global)
    - [ ] Test: branch-scope intacto (null = todas, id = filtra)
    - [ ] Tests FALLAN antes de implementar (rojo)

- [x] **T1.2** — `admin-alumnos.facade.ts`: filtrar a `class_b` + selección within-group
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [ ] Query/`mapToAlumnoTableRow` consideran solo enrollments `license_group='class_b'`
    - [ ] Enrollment representativo = más reciente con estado válido **dentro de B**
    - [ ] `catchError`/signal de error intactos; branch-scope intacto
    - [ ] `npm run test:ci` verde (T1.1 pasa)

- [x] **T1.3** — `alumnos-list-content.component.ts`: limpiar accesos B y arreglar filtro
  - **AC ref:** AC2, AC3, AC4
  - **DoD:**
    - [ ] Quitada la acción "Pre-inscritos" del hero
    - [ ] Acción "Ex-Alumnos" renombrada a **"Ex-Alumnos B"**
    - [ ] `filteredAlumnos()` filtra por `licenseGroup`/clase (no por nombre exacto); "Clase B SENCE" se incluye
    - [ ] Sin colores hardcodeados; `app-icon`; `data-llm-*` en acciones
    - [ ] Cambios visibles igual en Admin y Secretaria (componente compartido)

- [x] **T1.4** — `admin-alumnos.component.ts`: quitar wiring de pre-inscritos
  - **AC ref:** AC2
  - **DoD:**
    - [ ] Eliminados `preInscritosRequested`/`navigateToPreInscritos`
    - [ ] OnPush + `effect(branchId)` intactos; compila

- [x] **T1.5** — Validación Fase 1
  - **DoD:**
    - [x] `ng build` limpio (solo warning de bundle budget preexistente)
    - [x] `npm run test:ci` (admin-alumnos.facade) 6/6 verde
    - [x] `lint:arch`: 0 errores nuevos en archivos tocados (solo 2 warns ARCH-10 de complejidad: `fetchAlumnosData` 61L / `mapToAlumnoTableRow` 53L — no bloqueantes, consistentes con el código existente). Los 39 errores del audit son preexistentes en otros facades.
    - [ ] `/verify` Playwright **pendiente** — requiere `ng serve` activo (QA visual al cerrar la spec)

---

## Fase 2 — Base Alumnos Profesional (nueva)

- [x] **T2.1** — UI Model `core/models/ui/alumno-profesional-table-row.model.ts`
  - **AC ref:** AC6
  - **DoD:**
    - [ ] Interface `AlumnoProfesionalTableRow` (Nº matrícula, promoción/curso, semáforo, progreso módulos, estado, saldo, enrollmentId)
    - [ ] Reusa el tipo `AlumnoStatus` existente (no duplicar)
    - [ ] Documentado en `indices/MODELS.md`

- [x] **T2.2** — Tests primero: `admin-alumnos-profesional.facade.spec.ts` (TDD)
  - **AC ref:** AC6, AC8, AC-E1, AC-E3
  - **DoD:**
    - [ ] Test: solo enrollments `license_group='professional'`
    - [ ] Test: branch-scope (null vs id)
    - [ ] Test: mapeo a `AlumnoProfesionalTableRow` (semáforo, progreso, saldo)
    - [ ] Test edge: alumno sin promoción/sin notas → estados vacíos ("—") sin romper
    - [ ] Tests FALLAN antes de implementar

- [x] **T2.3** — `core/facades/admin-alumnos-profesional.facade.ts`
  - **AC ref:** AC6, AC8, AC-E1, AC-E3
  - **DoD:**
    - [ ] Estructura facade: estado privado → público readonly → métodos
    - [ ] `BranchFacade` inyectado (regla facades.md §7); `effect()` NO va aquí
    - [ ] Join `enrollments(professional) + students + users + promotion_courses(courses) + v_professional_attendance + professional_module_grades`
    - [ ] SWR `initialize()` + `refreshSilently()`; Realtime suscrito a tabla base `enrollments` (no a la VIEW)
    - [ ] `catchError` + signal de error; `dispose()` limpia Realtime
    - [ ] `npm run test:ci` verde (T2.2 pasa)
    - [ ] Documentado en `indices/FACADES.md`

- [x] **T2.4** — Dumb `shared/components/alumnos-profesional-list-content/…component.ts`
  - **AC ref:** AC6, AC7, AC8
  - **DoD:**
    - [ ] OnPush, solo `input()`/`output()` (sin facades)
    - [ ] Columnas: Nº matrícula, promoción, progreso módulos, semáforo (tokens de estado), estado, saldo, acciones
    - [ ] Acción "Pre-inscritos" (output) + empty-state + skeleton colocado (`loading`)
    - [ ] Tokens de color, `app-icon`, `data-llm-*`; tests de `computed()` si los hay
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T2.5** — Smart admin + secretaria (`features/{admin|secretaria}/alumnos-profesional/`)
  - **AC ref:** AC6, AC12
  - **DoD:**
    - [ ] OnPush; inyectan `AdminAlumnosProfesionalFacade`
    - [ ] `effect()` reacciona a `branchFacade.selectedBranchId()`; `destroyRef.onDestroy(() => facade.dispose())`
    - [ ] Bento grid como raíz; ambos portales con paridad
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T2.6** — Rutas + menú de la Base Profesional
  - **AC ref:** AC5, AC-E2, AC12
  - **DoD:**
    - [ ] `app.routes.ts`: `admin/clase-profesional/alumnos` y `secretaria/profesional/alumnos`
    - [ ] `menu-config.service.ts`: ítem "Base Alumnos Prof." en *Academia Profesional* (admin+secretaria) con `requiresProfessional: true`
    - [ ] Verificado: sede sin profesional NO muestra el ítem

- [x] **T2.7** — Mover Pre-inscritos a la base Profesional
  - **AC ref:** AC7, AC9
  - **DoD:**
    - [ ] Ruta movida a `clase-profesional/pre-inscritos` (admin) / `profesional/pre-inscritos` (secretaria)
    - [ ] `backRoute` de `admin-pre-inscritos` y `secretaria-alumnos-pre-inscritos` → base Profesional
    - [ ] Acción "Pre-inscritos" cableada desde la base Profesional; enlaces viejos a `/alumnos/pre-inscritos` actualizados
    - [ ] `grep` sin referencias muertas a la ruta anterior

- [x] **T2.8** — Animación + wire-up Fase 2
  - **DoD:**
    - [ ] `GsapAnimationsService.animateBentoGrid()` en `ngAfterViewInit`; `clearProps: 'transform'`
    - [ ] Loading/error/empty cubiertos; sin `@angular/animations`/`@keyframes`

- [x] **T2.9** — Validación Fase 2
  - **DoD:**
    - [x] `ng build` limpio (solo warning NG8113 preexistente ajeno)
    - [x] `npm run test:ci` (ambos facades alumnos) 12/12 verde
    - [x] `lint:arch`: 0 errores nuevos (2 warns de complejidad ARCH-09/10, consistentes con el código)
    - [ ] `/verify` Playwright **pendiente** — requiere `ng serve` (QA visual al cerrar la spec)

---

## Fase 3 — Ex-Alumnos split (B / Profesional)

- [x] **T3.1** — `ex-alumnos.facade.ts`: exponer egresados por grupo
  - **AC ref:** AC11
  - **DoD:**
    - [ ] Listas/filtro por grupo a partir de `egresadosClaseB`/`egresadosProfesional` (o selección de grupo)
    - [ ] `ex-alumnos.facade.spec.ts` cubre ambas listas; `npm run test:ci` verde

- [x] **T3.2** — Ex-Alumnos B: acotar páginas existentes (admin + secretaria)
  - **AC ref:** AC4, AC11
  - **DoD:**
    - [ ] `admin-ex-alumnos`/`secretaria-ex-alumnos` muestran solo `class_b`
    - [ ] OnPush intacto; compila

- [x] **T3.3** — Ex-Alumnos Profesional: Smart nuevo (admin + secretaria)
  - **AC ref:** AC11, AC12
  - **DoD:**
    - [ ] Smart reusa `ExAlumnosFacade` (grupo profesional) + componentes de presentación existentes
    - [ ] Bento grid raíz; paridad admin/secretaria
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T3.4** — Rutas + menú Ex-Alumnos
  - **AC ref:** AC10
  - **DoD:**
    - [ ] `app.routes.ts`: rutas ex-alumnos profesional (admin+secretaria)
    - [ ] `menu-config.service.ts`: "Ex-Alumnos B" en *Academia Clase B* y "Ex-Alumnos Prof." en *Academia Profesional* (`requiresProfessional`); **removidos** de *Finanzas y Caja*

- [x] **T3.5** — Validación Fase 3
  - **DoD:**
    - [x] `ng build` limpio (solo warning NG8113 preexistente ajeno)
    - [x] `npm run test:ci` (ex-alumnos + ambos alumnos facades) 15/15 verde — además se arregló un spec roto preexistente de `ex-alumnos.facade.spec.ts`
    - [ ] `/verify` Playwright pendiente — requiere `ng serve`
  - **Nota:** `secretaria-ex-alumnos` (B) era un stub mockup preexistente → **reconstruido a funcional** (espejo del admin, rutas secretaría) para cerrar paridad AC12; verificado en vivo Playwright. Ex-Alumnos Profesional funcional en ambos portales.

---

## Fase 4 — Cierre

- [x] **T4.1** — `acceptance.md` generado con evidencia (15/15 ACs, QA Playwright admin + multi-sede)
- [x] **T4.2** — Índices actualizados durante las fases (FACADES, MODELS, COMPONENTS)
- [x] **T4.3** — 0016-b movida a `Done` en `specs/ROADMAP.md`
- [x] **T4.4** — `specs/.active` limpiado

---

## Tareas descubiertas durante implementación

> Si surge algo del scope de la spec no listado, agregalo acá. Si está fuera de scope → spec nueva.

- [ ] …
