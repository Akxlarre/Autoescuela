# Plan 0004 — Instructores y vehículos multi-sede ("Ambas")

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-07-30

---

## 1. Resumen ejecutivo

Agregar una columna booleana `both_branches` a `instructors` y `vehicles` (en vez de
reinterpretar `NULL`), reescribir `v_class_b_schedule_availability` para que un instructor
"Ambas" genere slots en las dos sedes (el chequeo de conflicto ya es global, no cambia), y
propagar el nuevo campo a RLS, edge functions, facades y los 3 drawers de UI afectados.
Orden grueso: migración SQL → edge functions → facades + `.spec.ts` → UI (drawers +
columnas de listado) → QA de disponibilidad cruzada.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/YYYYMMDDHHMMSS_instructors_vehicles_both_branches.sql` | Migration | Columnas `both_branches`, RLS (`select_instructors`, `instructor_documents`, `insert_vehicles`, `update_vehicles`), rewrite `v_class_b_schedule_availability` |
| `src/app/shared/components/branch-scope-selector/branch-scope-selector.component.ts` | Dumb | Selector "Sede principal" + checkbox "Ambas sedes", reutilizado en los 3 drawers (Crear Instructor, Editar Instructor, Vehículo). Encapsula la lógica de disabled-por-rol para no triplicarla. |
| `src/app/shared/components/branch-scope-selector/branch-scope-selector.component.spec.ts` | Test | Cobertura del `computed()` de opciones/disabled — tiene lógica (regla admin vs secretaria). |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/instructores.facade.ts` | `fetchData()` filtro `.or('users.branch_id.eq.X,both_branches.eq.true')`; `loadVehicles()` filtro branch-scoped; `CrearInstructorPayload`/`EditarInstructorPayload` +`bothBranches`; `mapRow()` +`bothBranches` | AC1, AC2, AC6, AC7 |
| `src/app/core/models/ui/instructor-table.model.ts` | `InstructorTableRow` +`bothBranches: boolean` | Soporte columna Sede |
| `src/app/core/facades/flota.facade.ts` | `fetchVehiclesData()` +`both_branches` en el select y en `mapToTableRow()`; `createVehicle()`/`updateVehicle()` sin cambios de firma (el payload ya lo arma el drawer) | AC5, AC7, AC8 |
| `src/app/core/models/ui/vehicle-table.model.ts` | `VehicleTableRow` +`bothBranches: boolean` | Soporte columna Sede |
| `src/app/core/facades/admin-alumno-detalle.facade.ts` | `loadInstructores()` — mismo filtro OR que `InstructoresFacade.fetchData()` | AC6 aplicado también a Reprogramar/Reagendar (fix-063) |
| `supabase/functions/create-instructor/index.ts` | Acepta `bothBranches`; si `callerRole === 'secretary'`, fuerza `false` sin importar el body (defensa en profundidad, no confiar solo en el disabled del front) | AC2 |
| `supabase/functions/update-instructor/index.ts` | Igual — solo admin puede cambiar `both_branches` | AC1, AC2 |
| `supabase/functions/public-enrollment/index.ts` | Query de instructores candidatos (línea ~371-374, hoy `.eq('users.branch_id', branchId)`) — mismo OR | AC4 (Matrícula Pública) |
| `src/app/features/admin/instructores/admin-instructor-crear-drawer.component.ts` | Usa `<app-branch-scope-selector>`; Secretaria nunca ve el checkbox Ambas (siempre su sede); `vehicleOptions` filtra por sede/Ambas | AC2, AC6 |
| `src/app/features/admin/instructores/admin-instructor-editar-drawer.component.ts` | Igual, pero campo Sede/checkbox **disabled** para Secretaria (puede editar el resto, no el scope); banner de advertencia AC-E1 si `bothBranches && vehicle no bothBranches` | AC1, AC3, AC-E1 |
| `src/app/features/admin/instructores/*` (listado, archivo exacto a confirmar en Discovery de tasks.md) | Quitar columna "Tipo", agregar columna "Sede" (condicional a `branchFacade.selectedBranchId() === null`) | AC7 |
| `src/app/features/admin/flota/vehicle-form-drawer/vehicle-form-drawer.component.ts` | Reemplaza el `branch_id` fantasma por `<app-branch-scope-selector>`; Secretaria: crea/edita solo su sede, sin opción Ambas | AC8, AC9 |
| `src/app/features/admin/flota/*` (listado) | Agregar columna "Sede" (mismo criterio de visibilidad) | AC7 |
| `src/app/core/facades/instructores.facade.spec.ts` | Tests del nuevo filtro OR + payloads | testing-tdd.md |
| `src/app/core/facades/flota.facade.spec.ts` | Tests del nuevo filtro + mapeo | testing-tdd.md |
| `src/app/core/facades/admin-alumno-detalle.facade.spec.ts` | Test del filtro OR en `loadInstructores()` | testing-tdd.md |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- Ninguno directo — es la primera vez que se necesita un selector "sede + ambas"; de ahí
  el nuevo `branch-scope-selector` (dumb, sin Facades inyectados, `input()`/`output()`
  puros — cumple `architecture.md`).

