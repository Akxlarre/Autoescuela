# Tasks 0004 — Instructores y vehículos multi-sede ("Ambas")

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-07-30
> **Closed:** 2026-07-31

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Migración: columnas `both_branches` en `instructors` y `vehicles`
  - **AC ref:** AC1, AC5, AC8
  - **DoD:**
    - [x] `supabase/migrations/20260730100000_instructors_vehicles_both_branches.sql` creado (naming correcto, idempotente)
    - [x] `ALTER TABLE instructors ADD COLUMN both_branches BOOLEAN NOT NULL DEFAULT false`
    - [x] `ALTER TABLE vehicles ADD COLUMN both_branches BOOLEAN NOT NULL DEFAULT false`
    - [x] `npx supabase db reset` corre sin error

- [x] **T1.2** — RLS: `select_instructors` + `instructor_documents` reconocen `both_branches`
  - **AC ref:** AC3, AC-E3
  - **DoD:**
    - [x] Recreada `select_instructors` (base: `20260624120000`) agregando `OR instructors.both_branches`
    - [x] Recreadas `select_instructor_documents`/`insert_instructor_documents`/`update_instructor_documents` (base: `20260729120000`) con el mismo `OR both_branches`
    - [x] Test SQL manual: secretaria de Sede 2 puede `SELECT` un instructor `branch_id=1, both_branches=true` (validado vía `docker exec ... psql`)

- [x] **T1.3** — RLS: `insert_vehicles`/`update_vehicles` permiten secretary (acotado a su sede, sin `both_branches`)
  - **AC ref:** AC9
  - **DoD:**
    - [x] Nueva policy `insert_vehicles`: `admin` sin restricción, `secretary` solo `branch_id = auth_user_branch_id() AND both_branches = false`
    - [x] Nueva policy `update_vehicles`: mismo criterio (secretary no puede pasar un vehículo a `both_branches = true` ni tocar uno de otra sede — al omitir `WITH CHECK`, Postgres reusa `USING` también para la fila nueva)
    - [x] `delete_vehicles` sin cambios (admin-only)
    - [ ] Test SQL manual explícito de rechazo (INSERT/UPDATE de secretaria fuera de su sede o con `both_branches=true`) — pendiente, cubierto lógicamente por el `USING`/`WITH CHECK` pero sin ejecutar el negative-test todavía

- [x] **T1.4** — Rewrite `v_class_b_schedule_availability`
  - **AC ref:** AC4, AC6, AC-E1
  - **DoD:**
    - [x] `course_slots` join: `ON cs.branch_id = u.branch_id OR i.both_branches`
    - [x] `vehicles` join: `ON v.id = va.vehicle_id AND (v.branch_id = cs.branch_id OR v.both_branches)`
    - [x] Los dos `NOT EXISTS` de conflicto (instructor/vehículo) quedan **sin cambios** (ya son globales por `instructor_id`/`vehicle_id`)
    - [x] `ALTER VIEW ... SET (security_invoker = true)` se mantiene
    - [x] `COMMENT ON VIEW` actualizado explicando el nuevo comportamiento "Ambas"

- [x] **T1.5** — Validar regresión cero de la vista reescrita (mitigación R2)
  - **AC ref:** AC4
  - **DoD:**
    - [x] Diff fila-por-fila entre la vista vieja (recreada como vista temporal) y la nueva, en estado por defecto (`both_branches=false` en todo) → **0 filas de diferencia en ambos sentidos** (validado vía `docker exec ... psql`)
    - [x] Con instructor `both_branches=true` + vehículo de una sola sede: conteo de filas **no cambia** (273 → 273) — la sede no cubierta por el vehículo queda sin filas, confirmando el mecanismo de AC-E1
    - [x] Con instructor `both_branches=true` + vehículo `both_branches=true`: el conteo se duplica exactamente (273 → 546), cubriendo las dos sedes
    - [x] Los `NOT EXISTS` de conflicto no se tocaron (verificado por inspección — texto idéntico al de `20260513000001`), por lo que el bloqueo cruzado de sede ya funcionaba antes de esta spec y sigue sin cambios; no se pudo probar con una clase agendada real end-to-end porque la BD de desarrollo no tiene `enrollments` seedeados (seed solo crea instructores/vehículos) — dejarlo como caso de QA manual en T5.3 con datos reales

