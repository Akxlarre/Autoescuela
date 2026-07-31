# Spec 0004 — Instructores y vehículos multi-sede ("Ambas")

> **Status:** done
> **Created:** 2026-07-30
> **Closed:** 2026-07-31
> **Owner:** m
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** iniciativa interna del dueño, surgida durante fix-090-m-drawers-scope-sede
(auditoría de fuga de sede en drawers) al descubrir dos gaps relacionados: el picker de
vehículos en Crear/Editar Instructor no filtra por sede (`InstructoresFacade.loadVehicles()`),
y el drawer Crear/Editar Vehículo nunca tuvo un campo de sede funcional
(`vehicle-form-drawer.component.ts` — `branch_id` es un control de formulario fantasma,
nunca renderizado, desde el commit que introdujo el módulo de Flota).

**Persona afectada:** Admin (gestiona instructores/vehículos de ambas sedes), Secretaria
(gestiona solo los de su propia sede), Alumno (agenda clases — necesita que la
disponibilidad de horario sea correcta sin importar la sede del instructor).

**Problema que resuelve:**
Hoy el modelo de datos asume que un instructor Clase B y un vehículo pertenecen a **una
sola** sede (`users.branch_id` / `vehicles.branch_id`, ambos FK simples). En la realidad
del negocio, un instructor puede dictar clases en **ambas** sedes. El modelo actual no
tiene forma de representar eso, lo que ya causó dos bugs de sede descubiertos en la misma
sesión (picker de vehículos sin filtrar, campo sede ausente en Flota) y bloquea el poder
declarar correctamente a un instructor como "de ambas sedes" sin recurrir a duplicar su
cuenta o a hacks de datos (ya se detectaron 4 vehículos con `branch_id` cargados a mano
directo en Supabase Studio, fuera de git, para compensar este mismo gap — ver
DG-039/DG-035 en `indices/DOMAIN-GOTCHAS.md`).

**Hipótesis de valor:**
Modelar correctamente "Ambas" para instructores y vehículos permite operar la agenda de
Clase B con la flexibilidad real del negocio (compartir instructores/vehículos entre
sedes) sin arriesgar dobles reservas — un instructor u vehículo ocupado en una sede debe
bloquear automáticamente el mismo horario en la otra.

---

## 2. User Stories

- **US1**: Como Admin, quiero poder crear/editar un instructor Clase B asignándole
  "Sede principal" + un checkbox "Trabaja en ambas sedes", para reflejar instructores que
  dictan clases en las dos sedes sin duplicar su cuenta.
- **US2**: Como Admin, quiero poder crear/editar un vehículo asignándole una sede (o
  marcarlo como "Ambas"), para que la flota pueda compartirse entre sedes cuando aplica.
- **US3**: Como Secretaria, quiero seguir creando instructores solo de mi propia sede (sin
  poder marcarlos "Ambas"), y poder ver/editar (no el campo Sede) tanto los de mi sede
  como los marcados "Ambas", para no perder acceso a instructores compartidos que también
  trabajan en mi sede.
- **US4**: Como Alumno/Secretaria agendando una clase, quiero que la disponibilidad de
  horario de un instructor "Ambas" refleje sus clases ocupadas en **cualquiera** de las
  dos sedes, para no poder agendar una clase en un horario donde el instructor ya está
  ocupado en la otra sede.
- **US5**: Como Admin viendo "Todas las sedes" en el listado de Instructores y en el
  listado de Flota, quiero ver una columna "Sede" (con valor "Ambas" cuando corresponda),
  para identificar de un vistazo el scope de cada fila.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un Admin en el drawer Crear Instructor, When marca "Trabaja en ambas
  sedes" y guarda, Then el instructor queda con `both_branches = true` y `branch_id` =
  la sede principal seleccionada.
- **AC2**: Given una Secretaria en el drawer Crear Instructor, Then el checkbox/opción
  "Ambas sedes" no está disponible — el instructor creado siempre queda con
  `both_branches = false` y `branch_id` = la sede de la secretaria.
- **AC3**: Given un instructor con `both_branches = true`, When una Secretaria de
  cualquiera de las dos sedes lo busca en el listado de Instructores, Then lo puede ver y
  editar (sin poder modificar el campo Sede/checkbox Ambas).
- **AC4**: Given un instructor con `both_branches = true` y una clase agendada el lunes
  8:30 en Sede 1, When un alumno de Sede 2 busca disponibilidad para ese instructor el
  mismo lunes 8:30, Then el slot aparece como "ocupado" (no disponible), en Matrícula
  admin/secretaria, Matrícula Pública, Reagendamiento y Reasignación de canceladas.
