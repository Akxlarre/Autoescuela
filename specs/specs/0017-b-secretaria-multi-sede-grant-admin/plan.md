# Plan 0017-b — Secretaria multi-sede (grant del admin)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-06-24
> **Tamaño:** 🔴 **L (>3 días)** — REVISAR este plan antes de implementar.

---

## 1. Resumen ejecutivo

Permitir que un admin otorgue a una secretaria visibilidad de **todas** las sedes (flag
`users.can_access_both_branches`). Una secretaria con grant se comporta **igual que un admin** para
el scope de sede (usa el selector del topbar, incluido "Todas"); sin grant queda anclada a su
`branch_id`. El aislamiento se fuerza en **RLS** (no solo query-layer). Se construye **sobre
fix-027**: el núcleo `resolveBranchScope` se extiende con `canAccessBothBranches` y se centraliza en
**todas** las facades branch-scoped. Orden: BD+modelo+resolver → facades → UI/topbar → realtime/audit.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/<ts>_rls_branch_scope_students_instructors.sql` | Migration | **Solo** ALTER policies `select_students`/`select_instructors` (la columna `can_access_both_branches` y el helper `auth_can_access_both_branches()` YA EXISTEN — RF-013) |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/utils/branch-scope.utils.ts` | Añadir 4º param `canAccessBothBranches` a `resolveBranchScope` | grant → secretaria usa `selected` (como admin) |
| `src/app/core/utils/branch-scope.utils.spec.ts` | Casos grant=true/false | cobertura del núcleo |
| `src/app/core/models/ui/user.model.ts` | `canAccessBothBranches?: boolean` | exponer grant a la UI |
| `src/app/core/facades/auth.facade.ts` | `select` incluye `can_access_both_branches`; mapear a `User.canAccessBothBranches` | source del grant en sesión |
| `src/app/core/facades/*.facade.ts` (branch-scoped, ~17) | `getActiveBranchId()` pasa `user.canAccessBothBranches` al resolver | "todas las áreas" |
| `src/app/layout/topbar.component.ts` | `@if` del `app-branch-selector`: `admin OR (secretaria && canAccessBothBranches)` | navegación de sede |
| `supabase/functions/update-secretary/index.ts` | Aceptar `can_access_both_branches` en payload (UPDATE `users`) | toggle del admin |
| `src/app/features/admin/secretarias/admin-secretarias-crear-drawer.component.ts` | Toggle "Ver todas las sedes" | otorgar al crear |
| `src/app/features/admin/secretarias/admin-secretarias-editar-drawer.component.ts` | Toggle | otorgar/revocar |
| `src/app/features/admin/secretarias/admin-secretarias-ver-drawer.component.ts` | Mostrar estado del grant | visibilidad |
| `src/app/core/facades/secretarias.facade.ts` | Leer/escribir `can_access_both_branches` | persistencia UI admin |
| `src/app/core/models/ui/secretaria-table.model.ts` | Campo `canAccessBothBranches` | fila/drawer |
| `src/app/layout/app-shell.component.ts` (o `auth.facade.ts`) | Realtime sobre fila `users` propia → refrescar `currentUser` + `branchFacade.reset()` al revocar | revocación en caliente (AC-E3) |

### Archivos a ELIMINAR
Ninguno.

---

## 3. Reutilización (Discovery)

### Existente que aprovechamos
- **`resolveBranchScope`** (fix-027) — ya es el único punto de resolución de sede; solo extender firma.
- **`getActiveBranchId()`** ya presente en ~17 facades (patrón establecido) — unificar contra el resolver.
- **`BranchFacade`** + **`app-branch-selector`** — reutilizados tal cual para la secretaria con grant.
- **`update-secretary`** edge fn — payload parcial, solo sumar un campo.
- **Drawers de secretarias admin** (crear/editar/ver) + `SecretariasFacade` — ya gestionan la secretaria.
- **Trigger de auditoría sobre `users`** — si existe, el cambio del flag se audita solo (verificar; si falta, sumarlo en la migración).

### A crear
- Solo la migración. No hay componentes/facades nuevos — es extensión de lo existente.

---

## 4. Modelo de datos

### Migración

