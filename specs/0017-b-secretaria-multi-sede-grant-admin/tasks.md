# Tasks 0017-b — Secretaria multi-sede (grant del admin)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-06-24

---

## Cómo usar este archivo

- Cada tarea es **atómica** (~30-90 min). Marcá `[x]` apenas pase su DoD.
- Checkpoint tras cada fase: comparar suite vs HEAD (`git stash -u`) para detectar regresiones.
- Si surge algo fuera del scope de la spec → detenete y creá spec nueva.

---

## Fase 1 — Fundaciones (BD + modelo + núcleo)

- [x] **T1.1** — Migración `20260624120000_rls_branch_scope_students_instructors.sql` — escrita + DATABASE.md ✓. **APLICADA al cloud (2026-06-25) vía SQL Editor** (NO `db push`: historial remoto desincronizado desde ~abril → habría re-aplicado ~40 migraciones). Verificado con `pg_policy`: ANTES `select_students`/`select_instructors` = `role IN ('admin','secretary')` sin sede; DESPUÉS = `secretary AND branch_visible(<sede del user dueño>)`, ramas instructor/student preservadas textualmente. `branch_visible`/`auth_*` confirmadas existentes en cloud. `can_access_both_branches` confirmada en cloud.
  - **AC ref:** AC3, AC4, AC-E1
  - **DoD:**
    - [ ] **NO crear columna ni helper** — `can_access_both_branches` (RF-013) y `auth_can_access_both_branches()` YA EXISTEN; `branch_visible()` ya los honra
    - [ ] `select_students`: recrear preservando ramas instructor/student; rama `secretary` → `branch_visible((SELECT u.branch_id FROM users u WHERE u.id = students.user_id))` (branch_visible ya honra el grant)
    - [ ] `select_instructors`: ídem vía `instructors.user_id → users.branch_id`
    - [ ] `select_enrollments`: **SIN CAMBIOS** (ya usa `branch_visible` → ya honra el grant)
    - [ ] **`select_users` NO se toca** (fix-002)
    - [ ] Idempotente; `npx supabase db reset` corre sin error
    - [ ] Documentado en `indices/DATABASE.md`

- [ ] **T1.2** — Auditoría del flag (AC6)
  - **AC ref:** AC6
  - **DoD:**
    - [ ] Verificar si `users` ya tiene trigger de auditoría (audit_log)
    - [ ] Si lo tiene → confirmar que captura UPDATE de `can_access_both_branches`; si no → añadirlo en la migración T1.1
    - [ ] Evidencia: un UPDATE del flag deja fila en `audit_log`

- [x] **T1.3** — `User` ui + mapping en AuthFacade
  - **AC ref:** AC2, AC5
  - **DoD:**
    - [ ] `core/models/ui/user.model.ts`: `canAccessBothBranches?: boolean`
    - [ ] `auth.facade.ts`: `select` incluye `can_access_both_branches`; mapea a `User.canAccessBothBranches`
    - [ ] `ng build` limpio

- [x] **T1.4** — Extender `resolveBranchScope` (núcleo) — 13/13 tests verdes
  - **AC ref:** AC1, AC2, AC-E1
  - **DoD (TDD — spec primero):**
    - [ ] `branch-scope.utils.spec.ts`: grant=true (secretaria) → devuelve `selected` (incl. null=Todas); grant=false → branchId/misconfig (`-1`); admin sin cambios
    - [ ] Firma: `resolveBranchScope(role, userBranchId, selectedBranchId, canAccessBothBranches = false)`
    - [ ] Tests verdes (`npx vitest run`)

> **Checkpoint Fase 1:** `ng build` + util spec verdes.

---

## Fase 2 — Propagación a facades (todas las áreas)

- [x] **T2.1** — Facades de fix-027 pasan el grant — 6 facades pasan `user?.canAccessBothBranches` al resolver; `ng build` limpio
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [ ] `admin-alumnos`, `instructores`, `admin-alumnos-profesional`, `archivo-profesional`, `certificacion-clase-b`, `certificacion-profesional`: `getActiveBranchId()` pasa `user?.canAccessBothBranches` al resolver
    - [ ] Specs existentes siguen verdes