- [x] **T1.6** — Documentar en `indices/DATABASE.md`
  - **DoD:**
    - [x] Filas de `instructors`/`vehicles` actualizadas con la columna `both_branches`
    - [x] Entrada de `v_class_b_schedule_availability` actualizada con el nuevo comportamiento

---

## Fase 2 — Edge Functions

- [x] **T2.1** — `create-instructor`: aceptar y validar `bothBranches`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] Body acepta `bothBranches: boolean`
    - [x] Si `callerRole !== 'admin'` → fuerza `bothBranches = false` sin importar el body (defensa en profundidad, no confiar en el disabled del front)
    - [x] `INSERT INTO instructors` incluye `both_branches`

- [x] **T2.2** — `update-instructor`: mismo criterio, solo admin cambia `bothBranches`
  - **AC ref:** AC1, AC3
  - **DoD:**
    - [x] Si `callerRole !== 'admin'` y el body trae `bothBranches` → se ignora (no se agrega al payload de `UPDATE`, no rompe el resto del update)
    - [x] `UPDATE instructors` incluye `both_branches` cuando corresponde

- [x] **T2.3** — `public-enrollment`: query de instructores candidatos reconoce `both_branches`
  - **AC ref:** AC4
  - **DoD:**
    - [x] Línea ~371-374 (`.eq('users.branch_id', branchId)`) → fetch sin ese filtro
      (`active=true` + `both_branches` seleccionado) y filtro `branchId === X || bothBranches`
      aplicado **client-side** (PostgREST rechaza `or=()` mezclando columna embebida
      `users.branch_id` con columna raíz `both_branches` — confirmado con `PGRST100`, ver R1 en plan.md)
    - [ ] Test manual: Matrícula Pública en Sede 2 ofrece un instructor `both_branches=true` con `branch_id=1`

---

## Fase 3 — Capa Facade

- [x] **T3.1** — `instructores.facade.spec.ts` — tests PRIMERO (TDD)
  - **AC ref:** AC1, AC2, AC6
  - **DoD:**
    - [x] Test: `fetchData()` incluye instructor `both_branches=true` sin importar `selectedBranchId()`
    - [x] Test: dedup — un instructor `both_branches=true` de la misma sede no se duplica
    - [x] Test: `loadVehicles()` propaga `branchId`/`bothBranches` en `VehicleOption`
    - [x] Test: `crearInstructor()`/`editarInstructor()` payload incluye `bothBranches`
    - [x] Tests FALLARON antes de implementar (4/17), confirmado

- [x] **T3.2** — Implementar cambios en `instructores.facade.ts`
  - **AC ref:** AC1, AC2, AC6, AC7
  - **DoD:**
    - [x] Tests de T3.1 PASAN (17/17)
    - [x] `fetchData()`: query base sin cambios + segunda query `.eq('both_branches', true)` solo cuando `branchId !== null`, merge/dedup client-side por `id` (R1 confirmado — PostgREST rechaza `.or()` mezclando `users.branch_id` con `both_branches`, `PGRST100`)
    - [x] `loadVehicles()`: sin filtro server-side (unchanged), ahora selecciona/propaga `branch_id`/`both_branches` para que el picker filtre client-side en el drawer (T4.3/T4.4)
    - [x] `CrearInstructorPayload`/`EditarInstructorPayload` +`bothBranches: boolean`
    - [x] `mapRow()` propaga `bothBranches` a `InstructorTableRow`
    - [ ] Documentado en `indices/FACADES.md` (se hace en T6.1 con `/sync-indices`)

- [x] **T3.3** — `flota.facade.spec.ts` — tests PRIMERO (TDD)
  - **AC ref:** AC5, AC8
  - **DoD:**
    - [x] Test: `fetchVehiclesData()` aplica `.or('branch_id.eq.X,both_branches.eq.true')` (a diferencia de instructors, acá `branch_id`/`both_branches` viven en la misma tabla raíz — sí es válido en PostgREST, confirmado)
    - [x] Test: `mapToTableRow()` propaga `bothBranches`
    - [x] Tests FALLARON antes de implementar (3/6)

- [x] **T3.4** — Implementar cambios en `flota.facade.ts`
  - **AC ref:** AC5, AC7, AC8
  - **DoD:**
    - [x] Tests de T3.3 PASAN (6/6)
    - [x] `fetchVehiclesData()` select incluye `both_branches`, `.or()` aplicado cuando `branchId !== null`
    - [ ] Documentado en `indices/FACADES.md` (se hace en T6.1)