### Facades/Services existentes que extendemos
- `InstructoresFacade`, `FlotaFacade`, `AdminAlumnoDetalleFacade` — todas ya inyectan
  `BranchFacade`/`AuthFacade` y usan `resolveBranchScope()`/`getActiveBranchId()`
  (`branch-scope.utils.ts`, fix-027). No se crea ningún helper nuevo, solo se les agrega
  la condición `OR both_branches` a sus queries existentes.
- `.or()` de PostgREST ya es un patrón establecido en el proyecto (`enrollment.facade.ts`,
  `public-enrollment.facade.ts`, `dashboard.facade.ts`, `tasks.facade.ts`, entre otros) —
  pero **ninguno de esos usos combina una columna de la tabla raíz con una columna de un
  recurso embebido** (`users.branch_id` vía `users!inner`) dentro del mismo `.or()`, que es
  justo lo que necesita `InstructoresFacade.fetchData()`. Ver riesgo R1.

### Componentes/Facades que NO existen y debemos crear
- `branch-scope-selector` (dumb) — justificado arriba: se usa 3 veces (Crear Instructor,
  Editar Instructor, Vehículo) con la misma regla de disabled-por-rol; triplicar esa lógica
  violaría el principio de reutilización del proyecto.

---

## 4. Modelo de datos

### Migración(es) requerida(s)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_instructors_vehicles_both_branches.sql

-- 1. Columnas nuevas
ALTER TABLE instructors ADD COLUMN both_branches BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vehicles    ADD COLUMN both_branches BOOLEAN NOT NULL DEFAULT false;

-- 2. RLS — select_instructors: agregar OR both_branches
--    (recrear la policy de 20260624120000, mismo texto + `OR instructors.both_branches`)

-- 3. RLS — instructor_documents: mismo agregado (20260729120000)

-- 4. RLS — insert_vehicles / update_vehicles: permitir secretary
--    (acotado a su propia sede; both_branches queda fuera del WITH CHECK para secretary,
--     solo admin puede setearlo true — a definir el mecanismo exacto en tasks.md:
--     ¿WITH CHECK que exige both_branches=false si el rol es secretary, o se confía en
--     que el front no expone el control? Recomendado: WITH CHECK explícito, no confiar
--     solo en UI — mismo criterio de "defensa en profundidad" que las edge functions.)

-- 5. Rewrite v_class_b_schedule_availability
--    course_slots join: cs.branch_id = u.branch_id OR i.both_branches
--    vehicle join:      v.branch_id = cs.branch_id OR v.both_branches
--    (el resto de la vista — los dos NOT EXISTS de conflicto — no cambia)
```

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `instructors` | secretary | SELECT | `branch_visible(sede) OR both_branches` |
| `instructor_documents` | secretary | SELECT/INSERT/UPDATE | `branch_visible(sede del instructor) OR both_branches` |
| `vehicles` | secretary | INSERT | Solo su propia sede; `both_branches` debe ser `false` |
| `vehicles` | secretary | UPDATE | Solo vehículos de su propia sede o ya `both_branches` (ver AC9 — puede editar pero no setear `both_branches=true`) |
| `vehicles` | admin | INSERT/UPDATE/DELETE | Sin cambios (ya podía todo) |

### Modelos UI/DTO

- `core/models/ui/instructor-table.model.ts` — `InstructorTableRow.bothBranches: boolean`
- `core/models/ui/vehicle-table.model.ts` — `VehicleTableRow.bothBranches: boolean`
- Nuevo, opcional (definir en tasks.md si aporta o es sobre-ingeniería): tipo compartido
  `BranchScopeValue = { branchId: number; bothBranches: boolean }` para el payload común
  del nuevo selector.

---

## 5. Arquitectura del feature

### Diagrama de flujo (verbal)

```
Admin/Secretaria → AdminInstructorCrear/EditarDrawerComponent (Smart)
                      ├─ inject(InstructoresFacade, AuthFacade)
                      ├─ <app-branch-scope-selector>          (Dumb)
                      │     input: role, branches, value
                      │     output: valueChange { branchId, bothBranches }
                      └─ <p-select vehicleOptions>              filtrado por
                            (branchId del form actual) OR (vehicle.bothBranches)