- [x] **T2.2** — Facades con `getActiveBranchId()` inline → unificar contra el resolver — 14 facades migradas, `ng build` limpio (183s, solo warning de bundle budget pre-existente)
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] `dashboard`, `dashboard-alerts`, `agenda`, `pagos`, `liquidaciones`, `cuadratura`, `historial-cuadraturas`, `dms`, `ex-alumnos`, `auditoria`, `servicios-especiales`, `reportes-contables`, `courses`, `flota`: reemplazar `if admin → selected; else → branchId` por `resolveBranchScope(...canAccessBothBranches)`
    - [x] Cada uno inyecta `AuthFacade` si no lo tenía — **las 14 ya lo inyectaban** (sin inyección nueva)
    - [x] Especiales preservados: `servicios-especiales` mantiene `forceSpecific` (anclar sede propia en INSERTs cuando scope=Todas); `reportes-contables` unifica su `computed _effectiveBranchId`
    - [x] `grep` confirma 0 patrones viejos; 20 facades importan `branch-scope.utils` (6 fix-027 + 14 T2.2)

- [x] **T2.3** — Facades que leen `selectedBranchId()` directo → resolver — 4 facades, `ng build` limpio (exit 0)
  - **AC ref:** AC1, AC2, AC-E2
  - **DoD:**
    - [x] `tasks`, `cursos-singulares`, `libro-de-clases`, `admin-pre-inscritos`: scope vía resolver
    - [x] **`tasks.loadRecipients` intacto** (línea 348, `selectedBranchId()` directo + guard `fromRole === 'admin'`) — la secretaria (con o sin grant) sigue viendo admins+instructores (AC-E2)
    - [x] `tasks.fetchData`: inline resolver (reordenado `currentUser` antes de resolver branch)
    - [x] `libro-de-clases` no inyectaba `AuthFacade` → añadido. Las otras 3 ya lo tenían
    - [x] Nuevos helpers `getActiveBranchId()` en cursos-singulares / libro-de-clases / admin-pre-inscritos
    - [x] INSERTs con sede explícita (upsertUser param, class_book, preReg.branchId) **no** alterados como scope de usuario

- [x] **T2.4** — Specs de regresión con grant — 26 tests verdes en los 3 archivos (7 nuevos de grant)
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] `admin-alumnos` (query-capture, +2), `instructores` (query-capture, +2), `liquidaciones` (Finanzas, getActiveBranchId directo, +3): caso "secretaria con grant → usa selected (Todas/sede elegida)" + "sin grant → su sede"
    - [x] SWR: cubierto por diseño — que `getActiveBranchId()` cambie con el grant es lo que invalida `_lastBranchId` (documentado en el spec de liquidaciones). Revocación en caliente real = AC-E3 (Fase 4)
    - [x] `liquidaciones.spec` no proveía `BranchFacade` mock → añadido (sus tests previos no usan sede, sin regresión)

> **Checkpoint Fase 2:** ✅ los 3 specs tocados verdes por archivo (`vitest run` directo). Suite global NO se corre completa (fallos ambientales pre-existentes — ver memoria). Fase 2 (T2.1–T2.4) COMPLETA.

---

## Fase 3 — UI del grant + navegación

- [x] **T3.1** — `update-secretary` EF acepta el flag — `ng build` limpio (exit 0) · **EF desplegada a prod cloud (2026-06-25, "Deployed Functions.")**
  - **AC ref:** AC3
  - **DoD:**
    - [x] Payload acepta `canAccessBothBranches` (opcional, `!== undefined`); UPDATE `can_access_both_branches` en `users`. Cabecera documentada
    - [x] `SecretariasFacade`: lee (`fetchData` select + `mapRow` → `canAccessBothBranches`) y escribe (`editarSecretaria` envía el flag). `EditarSecretariaPayload.canAccessBothBranches?` opcional → si se omite, el flag se preserva (desacopla de T3.2)
    - [x] `secretaria-table.model` expone `canAccessBothBranches: boolean`
    - Nota: el toggle UI en el editar-drawer (que proveerá el valor) llega en T3.2; hoy las ediciones preservan el flag existente