```sql
-- NO se crea columna ni helper: can_access_both_branches (RF-013) y auth_can_access_both_branches()
-- YA EXISTEN. branch_visible(p) ya devuelve true si el caller tiene el grant.

-- Endurecer las tablas que HOY fugan (fix-027 las filtra en query-layer; ahora también en RLS).
-- students/instructors NO tienen branch_id propio → scope vía la sede del user dueño + branch_visible
-- (que ya honra can_access_both_branches automáticamente):
DROP POLICY IF EXISTS select_students ON public.students;
CREATE POLICY select_students ON public.students FOR SELECT USING (
  auth_user_role() = 'admin'
  OR (auth_user_role() = 'secretary'
      AND branch_visible((SELECT u.branch_id FROM public.users u WHERE u.id = students.user_id)))
  OR (auth_user_role() = 'instructor' AND <self/asignados, preservar texto actual>)
  OR (auth_user_role() = 'student' AND user_id = auth_user_id())
);
-- idem select_instructors vía (SELECT u.branch_id FROM users u WHERE u.id = instructors.user_id)
-- select_enrollments: SIN CAMBIOS (ya usa branch_visible(branch_id) → ya honra el grant)
-- NO TOCAR select_users (fix-002: el selector de destinatarios de Tareas lo necesita abierto)
```

> ⚠️ Preservar **exactamente** las ramas instructor/student de las policies actuales
> (`20260301000011`); solo se añade el predicado de sede a la rama `secretary`. `branch_visible`
> ya resuelve el grant — no hace falta `OR can_access_both_branches` explícito.

### RLS

