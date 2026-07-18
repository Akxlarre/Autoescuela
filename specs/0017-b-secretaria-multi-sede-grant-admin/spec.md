# Spec 0017-b — Secretaria multi-sede (grant del admin)

> **Status:** approved
> **Created:** 2026-06-24
> **Owner:** Akxlarre
> **Priority:** P1  <!-- confirmado 2026-06-24 (no bloquea prod: fix-027 ya cierra la fuga) -->

---

## 1. Contexto de negocio

**Origen:** Auditoría del portal Secretaria — `indices/SECRETARIA-AUDIT.md`. Surge al analizar
fix-027 (aislamiento por sede).

**Persona afectada:** Admin dueño de varias sedes (otorga el permiso) y Secretaria (lo recibe).

**Problema que resuelve:**
Hoy una secretaria pertenece a UNA sede (`users.branch_id`) y `fix-027` la ancla ahí por
defecto (correcto y seguro). Pero el negocio real contempla que un admin dueño de 2 sedes quiera
que una secretaria de confianza vea AMBAS, como hace el admin. Sin un mecanismo deliberado, esa
necesidad se "resuelve" hoy por accidente (la fuga que fix-027 cierra), lo cual es inseguro y no
auditable.

**Hipótesis de valor:**
Dar al admin un control explícito y auditable de visibilidad multi-sede por secretaria, sin
sacrificar el aislamiento por defecto del resto.

---

## 2. User Stories

- **US1**: Como admin dueño de varias sedes, quiero otorgar a una secretaria visibilidad de todas
  mis sedes (en todas las áreas), para que pueda operar de forma centralizada como yo.
- **US2**: Como admin, quiero revocar ese permiso, para que la secretaria vuelva a ver solo su
  sede base.
- **US3**: Como secretaria con el permiso otorgado, quiero alternar entre una sede concreta y
  "Todas" desde el selector del topbar, para enfocar mi trabajo igual que un admin.

---

## 3. Acceptance Criteria (Gherkin)

> Modelo decidido: **flag `users.can_access_both_branches`** · alcance **todas las áreas** ·
> navegación **vía selector del topbar (como admin)** · enforcement **en RLS**.
> Principio rector: **una secretaria CON grant se comporta exactamente como un admin** para el
> scope de sede (usa el selector, incluida la opción "Todas"); **SIN** grant queda anclada a su
> `branch_id`.

- **AC1 (default anclado)**: Given una secretaria SIN grant, When entra a cualquier vista
  branch-scoped (Alumnos B/Prof., Instructores, Asistencia, Certificados, Cuadratura, Pagos,
  Liquidaciones, DMS), Then solo ve registros de su `branch_id`.
- **AC2 (grant = como admin)**: Given una secretaria CON grant, When usa el selector de sede del
  topbar y elige Sede A / Sede B / "Todas", Then los datos de todas las áreas se filtran según esa
  selección, idéntico al admin.
- **AC3 (toggle del admin persiste)**: Given un admin en la gestión de secretarias (crear/editar),
  When activa o desactiva "Ver todas las sedes", Then se persiste en `users.can_access_both_branches`
  y aplica en la próxima carga/sesión de la secretaria.
- **AC4 (enforcement en RLS)**: Given una secretaria SIN grant que hace una query cruda a
  `students`/`instructors` saltándose el filtro de frontend, Then la RLS le devuelve solo su sede;
  And Given una secretaria CON grant, Then la RLS le permite todas las sedes.
- **AC5 (visibilidad del selector)**: Given una secretaria SIN grant, Then el selector de sede del
  topbar NO aparece; And Given CON grant, Then aparece (con las mismas opciones que el admin).
- **AC6 (auditoría del grant)**: Given un admin que otorga o revoca el permiso, When guarda,
  Then la acción queda registrada en `audit_log` (actor admin, secretaria objetivo, valor nuevo).

### Edge cases obligatorios

- **AC-E1 (misconfig ≠ acceso total)**: Given una secretaria con `branch_id` NULL **y sin** grant,
  When carga cualquier vista branch-scoped, Then NO ve datos (jamás se interpreta `null` como
  "todas").
- **AC-E2 (fix-002 preservado)**: Given cualquier secretaria (con o sin grant), When usa el
  selector de destinatarios en Comunicación/Tareas, Then sigue viendo admins + instructores (no se
  reintroduce la regresión de fix-002).
- **AC-E3 (revocación EN CALIENTE)**: Given una secretaria CON grant logueada y viendo "Todas",
  When el admin le revoca el permiso, Then **sin necesidad de re-login** su sesión activa se
  re-ancla a su `branch_id`, el selector del topbar desaparece y los datos visibles se acotan a su
  sede. (Simétrico: otorgar en caliente también habilita el selector sin re-login.)

---

## 4. Out of scope

- ❌ El fix de la fuga base (default 1 sede) → es **fix-027**, dependencia, no parte de esta spec.
- ❌ Cambiar el modelo de sede del admin (admin sigue con su selector + "Todas las escuelas").
- ❌ Permisos granulares por módulo (esto es solo visibilidad por sede, no por feature).
- ❌ **Subconjuntos de sedes** ({1,2} pero no {3}) — se descartó el modelo junction; el flag solo
  expresa "mi sede" o "todas". Si en el futuro hay >2 sedes y se necesita subconjunto, spec nueva.

---

## 5. Dependencias