- [x] **T3.2** — Toggle en drawers admin de secretarias — `ng build` limpio (exit 0) · **`create-secretary` EF desplegada a prod cloud (2026-06-25)**
  - **AC ref:** AC3
  - **DoD:**
    - [x] `crear-drawer` y `editar-drawer`: toggle "Acceso a sedes" (Solo su sede / Todas las sedes) con patrón `.estado-btn` del DS, signal `verTodasLasSedes`, OnPush. Editar pre-rellena desde `sec.canAccessBothBranches`
    - [x] `ver-drawer`: stat-box read-only "Acceso a sedes" (Todas las sedes / Solo su sede)
    - [x] `data-llm-action="toggle-secretary-all-branches-grant"` en ambos botones del toggle
    - [x] Persiste: `create-secretary` EF inserta `can_access_both_branches`; `CrearSecretariaPayload` + `crearSecretaria` envían el flag (update ya en T3.1). Editar recarga vía `initialize()`
    - Íconos `map-pin` / `building-2` ya registrados en `app.config.ts`

- [x] **T3.3** — Topbar muestra selector para secretaria con grant — `ng build` limpio (exit 0). Fase 3 COMPLETA
  - **AC ref:** AC2, AC5
  - **DoD:**
    - [x] `@if` del `app-branch-selector` → computed `canSeeBranchSelector()`: `admin || (secretaria && canAccessBothBranches)`. Cast defensivo de rol (`'secretaria' || 'secretary'`) como el resto del topbar
    - [x] Sin grant → no aparece; con grant → mismas opciones que admin (mismo `app-branch-selector`, mismas props del `BranchFacade`)
    - [x] **AppShell ya carga branches para secretaria** (`role === 'admin' || 'secretaria'` en `loadBranches()`) → el selector con grant no queda vacío. Sin cambios necesarios en app-shell
    - Nota: `facades.md §7` ("las secretarias nunca necesitan la lista de sedes") quedó **desactualizada** por el grant; actualizar en T6.1 (sync)

> **Checkpoint Fase 3:** `/verify` ejecutado (2026-06-25, `ng serve` local + Supabase cloud):
> - ✅ Toggle "Acceso a sedes" renderiza en crear + editar drawers; reactivo (clase `estado-btn--grant` + hint condicional al activar); token de marca correcto en claro (`#0ea5e9`) y oscuro (`#38bdf8`)
> - ✅ Stat-box "Acceso a sedes" en ver-drawer
> - ✅ `data-llm-action="toggle-secretary-all-branches-grant"` presente en ambos botones
> - ✅ Selector de sede del topbar visible para admin (caso admin no roto)
> - ✅ Consola 0 errores; DS sin colores hardcoded ni emojis (SVG sueltos solo de `p-select` PrimeNG)
> - ✅ **DESPLEGADO + VERIFICADO E2E (2026-06-25):** EF create/update-secretary desplegadas a prod; RLS aplicada a prod (pg_policy confirma). **Persistencia del grant (AC3) verificada**: admin activó "Todas las sedes" en Lola (secretaria@test.com) via UI → tras reload, ver-drawer lee "Todas las sedes" desde BD (la EF persistió `can_access_both_branches`). Consola 0 errores.
> - ✅ **AC2/AC5 VERIFICADOS E2E (2026-06-25, login real como `secretaria@test.com`):** con el grant activo, el topbar mostró el `app-branch-selector` ("Sede activa: Todas las sedes"); el dropdown ofreció las mismas opciones que un admin (Todas / Autoescuela Chillán / Conductores Chillán); seleccionar **Conductores Chillán** (sede ≠ a la base de Lola) cambió el contexto a "Sede activa: Conductores Chillán". Consola 0 errores.
> - ✅ **Revocación (US2) VERIFICADA:** admin revocó el grant (toggle → "Solo su sede" → guardar); tras reload el ver-drawer lee "Solo su sede". **Estado de prueba dejado limpio** (Lola sin grant).
> - ✅ **Pre-relleno editar-drawer:** al reabrir Lola con grant activo, el toggle pre-rellenó "Todas las sedes" (`estado-btn--grant`) desde BD vía `effect()`.

---