InstructoresFacade.crearInstructor()/editarInstructor()
   → supabase.functions.invoke('create-instructor'|'update-instructor', { bothBranches, ... })
      → edge function (service_role): fuerza bothBranches=false si caller=secretary
      → INSERT/UPDATE instructors (both_branches) + users (branch_id)

v_class_b_schedule_availability (vista, sin cambios de consumidores)
   ← consumida sin cambios por: enrollment.facade.ts, agenda.facade.ts,
     admin-alumno-detalle.facade.ts, edge function public-enrollment
   (el rewrite de la vista es transparente para sus 4 consumidores — ninguno cambia)
```

### Capas tocadas

- **Smart**: `admin-instructor-crear-drawer.component.ts`, `admin-instructor-editar-drawer.component.ts`, `vehicle-form-drawer.component.ts`, listados de Instructores/Flota
- **Dumb**: `branch-scope-selector.component.ts` (nuevo)
- **Facade**: `InstructoresFacade`, `FlotaFacade`, `AdminAlumnoDetalleFacade`
- **Edge Functions**: `create-instructor`, `update-instructor`, `public-enrollment`
- **Migration**: 1 archivo (columnas + RLS + vista)

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Facade pattern respetado; `branch-scope-selector` es Dumb puro (`input()`/`output()`, sin Facades)
- [x] `facades.md` — Branch-scoped: extiende `resolveBranchScope()` existente, no crea helper nuevo
- [x] `models.md` — `bothBranches` agregado a los UI models existentes (`InstructorTableRow`/`VehicleTableRow`), no se duplican interfaces
- [x] `visual-system.md` — Columna "Sede" usa clases semánticas existentes de tabla; checkbox/dropdown vía PrimeNG, sin colores arbitrarios
- [x] `swr-pattern.md` — `InstructoresFacade`/`FlotaFacade` ya son SWR; el cambio de filtro no rompe el patrón `_lastBranchId`
- [ ] `notifications.md` — no aplica (no hay toasts/notificaciones nuevas más allá de los ya existentes en crear/editar)
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para las 3 facades tocadas + el nuevo Dumb component (tiene lógica de disabled)
- [ ] `ai-readability.md` — revisar en tasks.md si el checkbox "Ambas sedes" necesita `data-llm-description` (probable que sí, es un campo crítico del formulario)

---

## 7. Plan de testing

- **Unitarios (obligatorio, TDD primero):**
  - `InstructoresFacade.fetchData()` — instructor `both_branches=true` aparece con cualquier sede seleccionada; `both_branches=false` solo con su sede.
  - `InstructoresFacade` — `crearInstructor()`/`editarInstructor()` payload incluye `bothBranches` correctamente.
  - `FlotaFacade.fetchVehiclesData()` — mismo patrón para vehículos.
  - `AdminAlumnoDetalleFacade.loadInstructores()` — mismo patrón (regresión de fix-063).
  - `branch-scope-selector.component.spec.ts` — checkbox/dropdown disabled correctamente para `role='secretary'` en modo crear y en modo editar.
- **Integración / SQL:** correr la vista `v_class_b_schedule_availability` reescrita contra
  datos de prueba con un instructor `both_branches=true` + 1 vehículo de una sola sede, y
  verificar que las filas de la sede no cubierta por el vehículo **no existen** (no
  "occupied", ausentes).
- **QA manual (golden path + edge cases):**
  - Admin crea instructor "Ambas" con vehículo de una sola sede → ve la advertencia AC-E1.
  - Instructor "Ambas" con clase agendada en Sede 1 lunes 8:30 → alumno de Sede 2 no puede
    agendar ese mismo horario, en los 4 flujos (Matrícula admin/secretaria, Matrícula
    Pública, Reagendamiento, Reasignación de canceladas).
  - Secretaria intenta crear instructor/vehículo "Ambas" → opción no disponible en UI; y
    si se fuerza vía API directa, la edge function/RLS lo rechaza igual (AC2, AC9).
  - Columna "Sede" aparece/desaparece correctamente al cambiar el selector de sede del
    topbar entre "Todas las sedes" y una sede específica.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| R1 — **CONFIRMADO** (2026-07-30): `.or('users.branch_id.eq.X,both_branches.eq.true')` mezclando columna de recurso embebido (`users!inner`) con columna de la tabla raíz — probado contra PostgREST local, falla con `PGRST100` ("failed to parse logic tree"). PostgREST no soporta lógica `or=()` combinando una columna embebida con una de la tabla raíz. | Confirmada | **Mitigación aplicada:** fetch sin ese filtro (solo `active=true` u otras condiciones simples), y el criterio `branchId === X \|\| bothBranches` se aplica **client-side** (TS), tanto en la edge function `public-enrollment` como en las 3 facades de Angular. Dataset pequeño (pocas decenas de instructores/vehículos por sede) — sin impacto de performance real. |
| R2: Rewrite de `v_class_b_schedule_availability` rompe algún consumidor existente sin que se note hasta producción (vista compartida por 4 flujos) | Media | Antes de mergear, correr manualmente la vista vieja vs nueva con el mismo dataset y diffear filas para instructores `both_branches=false` — deben ser idénticas (regresión cero para el caso no-Ambas) |
| R3: Instructor "Ambas" con vehículo de una sola sede queda sin poder dictar clases en la sede no cubierta, y nadie lo nota hasta que un alumno no puede agendar | Media | AC-E1 (advertencia inmediata al guardar) + QA manual explícito de este caso |
| R4: RLS nueva de `insert_vehicles`/`update_vehicles` para secretary mal acotada permite editar vehículos de otra sede o setear `both_branches=true` | Baja | Test de integración SQL directo contra la policy (no solo desde la UI), igual que fix-027 lo hizo para otras tablas |
| R5: Edge functions (`create-instructor`/`update-instructor`) confían solo en el front para bloquear `bothBranches` a secretaria | Baja | Validación explícita en el código de la función (fuerza `false` si `callerRole !== 'admin'`), no solo `disabled` en el UI — igual criterio que la validación de rol ya existente en esas funciones |

---

## 9. Orden de implementación

1. Migración SQL: columnas `both_branches` + RLS + rewrite de la vista (validar R1/R2 localmente antes de seguir)
2. Edge functions: `create-instructor`, `update-instructor` (aceptar/forzar `bothBranches`)
3. Edge function `public-enrollment`: filtro OR en la query de instructores candidatos
4. `InstructoresFacade` + `.spec.ts` (fetchData, loadVehicles, payloads, mapRow)
5. `FlotaFacade` + `.spec.ts` (fetchVehiclesData, mapToTableRow)
6. `AdminAlumnoDetalleFacade.loadInstructores()` + `.spec.ts` (regresión fix-063)
7. `branch-scope-selector` (Dumb) + `.spec.ts`
8. Drawers: Crear/Editar Instructor, Crear/Editar Vehículo (integran el selector nuevo + advertencia AC-E1 + picker de vehículo filtrado)
9. Columnas "Sede" en listados de Instructores (reemplaza "Tipo") y Flota
10. QA manual de disponibilidad cruzada (los 4 flujos) + `npm run test:ci` + `npm run lint:arch`

---

## 10. Estimación

L (>3 días) — el grueso del riesgo/tiempo está en el rewrite de la vista SQL compartida
(paso 1) y su validación de no-regresión (R2), no en la UI.

---

## Changelog

- 2026-07-30 — plan inicial