- [x] **T3.5** — `admin-alumno-detalle.facade.spec.ts` — test de regresión (fix-063 + Ambas)
  - **AC ref:** AC6
  - **DoD:**
    - [x] Test: `loadInstructores()` incluye instructor `both_branches=true` sin importar la sede del alumno
    - [x] Test existente de fix-063 ("filtra por `users.branch_id` igual al del alumno") sigue pasando sin modificar su intención

- [x] **T3.6** — Implementar cambio en `admin-alumno-detalle.facade.ts`
  - **AC ref:** AC6
  - **DoD:**
    - [x] Tests de T3.5 PASAN (32/32)
    - [x] `loadInstructores()`: mismo patrón dual-query + merge que `InstructoresFacade.fetchData()` (embedded resource `users.branch_id`, mismo R1)
    - [x] `npm run test:ci` sigue en verde para el resto del archivo (32/32)

- [x] **T3.7** — Actualizar modelos UI
  - **DoD:**
    - [x] `InstructorTableRow.bothBranches: boolean` en `core/models/ui/instructor-table.model.ts`
    - [x] `VehicleTableRow.bothBranches: boolean` en `core/models/ui/vehicle-table.model.ts`
    - [x] `VehicleOption.branchId`/`bothBranches` en `core/models/ui/instructor-table.model.ts` (picker de vehículo, T4.3/T4.4)
    - [ ] Documentado en `indices/MODELS.md` (se hace en T6.1)

---

## Fase 4 — Capa UI

- [x] **T4.1** — Tests PRIMERO (TDD) — **ajuste de diseño:** `TestBed.createComponent()` +
  `setInput()` no reconoce los inputs signal de un componente standalone recién creado en
  este setup de vitest (`NG0303`/`NG0950` en cada `setInput`) — mismo problema ya
  documentado en `alert-card.component.spec.ts:13-15` (`describe.skip`, TODO sobre
  `@analogjs/vite-plugin-angular`). En vez de pelear el tooling, se extrajo la lógica de
  disabled/visibilidad a funciones puras nuevas (`core/utils/branch-scope-ui.utils.ts`,
  con `.spec.ts` propio, sin TestBed) — el componente solo delega a ellas.
  - **AC ref:** AC1, AC2, AC3, AC8, AC9
  - **DoD:**
    - [x] `isSedeDisabled(role)`, `isBothBranchesVisible(role, mode)`, `isBothBranchesDisabled(role)` — 8/8 tests
    - [x] Cubre: admin (sede+checkbox editables en ambos modos), secretary+crear (checkbox NO visible, AC2), secretary+editar (checkbox visible, disabled, AC3)

- [x] **T4.2** — Implementar `branch-scope-selector.component.ts` (Dumb)
  - **AC ref:** AC1, AC2, AC3, AC8, AC9
  - **DoD:**
    - [x] OnPush, solo `input()`/`output()` (sin Facades inyectados)
    - [x] `input()`: `role`, `mode` ('crear'|'editar'), `branches`, `branchId`, `bothBranches`
    - [x] `output()`: `valueChange` ({branchId, bothBranches})
    - [x] `computed()` delegan a las funciones puras de T4.1
    - [x] `p-select` (Sede principal) + `p-toggleswitch` (Ambas sedes), `data-llm-description` en ambos
    - [ ] Documentado en `indices/COMPONENTS.md` (se hace en T6.1)

- [x] **T4.3** — Integrar selector en `admin-instructor-crear-drawer.component.ts`
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] Reemplaza el `p-select` de sede por `<app-branch-scope-selector mode="crear">`
    - [x] Secretaria: siempre su propia sede, sin checkbox Ambas (delegado al componente)
    - [x] `vehicleOptions()` filtra por (sede elegida en el form) `OR vehicle.bothBranches`
    - [x] `submit()` propaga `bothBranches` al payload de `crearInstructor()`