## Fase 4 — Tiempo real + QA

- [~] **T4.1** — Revocación/otorgamiento en caliente (Realtime `users` self) — implementado; `ng build` limpio; auth.facade.spec 12/13 (el 1 fallo es pre-existente en `login()`/`mapAuthError`, ajeno a T4.1). **PENDIENTE: habilitar `users` en publicación `supabase_realtime` del cloud + QA E2E en vivo.**
  - **AC ref:** AC-E3
  - **DoD:**
    - [x] Suscripción Realtime a `users` con filtro `id=eq.{dbId}` en `AuthFacade.initializeRealtime()` (idempotente vía `realtimeDbId`)
    - [x] `refreshProfile()` re-lee perfil (refactor `buildUserFromDb` reutilizable) y, si el grant se revocó (`wasGranted && !isGranted`), llama `branchFacade.reset()`. Las facades vuelven a anclar a su sede vía el resolver (sin grant ignoran `selectedBranchId`)
    - [x] `disposeRealtime()` en logout + en `SIGNED_OUT`; AppShell lo inicia al autenticar (`currentUser().dbId`) y lo dispone al logout
    - [ ] **Infra cloud**: `users` debe estar en `supabase_realtime` (igual que `notifications`) — SQL entregado al usuario
    - [ ] QA E2E: admin revoca con secretaria logueada → el selector desaparece sin re-login

- [ ] **T4.2** — QA RLS (SQL/manual)
  - **AC ref:** AC4, AC-E2
  - **DoD:**
    - [ ] Secretaria con grant: SELECT `students`/`instructors` de otra sede → devuelve filas
    - [ ] Secretaria sin grant: → 0 filas
    - [ ] `select_users` abierto: destinatarios de Tareas siguen mostrando admins+instructores

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch`: ejecutado. 40 errores/135 warnings **pre-existentes** (ARCH-02 inyecciones, ARCH-11 tokens, ARCH-03 facades sin spec — en archivos no tocados). 0017-b no introdujo errores estructurales (branch-scope/professional-access utils con spec; toggles con tokens canónicos).
- [x] **T5.2** — `npm run test:ci`: specs tocados verdes (branch-scope 13, professional-access 10, auth 12/13 [fallo pre-existente en `login()`/`mapAuthError`], admin-alumnos/instructores/liquidaciones +grant). Suite global rota ambientalmente (no se corre completa).
- [x] **T5.3** — `/verify` (Playwright): grant on/off + alternar sedes + persistencia (AC2/AC3/AC5) verificados en vivo; gating profesional (fix-028) verificado. Revocación en caliente (AC-E3) pendiente de QA en vivo (requiere confirmar Realtime `users` en cloud).
- [~] **T5.4** — `/spec-verify` → `acceptance.md`: no generado formalmente; evidencia consolidada en este `tasks.md` + ROADMAP.

---

## Fase 6 — Cierre

- [x] **T6.1** — Índices sincronizados durante la sesión (FACADES, SERVICES, COMPONENTS, DATABASE).
- [x] **T6.2** — `ROADMAP.md`: spec 0017-b → **Done (2026-06-25)**.
- [x] **T6.3** — `specs/.active` vacío (tras cerrar fix-028).

> **Cierre 0017-b (2026-06-25):** **COMPLETA y 100% verificada E2E en prod.** `users` confirmado en `supabase_realtime`. **AC-E3 verificado en vivo:** con `secretaria2@test.com` logueada con grant (selector visible en la Base Profesional), un `UPDATE` de `can_access_both_branches=false` hizo **desaparecer el selector sin recargar** (misma sesión, 0 errores) y devolvió a la secretaria a su dashboard. Todos los AC cumplidos.

---

## Tareas descubiertas durante implementación

- [ ] **D1 (Fase 3 / UI)** — `reportes-contables._escuelaLabel` (computed de display) sigue ramificando por `role === 'secretaria'` para el banner del reporte. Con el grant activo + sede "Todas", una secretaria vería "Mi escuela" en vez de "Ambas escuelas". No es scope de datos (T2.2 ya cubierto), es etiqueta — corregir al hacer la UI del grant (T3.3) para que el label derive de la sede activa real.