### Specs previas
- **fix-027-aislamiento-sede-secretaria** debe estar `done` (define el default seguro y el helper
  `getActiveBranchId()` que esta spec extiende).

### Capacidades del proyecto que se asumen existentes
- `AuthFacade.currentUser()` con `role` y `branchId`.
- Helper `getActiveBranchId()` en las facades branch-scoped (post fix-027).
- **`users.can_access_both_branches` (RF-013) YA EXISTE** — columna + DTO (`user.model.ts`) +
  helper `auth_can_access_both_branches()` + `branch_visible()` ya lo honra. Lo usa la RLS de tasks.
- Tabla `users` con RLS; funciones `branch_visible()`, `auth_user_role()`, `auth_user_branch_id()`.
- Gestión de secretarias del admin (`features/admin/secretarias/*`, `secretarias.facade.ts`,
  edge functions `create-secretary`/`update-secretary`).

### Capacidades nuevas requeridas
- **NO crear columna ni helper** — se reutiliza `can_access_both_branches` (RF-013).
- ALTER de RLS `select_students`/`select_instructors`: añadir `branch_visible(<sede del user>)`,
  que automáticamente honra el grant. **`select_enrollments` ya funciona** (usa `branch_visible`).
  **`select_users` NO se toca** (fix-002).
- **Revocación/otorgamiento en caliente:** Realtime sobre la fila `users` del propio usuario (o
  mecanismo de refresh de `AuthFacade.currentUser()`) para que la sesión activa reaccione al
  cambio del flag sin re-login. Al re-anclar, resetear `BranchFacade.selectedBranchId()`.
- Registro en `audit_log` del cambio de `can_access_both_branches` (acción sensible).

---

## 6. Datos y modelo (preliminar)

**Decidido: reutilizar el flag existente `can_access_both_branches` (RF-013).** NUNCA reusar
`branch_id = null` como "acceso total".

- **Columna:** `users.can_access_both_branches BOOLEAN DEFAULT false` — **YA EXISTE** (no migración de columna).
- **`getActiveBranchId()` (post-refactor):**
  ```
  const granted = role === 'admin' || (role === 'secretaria' && user.canAccessBothBranches);
  return granted ? branchFacade.selectedBranchId()   // usa el selector (incluye null = Todas)
                 : user.branchId;                     // anclada (null sin grant ⇒ ver AC-E1)
  ```
  → una secretaria con grant comparte el código de scope del admin; sin grant queda fija.
- **Modelo UI:** extender `User` (ui) con `canAccessBothBranches: boolean`; `AuthFacade` lo mapea
  desde el DTO. `secretaria-table.model` / drawers de admin exponen el toggle.
- **RLS (enforcement real) — estrategia para NO reabrir fix-002:**
  - Endurecer SOLO las tablas raíz que hoy fugan: `select_students` y `select_instructors` →
    `admin OR (secretary AND (can_access_both_branches OR branch_visible(branch_id)))`.
  - **Dejar `select_users` abierta** (secretary ve todos) — es lo que fix-002 necesita para el
    selector de destinatarios; como las vistas de listado rootean en `students`/`instructors`
    (join `users!inner`), el filtro de la tabla raíz ya acota las filas. Así se cierra el gap #3
    sin tocar el path de Tareas.
  - Revisar el resto de tablas branch-scoped (`enrollments` ya tiene `branch_visible`; sumar el
    `OR can_access_both_branches`).
- **Regla invariante:** `branch_id` NULL sin grant = misconfig → sin datos.

---

## 7. UX y flujos (preliminar)

- **Pantalla admin:** Gestión de secretarias (crear/editar drawer) → toggle "Ver todas las sedes".
- **Topbar (decidido):** el `app-branch-selector` (hoy `@if role === 'admin'`) pasa a mostrarse
  también para `secretaria && canAccessBothBranches`. Mismas opciones que admin (Sede A / B / Todas).
- **Flujo principal:** admin edita secretaria → activa toggle → guarda (`update-secretary`) →
  secretaria recarga → aparece el selector y puede ver/alternar todas las sedes.
- **Estados:** sin grant (default, 1 sede, sin selector) / con grant (selector visible, multi-sede).

---

## 8. Métricas de éxito post-launch

- Cero incidentes de "veo datos de otra sede" no intencionales (todos los multi-sede tienen grant).
- El admin puede otorgar/revocar sin intervención de desarrollo.

---

### Decididas (2026-06-24)
- ✅ Modelo: **Opción A** — flag `can_access_both_branches` (no junction, no subconjuntos).
- ✅ Alcance: **todas las áreas** (Académico + Finanzas/Caja + Logística).
- ✅ Navegación: **selector del topbar**, como admin.
- ✅ Enforcement: **en RLS** (endurecer `students`/`instructors`; dejar `users` abierta por fix-002).
- ✅ Prioridad: **P1**.
- ✅ Revocación: **en caliente** (Realtime/refresh de `currentUser`, sin re-login) — ver AC-E3.
- ✅ Auditoría: **sí**, el cambio del flag se registra en `audit_log` — ver AC6.

### Aún abiertas
- (ninguna — lista para `approved` cuando fix-027 esté `done`)

---

## Changelog

- 2026-06-24 — draft inicial por Akxlarre (derivado de auditoría secretaria + fix-027).
- 2026-06-24 — US/AC afinados y decisiones de modelo/alcance/UX/RLS cerradas (sesión de refinamiento).