- **AC5**: Given un vehículo con `both_branches = true`, When se intenta agendar una clase
  con ese vehículo a una hora en que ya tiene otra clase agendada (en cualquier sede),
  Then el sistema lo bloquea igual que hoy bloquea el conflicto dentro de una sola sede.
- **AC6**: Given el drawer Crear/Editar Instructor, When se abre el picker de "Vehículo
  asignado", Then solo muestra vehículos de la sede principal del instructor o vehículos
  marcados "Ambas" (nunca vehículos de la otra sede que no sean "Ambas").
- **AC7**: Given un Admin con "Todas las sedes" seleccionado en el topbar, Then el listado
  de Instructores muestra una columna "Sede" (valor de sede o "Ambas") en vez de la
  columna "Tipo" (que se elimina), y el listado de Flota muestra una columna "Sede"
  equivalente.
- **AC8**: Given el drawer Crear/Editar Vehículo, Then existe un selector de sede
  funcional (hoy es un control fantasma que nunca se renderiza) con las mismas 2 opciones
  + "Ambas" que Instructores.
- **AC9**: Given una Secretaria en Crear/Editar Vehículo, Then puede crear/editar
  vehículos de su propia sede (RLS `insert_vehicles`/`update_vehicles` deja de ser
  admin-only), pero **no** puede marcar/mantener un vehículo como "Ambas" — esa opción
  queda deshabilitada para su rol, igual que con instructores. `delete_vehicles` se queda
  admin-only, sin cambios.

### Edge cases obligatorios

- **AC-E1**: Given un instructor "Ambas" con exactamente un vehículo asignado (regla de
  negocio confirmada: un instructor sigue teniendo un solo vehículo aunque sea "Ambas"),
  When ese vehículo NO es "Ambas" (pertenece solo a una de las dos sedes), Then el
  instructor **no genera ninguna fila de disponibilidad** en `v_class_b_schedule_availability`
  para la sede que su vehículo no cubre — no aparece como opción para agendar ahí, aunque
  esté marcado "Ambas" (la condición del join `v.branch_id = cs.branch_id OR v.both_branches`
  no se cumple para esa sede). Al guardar el instructor como "Ambas" con un vehículo que no
  es "Ambas", se muestra una advertencia no bloqueante: *"Este instructor no podrá dictar
  clases en {{sede no cubierta}}: su vehículo asignado es de {{sede del vehículo}} y no está
  marcado 'Ambas'. Para que pueda operar en las dos sedes, asígnale un vehículo 'Ambas'."*
  El motivo del bloqueo es la sede del vehículo asignado, nunca la ausencia de un vehículo
  (todo instructor con clases agendadas siempre tiene alguno).
- **AC-E2**: Given un vehículo actualmente con `branch_id = NULL` (los detectados fuera de
  git, cargados a mano), Then NO se reinterpretan automáticamente como "Ambas" — deben
  quedar con un valor explícito de sede o "Ambas" que alguien confirme, no una migración
  silenciosa de `NULL`.
- **AC-E3**: Given RLS de `instructor_documents` y `select_instructors` (ambas usan
  `branch_visible()` sobre la sede del instructor), Then ambas policies se actualizan para
  también reconocer `both_branches = true`, no solo una de las dos.

---

## 4. Out of scope

- ❌ Soporte para más de 2 sedes (el modelo booleano `both_branches` asume exactamente 2
  sedes existentes; si se agrega una tercera sede, este diseño requeriría revisarse).
- ❌ Permitir que un instructor "Ambas" tenga 2 vehículos simultáneos (uno por sede) —
  decisión de negocio confirmada: sigue siendo 1 solo vehículo por instructor.
- ❌ Vehículos/Instructores de tipo Profesional (esta spec es específica de Clase B — el
  dominio Profesional ya se resolvió aparte en fix-090 con sede única real).

---

## 5. Dependencias

### Specs previas
- fix-090-m-drawers-scope-sede (auditoría que originó este hallazgo — ya cerrado)

### Capacidades del proyecto que se asumen existentes
- `resolveBranchScope()` / `branch-scope.utils.ts` (fix-027)
- `BranchFacade.selectedBranchId()` / `AuthFacade.currentUser()`
- Función RLS `branch_visible(p_branch_id)` (`20260301000011_10_rls_policies.sql`)
- Vista `v_class_b_schedule_availability` (`20260513000001_class_b_schedule_exact_slots.sql`)