> **Descubrimiento (2026-06-24):** `branch_visible(p)` **ya devuelve true cuando el caller tiene
> `can_access_both_branches`** (RF-013) → el grant se honra solo, **sin** `OR can_access_both_branches`
> explícito. Esto redujo la migración a **2 policies** (`students` + `instructors`) y dejó
> `enrollments` **intacto** (ya usaba `branch_visible(branch_id)`). Menos superficie RLS = menos riesgo
> de regresión fix-002 (riesgo #1). La tabla refleja lo realmente implementado en `20260624120000`.

| Tabla | Rol | Op | Política aplicada |
|-------|-----|----|-------------------|
| `students` | secretary | SELECT | `branch_visible(<sede del user dueño>)` — subquery a `users` (no tiene `branch_id` propio); `branch_visible` ya honra el grant |
| `instructors` | secretary | SELECT | `branch_visible(<sede del user dueño>)` — ídem students |
| `enrollments` | secretary | SELECT | **sin cambios** — ya usa `branch_visible(branch_id)`, que ya honra el grant |
| `users` | secretary | SELECT | **sin cambios** (fix-002: el selector de destinatarios de Tareas lo necesita abierto) |

### Modelos
- `core/models/ui/user.model.ts` → `canAccessBothBranches?: boolean`
- `core/models/ui/secretaria-table.model.ts` → `canAccessBothBranches: boolean`

---

## 5. Arquitectura del feature

```
Admin → admin-secretarias-editar-drawer (toggle "Ver todas las sedes")
          └─ SecretariasFacade.update() → update-secretary EF → UPDATE users.can_access_both_branches
                                                                   └─ trigger audit_log (AC6)

Secretaria (sesión activa):
  AuthFacade.currentUser().canAccessBothBranches  ← Realtime users(self) refresca en caliente (AC-E3)
       │
       ├─ TopbarComponent  @if admin || (secretaria && grant) → <app-branch-selector>
       │                         └─ BranchFacade.selectBranch(id|null)
       │
       └─ Facades branch-scoped (×17)
              getActiveBranchId() = resolveBranchScope(role, branchId, selected, canAccessBothBranches)
                 grant → usa selected (incl. null=Todas)   ·   sin grant → branchId (misconfig→-1)
                              └─ query .eq('branch_id', …)  +  RLS como backstop real
```

### Capas tocadas
- **Núcleo:** `core/utils/branch-scope.utils.ts`
- **Facades:** auth + ~17 branch-scoped + secretarias
- **Smart/UI:** topbar, drawers admin de secretarias, app-shell (realtime)
- **Migration/RLS:** `supabase/migrations/`

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade, OnPush, Signals; **Functional Core** (resolver puro)
- [x] `facades.md` — Branch-scoped (regla §7); el grant es la excepción documentada al anclaje
- [x] `models.md` — `User` ui extendido (no duplicar)
- [ ] `visual-system.md` — toggle usa componentes DS existentes (mínimo)
- [x] `swr-pattern.md` — el cambio de grant debe invalidar caché SWR (como cambio de sede: `_lastBranchId`)
- [ ] `notifications.md` — opcional: toast al secretaria cuando cambia su grant
- [x] `testing-tdd.md` — `resolveBranchScope.spec` + specs de facades clave + RLS test manual
- [x] `ai-readability.md` — `data-llm-action` en el toggle del grant

---

## 7. Plan de testing

- **Núcleo:** `branch-scope.utils.spec.ts` — grant=true → devuelve `selected` (admin-like); grant=false → branchId/misconfig.
- **Facades:** extender specs de `admin-alumnos`, `instructores` (y 1-2 de Finanzas) con caso "secretaria con grant ve selected".
- **RLS (manual/SQL):** como secretaria con grant → SELECT students/instructors de otra sede devuelve filas; sin grant → 0 filas. Verificar que `select_users` sigue abierto (destinatarios de Tareas OK).
- **QA runtime (`/verify`):** otorgar grant desde admin → secretaria ve selector y alterna sedes; revocar → en caliente vuelve a 1 sede y desaparece selector (AC-E3); destinatarios de Tareas intactos (AC-E2).

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Reintroducir regresión fix-002 al tocar RLS | Media | **NO** modificar `select_users`; solo `students`/`instructors`/`enrollments`. Test explícito de destinatarios. |
| Romper el scope de admin al centralizar ~17 facades | Media | Migración incremental + comparar suite vs HEAD (`git stash -u`) tras cada fase. La rama admin del resolver no cambia. |
| `students`/`instructors` sin `branch_id` propio → policy compleja | Media | Resolver el predicado de sede vía subquery a `users` en `/spec-tasks`; revisar `branch_visible`. |
| Realtime en `users(self)` mal scopeado | Baja | Filtro `id=eq.{dbId}`; dispose en logout; idempotente. |
| Caché SWR no refresca al cambiar grant en caliente | Media | Tratar el cambio de grant como cambio de sede (`reset()` + invalidar `_lastBranchId`). |

---

## 9. Orden de implementación (faseado — checkpoint tras cada fase)

**Fase 1 — Fundaciones (BD + modelo + núcleo)**
1. Migración: SOLO ALTER `select_students`/`select_instructors` (columna y helper YA existen, RF-013).
2. `User` ui + mapping en `auth.facade.ts` (select del flag ya en DTO).
3. Extender `resolveBranchScope` + spec. → `ng build` + util spec verde.

**Fase 2 — Propagación a facades (todas las áreas)**
4. Las 6 de fix-027: pasar `canAccessBothBranches` al resolver.
5. Las ~11 inline + las de selectedBranchId directo: unificar contra el resolver.
6. Extender specs clave. → comparar suite vs HEAD (no regresiones).

**Fase 3 — UI del grant + navegación**
7. Edge fn `update-secretary` + `SecretariasFacade` + `secretaria-table.model`.
8. Toggle en drawers admin (crear/editar/ver) con `data-llm-action`.
9. Topbar: mostrar selector para secretaria con grant.

**Fase 4 — Tiempo real + auditoría + QA**
10. Realtime `users(self)` → refresh `currentUser` + `branchFacade.reset()` al revocar.
11. Verificar/añadir auditoría del flag (AC6).
12. `/spec-verify` con evidencia (incl. test RLS y `/verify` runtime).

---

## 10. Estimación

🔴 **L — > 3 días.** Fase 1-2 son el grueso (RLS + 17 facades). Fase 3-4 más acotadas.

---

## Changelog

- 2026-06-24 — plan inicial (Spec-L, faseado).
- 2026-06-24 — §4 tabla RLS corregida tras descubrir que `branch_visible()` ya honra `can_access_both_branches` (RF-013): migración reducida a 2 policies (`students`/`instructors`), `enrollments` intacto, sin `OR` explícito. Coherente con `20260624120000`.