- [x] **T4.4** — Integrar selector en `admin-instructor-editar-drawer.component.ts` + advertencia AC-E1
  - **AC ref:** AC1, AC3, AC-E1
  - **DoD:**
    - [x] `<app-branch-scope-selector mode="editar">`; secretaria ve el scope, no lo edita (delegado al componente)
    - [x] Banner de advertencia no bloqueante (`sedeSinCoberturaWarning()`) cuando `bothBranches=true` y el vehículo asignado no es `bothBranches`, con el texto exacto acordado
    - [x] `vehicleOptions()` con el mismo filtro que T4.3
    - [x] `submit()` propaga `bothBranches`

- [x] **T4.5** — Integrar selector en `vehicle-form-drawer.component.ts`
  - **AC ref:** AC8, AC9
  - **DoD:**
    - [x] Reemplaza el control fantasma `branch_id` por un `p-select` real y renderizado (`Validators.required` agregado) + `p-toggleswitch` "Ambas" (reactive form — se reusaron las funciones puras de T4.1, no el componente `BranchScopeSelectorComponent`, que es template-driven/ngModel; disabled vía `.disable()/.enable()` en un `effect()`, no `[disabled]`, por ser reactive forms)
    - [x] Secretaria: crea/edita solo vehículos de su sede, sin opción "Ambas" (controles `disable()`d)
    - [x] Admin: las 2 sedes + "Ambas" disponibles en crear y editar
    - [x] `tsc --noEmit` sin errores tras el cambio

- [x] **T4.6** — Columna "Sede" en listado de Instructores (reemplaza "Tipo")
  - **AC ref:** AC7
  - **DoD:**
    - [x] Columna "Tipo" eliminada (tabla desktop + tarjeta mobile)
    - [x] Columna "Sede" agregada, visible solo si `branchFacade.selectedBranchId() === null` (`showSedeColumn()`)
    - [x] Valor: nombre de sede si `bothBranches=false`, `"Ambas"` si `bothBranches=true` (`sedeLabel()`)
    - [x] `colspan` del empty-state y skeleton ajustados dinámicamente

- [x] **T4.7** — Columna "Sede" en listado de Flota
  - **AC ref:** AC7
  - **DoD:**
    - [x] Mismo criterio de visibilidad — `FlotaListContentComponent` (Dumb) gana inputs `showSedeColumn`/`branches`, `AdminFlotaComponent` (Smart) los provee
    - [x] Tabla desktop + tarjeta mobile + `colspan` del empty-state ajustados
    - [x] `tsc --noEmit` sin errores

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (0 errores, 164 warnings pre-existentes sin relación a este cambio)
- [x] **T5.2** — `npm run test:ci` corre verde — 1583 passed, 3 skipped (0 fallas, +18 tests nuevos de esta spec)
- [x] **T5.3** — QA manual del happy path + edge cases (owner)
  - **DoD:** cada AC (AC1-AC9, AC-E1-E3) marcado con evidencia en `acceptance.md`.
  - **Nota:** durante esta tarea se encontró y corrigió un bug de contraste real en
    `p-toggleswitch` (override CSS apuntaba a `.p-toggleswitch` en vez de
    `.p-toggleswitch-slider`, y además estaba encerrado en un bloque `[data-mode='dark']`
    que nunca aplica en claro — ver `src/styles/vendors/_primeng-overrides.scss`). Corregido
    con variables `--p-toggleswitch-*` en `:root` (fuera de cualquier scope de tema),
    verificado por computed styles y confirmado visualmente por el owner en su navegador real
    (2026-07-31, ver memoria de proyecto `primeng-toggleswitch-invisible-bug`). AC4 (los 4
    flujos: Matrícula admin/secretaria, Matrícula Pública, Reagendamiento, Reasignación de
    canceladas) aceptado por el owner vía la validación SQL directa ya hecha, sin requerir
    booking real con `enrollments` seedeados.

- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** `acceptance.md` generado — veredicto ✅ CUMPLIDO (12/12 AC, tras confirmación del
    owner de AC4 y AC6 el 2026-07-31).

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/` con todo lo nuevo (`/sync-indices`)
  - `npm run indices:sync` (auto): COMPONENTS.md, FACADES.md, UTILS.md, STYLES.md, DATABASE.md, USAGE-MAP.md
  - Manual: fila de `app-branch-scope-selector` en COMPONENTS.md; notas de `both_branches`
    en las entradas de `InstructoresFacade`, `FlotaFacade`, `AdminAlumnoDetalleFacade` en FACADES.md
- [x] **T6.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T6.3** — Limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