### Capacidades nuevas requeridas
- Columna `instructors.both_branches BOOLEAN NOT NULL DEFAULT false`
- Columna `vehicles.both_branches BOOLEAN NOT NULL DEFAULT false`
- RLS actualizada: `select_instructors`, `instructor_documents` (agregar `OR both_branches`)
- RLS actualizada: `insert_vehicles`/`update_vehicles` (hoy admin-only pese a que
  `indices/DATABASE.md` documenta "Sec: CRUD" — mismatch real, no solo de docs: a
  diferencia de `instructors` (que se crea/edita vía edge function con `service_role`,
  bypasseando RLS, con su propia validación admin/secretary en código), `vehicles` se
  crea/edita **directo** desde `FlotaFacade` con el cliente autenticado — la RLS admin-only
  sí bloquea a la secretaria hoy en la práctica). Nueva policy: secretary puede
  insert/update solo vehículos de su propia sede, nunca `both_branches = true`.
  `delete_vehicles` se queda admin-only.
- Rewrite de `v_class_b_schedule_availability` (join de `course_slots`/`vehicles` ya no
  ancla exclusivamente a la sede del instructor)

---

## 6. Datos y modelo (preliminar)

- Tablas modificadas: `instructors` (+`both_branches`), `vehicles` (+`both_branches`)
- Vista modificada: `v_class_b_schedule_availability`
- RLS modificada: `select_instructors`, `instructor_documents` (agregar `OR both_branches`);
  `insert_vehicles`/`update_vehicles` (permitir secretary, acotado a su propia sede, nunca
  `both_branches`)
- `vehicles.branch_id` deja de ser un control de formulario fantasma — debe poder editarse
  desde `vehicle-form-drawer.component.ts`
- Modelos UI: `InstructorTableRow`/`VehicleTableRow` (o equivalentes) ganan campo derivado
  para la columna Sede (sede real o "Ambas")

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): Instructores (listado + drawers Crear/Editar), Flota (listado +
  drawers Crear/Editar Vehículo)
- Selector de sede en ambos drawers (Instructor y Vehículo): "Sede principal" (dropdown,
  siempre Sede 1 o Sede 2) + checkbox "Trabaja/opera en ambas sedes" (opción (i) ya
  confirmada con el owner, en vez de un dropdown de 3 opciones). **Corrección del owner
  (2026-07-30, drawers de Instructor):** ambos controles quedan **ocultos por completo**
  para Secretaria — tanto en Crear como en Editar —, no solo deshabilitados; un control
  no-apretable seguía siendo confuso en pantalla. El valor de sede sigue viajando
  correctamente al backend (Crear: se autocompleta desde `BranchFacade.selectedBranchId()`,
  ya anclado a la sede de la secretaria; Editar: se conserva el `branch_id`/`both_branches`
  existente del registro, intacto porque el campo nunca se renderiza para su rol). Pendiente
  aplicar el mismo criterio (ocultar en vez de deshabilitar) al drawer Crear/Editar Vehículo
  cuando se implemente AC8/AC9.
- Columna "Sede" en ambos listados, visible solo cuando `BranchFacade.selectedBranchId() === null`
  (admin viendo "Todas las sedes"); en Instructores reemplaza la columna "Tipo" existente.

---

## 8. Métricas de éxito post-launch

- Cero reservas dobles de instructor/vehículo "Ambas" reportadas post-launch (contraste
  con el riesgo actual, que hoy es 0 casos porque "Ambas" no existe).

---

## 9. Notas / decisiones abiertas

- [x] AC-E1 resuelto: advertencia no bloqueante con el texto exacto en la sección AC —
  el motivo del bloqueo es la sede del vehículo asignado, no la ausencia de vehículo.
- [x] Resuelto: sí se corrige el permiso de secretaria para crear/editar vehículos de su
  propia sede (RLS `insert_vehicles`/`update_vehicles`), con la misma simetría que
  instructores — secretaria nunca puede setear `both_branches = true` (ni en vehículos ni
  en instructores), solo admin.
- [ ] Originado del hallazgo en fix-090-m-drawers-scope-sede y de la auditoría de
  `specs/assignments/ASG-b-043-drawers-informacion-de-sede.md`.

---

## Changelog

- 2026-07-30 — draft inicial por m, a partir de discusión extensa con el owner (diseño de
  `both_branches`, confirmación de UX (i), regla de 1 solo vehículo por instructor, y
  restricción de que Secretaria nunca crea instructores "Ambas").
- 2026-07-30 — approved: resueltos AC-E1 (texto de advertencia) y RLS de vehículos para
  secretaria (AC9, simetría con instructores).
- 2026-07-31 — done: owner confirmó visualmente el fix de `p-toggleswitch` (AC6) y aceptó
  la validación SQL directa de AC4 como suficiente. 12/12 AC cumplidos, ver `acceptance.md`.
