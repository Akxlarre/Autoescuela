# Tasks 0001-b — Sistema de tareas y observaciones multi-rol

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-05-17

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Crear migración `20260518000000_create_tasks_and_migrate_observations.sql`
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC-E1, AC-E2, AC-E4
  - **DoD:**
    - [ ] `CREATE TABLE tasks` con todos los campos del plan §4, constraints `role_matrix` y `due_date_only_for_tasks`
    - [ ] `CREATE TABLE task_replies` con `ON DELETE CASCADE`
    - [ ] 5 índices creados (`to_user_status`, `from_user_status`, `branch_status`, `due_date`, `replies_task`)
    - [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en ambas tablas
    - [ ] Trigger `trg_tasks_updated_at` con función `tasks_set_updated_at()`
    - [ ] Policies RLS para Admin (SELECT por branch, INSERT/UPDATE/soft-DELETE según emisor/destinatario)
    - [ ] Policies RLS para Secretaria (SELECT solo `from=me OR to=me`, INSERT/UPDATE/soft-DELETE propias)
    - [ ] Policies RLS para Instructor (SELECT solo `to_user_id=me`, INSERT bloqueado en `tasks`, UPDATE solo status)
    - [ ] Policy `task_replies`: Instructor solo INSERT donde `task.type='question'` y es participante; completada bloquea más replies
    - [ ] Seed legacy: `INSERT INTO tasks FROM secretary_observations WHERE EXISTS admin en sede` (saltar filas sin admin — sin datos reales en prod)
    - [ ] `DROP TABLE secretary_observations CASCADE`
    - [ ] `npx supabase db reset` corre sin error local
    - [ ] `indices/DATABASE.md` actualizado: reemplazar fila `secretary_observations` por `tasks` + `task_replies`; agregar `secretary_observations` en sección tablas eliminadas

- [x] **T1.2** — Crear `src/app/core/models/dto/task.model.ts`
  - **DoD:**
    - [ ] Interface `Task` en PascalCase, todos los campos del plan §4 en snake_case
    - [ ] Tipos literales para `from_role`, `to_role`, `type`, `status`
    - [ ] Sin lógica — solo tipos
    - [ ] Documentado en `indices/MODELS.md` (sección DTO)

- [x] **T1.3** — Crear `src/app/core/models/dto/task-reply.model.ts`
  - **DoD:**
    - [ ] Interface `TaskReply` con `id`, `task_id`, `from_user_id`, `body`, `created_at`
    - [ ] Documentado en `indices/MODELS.md` (sección DTO)

- [x] **T1.4** — Eliminar `src/app/core/models/dto/secretary-observation.model.ts`
  - **DoD:**
    - [ ] Archivo eliminado
    - [ ] `grep -r "secretary-observation"` devuelve 0 resultados en `src/`
    - [ ] `indices/MODELS.md` actualizado (remover entrada)

- [x] **T1.5** — Crear `src/app/core/models/ui/task.model.ts`
  - **DoD:**
    - [ ] `TaskRow` extiende `Task` (DTO) con campos derivados: `senderName`, `recipientName`, `replyCount`, `isOverdue`, `ageInDays`, `canEdit`, `canChangeStatus`
    - [ ] `TaskWithReplies` extiende `TaskRow` con `replies: TaskReply[]`
    - [ ] `TaskFilter = 'all' | 'sent' | 'received' | 'pending' | 'overdue'`
    - [ ] `RoleMatrixKey` como template literal type
    - [ ] No duplica tipos ya exportados desde el DTO
    - [ ] Documentado en `indices/MODELS.md` (sección UI)

- [x] **T1.6** — Crear `src/app/core/utils/task.utils.ts` + `task.utils.spec.ts`
  - **AC ref:** AC-E1, AC-E2, AC-E3
  - **DoD:**
    - [ ] `isOverdue(dueDate: string | null, now: Date): boolean`
    - [ ] `canSendTo(fromRole, toRole): boolean` — cubre la matriz completa de roles (AC-E1)
    - [ ] `canEditTask(task: Task, currentUserId: number): boolean` — emisor + `status='pending'`
    - [ ] `formatTaskAge(createdAt: string, now: Date): string` — ej: "hace 2h", "hace 3d"
    - [ ] `mapTaskDtoToRow(dto, senderName, recipientName, replyCount, currentUserId, now): TaskRow`
    - [ ] `task.utils.spec.ts`: ~15 tests, todos PASAN (`npm run test:ci` verde)
    - [ ] Casos cubiertos: `isOverdue` con null/pasado/futuro, `canSendTo` las 6 combinaciones válidas + 4 bloqueadas, `canEditTask` por rol y estado

---

## Fase 2 — Capa Facade

- [x] **T2.1** — Escribir `src/app/core/facades/tasks.facade.spec.ts` (TDD — va primero)
  - **AC ref:** AC1–AC9, AC-E1–AC-E5
  - **DoD:**
    - [ ] Mock de `SupabaseService` con `vi.fn()` para `.from().select/insert/update`
    - [ ] Mock de `AuthFacade.currentUser()` retornando signal con `{ dbId, role, branchId }`
    - [ ] Mock de `BranchFacade.selectedBranchId()` retornando signal
    - [ ] Spy en `NotificationsFacade.createNotification`
    - [ ] Test AC1: `createTask` emite notificación al destinatario, task queda con `status='pending'`
    - [ ] Test AC2: `updateStatus(id, 'in_progress')` actualiza signal y llama UPDATE
    - [ ] Test AC3: `updateStatus(id, 'completed')` setea `completed_at`
    - [ ] Test AC4: `createTask` con `type='observation'` ignora/rechaza `due_date`
    - [ ] Test AC5: `markSeen(id)` actualiza `seen_at` + `seen_by`
    - [ ] Test AC6: `createTask` con instructor de misma sede pasa validación
    - [ ] Test AC7: `createTask` con instructor de otra sede es rechazado (mock RLS devuelve 403)
    - [ ] Test AC8: `addReply` agrega reply en hilo `type='question'`
    - [ ] Test AC9: `addReply` en hilo `completed` es rechazado
    - [ ] Test AC-E1: `canSendTo` bloquea `secretaria→secretaria` e `instructor→cualquiera`
    - [ ] Test AC-E2: destinatario no puede editar `subject/body` (UPDATE rechazado)
    - [ ] Test AC-E3: `isOverdue` retorna `true` para `due_date` en el pasado
    - [ ] Test AC-E4: task de usuario desactivado sigue visible con flag `recipientInactive`
    - [ ] Test AC-E5: admin con `selectedBranchId=null` trae tasks de todas las sedes (sin filtro branch)
    - [ ] Todos los tests FALLAN al correrlos (no hay implementación aún)

- [x] **T2.2** — Implementar `src/app/core/facades/tasks.facade.ts` — estado y fetch
  - **AC ref:** AC1, AC5, AC-E4, AC-E5
  - **DoD:**
    - [ ] Sección privada: `_tasks`, `_isLoading`, `_error`, `_initialized`, `_selectedTaskId`
    - [ ] Sección pública readonly: `tasks`, `isLoading`, `error`
    - [ ] Computed signals: `pendingCount`, `overdueCount`, `sentTasks`, `receivedTasks`, `observationTasks`, `selectedTask`
    - [ ] `fetchData()`: query `tasks` filtrada por `from_user_id` o `to_user_id` según rol; branch-scoped con `BranchFacade.selectedBranchId()` (null = todas las sedes para admin)
    - [ ] `mapTaskDtoToRow()` invocado en `fetchData()` para poblar el signal con `TaskRow[]`
    - [ ] `initialize()` con guard SWR: primera vez → skeleton + `fetchData()`; re-entrada → `refreshSilently()`
    - [ ] `refreshSilently()`: `fetchData()` sin tocar `_isLoading`
    - [ ] `dispose()`: cierra ambos canales Realtime, `_initialized = false`
    - [ ] Tests de T2.1 PASAN para este bloque

- [x] **T2.3** — Implementar `TasksFacade` — mutaciones
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9, AC-E1, AC-E2
  - **DoD:**
    - [ ] `createTask(payload)`: valida `canSendTo` antes del INSERT; `due_date` solo si `type='task'`; llama `NotificationsFacade.createNotification` fire-and-forget con `.catch(() => ToastService.warning(...))`; `refreshSilently()` post-INSERT
    - [ ] `updateStatus(taskId, status)`: UPDATE con `completed_at=now()` si `status='completed'`; `refreshSilently()`
    - [ ] `markSeen(taskId)`: UPDATE `seen_at=now()`, `seen_by=currentUser.dbId`; `refreshSilently()`
    - [ ] `addReply(taskId, body)`: INSERT en `task_replies`; `refreshSilently()`
    - [ ] `softDelete(taskId)`: UPDATE `deleted_at=now()` solo si `from_user_id=currentUser.dbId`; `refreshSilently()`
    - [ ] `selectTask(taskId)`: setea `_selectedTaskId`
    - [ ] Cada método con `try/catch` → `_error.set(msg)` + `ToastService.error(...)`
    - [ ] Tests de T2.1 PASAN completos (`npm run test:ci` verde)
    - [ ] Documentado en `indices/FACADES.md`

- [x] **T2.4** — Implementar Realtime en `TasksFacade` — dos canales
  - **AC ref:** AC1, AC2, AC3
  - **DoD:**
    - [ ] Canal `tasks-sent`: `filter: from_user_id=eq.{currentUser.dbId}` → `refreshSilently()`
    - [ ] Canal `tasks-received`: `filter: to_user_id=eq.{currentUser.dbId}` → `refreshSilently()`
    - [ ] Ambos canales se abren en `initialize()` después del primer fetch
    - [ ] `dispose()` cierra los dos con `supabase.removeChannel()`
    - [ ] `subscribeRealtime()` llama `disposeRealtime()` primero (idempotente)
    - [ ] Suscripción sobre tabla base `tasks` (no sobre vistas)

---

## Fase 3 — Capa UI (Dumb Components)

- [x] **T3.1** — Crear `app-task-status-badge` (`shared/components/task-status-badge/`)
  - **DoD:**
    - [ ] `input()` de tipo `TaskStatus`
    - [ ] Color por estado con tokens del DS: `pending`→warning, `in_progress`→brand, `completed`→success, `seen`→muted
    - [ ] Usa `<app-icon>` para el ícono de cada estado (sin emojis, sin SVG inline)
    - [ ] `changeDetection: OnPush`
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T3.2** — Crear `app-task-card` + `app-task-card-skeleton` (`shared/components/task-card/`)
  - **AC ref:** AC-E3, AC-E4
  - **DoD:**
    - [ ] Inputs: `task: TaskRow`, `loading: boolean`
    - [ ] Output: `cardClicked` emitiendo `task.id`
    - [ ] `@if (loading())` → skeleton; `@else` → datos reales
    - [ ] Muestra: subject, body preview (80 chars), `app-task-status-badge`, type icon, due_date relativo, sender/recipient, replyCount si > 0
    - [ ] Badge rojo "Vencida" si `task.isOverdue` (ícono `alert-triangle` via `<app-icon>`)
    - [ ] Badge "Destinatario inactivo" si corresponde (AC-E4)
    - [ ] `[appCardHover]` aplicado
    - [ ] `data-llm-action` en el card clickeable
    - [ ] Tokens de color (sin hardcoded)
    - [ ] Skeleton colocated en mismo directorio, mismo footprint visual
    - [ ] OnPush en ambos
    - [ ] Documentados en `indices/COMPONENTS.md`

- [x] **T3.3** — Crear `app-task-reply-thread` (`shared/components/task-reply-thread/`)
  - **AC ref:** AC8, AC9
  - **DoD:**
    - [ ] Inputs: `replies: TaskReply[]`, `taskStatus: TaskStatus`, `currentUserId: number`
    - [ ] Output: `replySent` emitiendo el body del reply
    - [ ] Hilo cronológico con autor, texto, timestamp relativo
    - [ ] Input de texto visible solo si `taskStatus !== 'completed'` (AC9)
    - [ ] Sin Facade inyectado (Dumb puro)
    - [ ] `data-llm-action="add-reply-to-task"` en botón de envío
    - [ ] OnPush

- [x] **T3.4** — Crear `app-task-create-drawer` (`features/tareas/task-create-drawer.component.ts` — Smart-drawer, movido a features/ por guardrail arquitectónico)
  - **AC ref:** AC1, AC4, AC6, AC7, AC-E1
  - **DoD:**
    - [ ] Inyecta `TasksFacade`, `AuthFacade`, `BranchFacade` (Smart-drawer)
    - [ ] Campo `type`: dropdown `task | observation | question`
    - [ ] Campo `recipient`: filtrado por rol del usuario + sede vía `canSendTo()`
    - [ ] Campo `subject`: texto requerido
    - [ ] Campo `body`: textarea opcional
    - [ ] Campo `due_date`: Calendar PrimeNG, visible solo si `type='task'` (`@if`)
    - [ ] `type='observation'` deshabilita `due_date` a nivel de template y de formulario (AC4)
    - [ ] Submit: `TasksFacade.createTask()` + cierra drawer + `ToastService.success(...)`
    - [ ] Error del facade visible en el drawer
    - [ ] Reactive Form con validaciones
    - [ ] `data-llm-action="submit-create-task"` en botón principal
    - [ ] `data-llm-description` en campos críticos
    - [ ] OnPush

- [x] **T3.5** — Crear `app-task-detail-modal` (`features/tareas/task-detail-modal.component.ts` — Smart-modal, movido a features/ por guardrail arquitectónico)
  - **AC ref:** AC2, AC3, AC5, AC8, AC9, AC-E2
  - **DoD:**
    - [ ] Inyecta `TasksFacade`, `AuthFacade` (Smart-modal)
    - [ ] Input: `taskId: string`; lee `TasksFacade.selectedTask()`
    - [ ] Header: subject, type, status badge, sender → recipient, due_date si aplica
    - [ ] Body completo (sin truncar)
    - [ ] Thread de replies vía `app-task-reply-thread`
    - [ ] Botón "Marcar en progreso" (destinatario + `status='pending'`)
    - [ ] Botón "Marcar completada" (destinatario + `status='in_progress'`)
    - [ ] Botón "Marcar como vista" (admin-destinatario + `type='observation'` + no visto)
    - [ ] Botón "Editar" (solo emisor + `status='pending'` — AC-E2)
    - [ ] Al abrir: si `type='observation'` y destinatario → llama `markSeen()` automáticamente (AC5)
    - [ ] `data-llm-action` en cada botón de mutación
    - [ ] OnPush

---

## Fase 4 — Smart Pages

- [x] **T4.1** — Reescribir `features/admin/tareas/admin-tareas.component.ts`
  - **AC ref:** AC1, AC2, AC3, AC4, AC5, AC-E5
  - **DoD:**
    - [ ] Inyecta `TasksFacade`, `BranchFacade`, `LayoutDrawerService`, `DestroyRef`
    - [ ] `constructor()`: `effect()` que trackea `BranchFacade.selectedBranchId()` y llama `facade.initialize()`
    - [ ] `ngOnInit`: `destroyRef.onDestroy(() => facade.dispose())`
    - [ ] Hero: KPIs `pendingCount`, `overdueCount`, "esta semana", "sin respuesta"
    - [ ] 3 tabs: Asignadas por mí / Dirigidas a mí / Observaciones de secretaría
    - [ ] Skeleton mientras `isLoading()`; `app-empty-state` si vacío
    - [ ] Click en card → `facade.selectTask(id)` + `ModalOverlayService.open(TaskDetailModal)`
    - [ ] CTA "Nueva tarea" → abre `app-task-create-drawer`
    - [ ] `.bento-grid` + `[appBentoGridLayout]` como raíz; `.surface-hero` en header
    - [ ] `ngAfterViewInit`: `GsapAnimationsService.animateBentoGrid()`
    - [ ] `npm run lint:arch` limpio
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T4.2** — Reescribir `features/secretaria/observaciones/secretaria-observaciones.component.ts`
  - **AC ref:** AC4, AC5, AC6, AC7, AC-E1
  - **DoD:**
    - [ ] Inyecta `TasksFacade`, `AuthFacade`, `LayoutDrawerService`, `DestroyRef`
    - [ ] `ngOnInit`: `facade.initialize()` + `destroyRef.onDestroy(() => facade.dispose())`
    - [ ] Hero: KPI de pendientes propios
    - [ ] 3 tabs: Mis observaciones al admin / Tareas que me asignaron / Asignadas a instructores
    - [ ] CTA "Nueva observación" (drawer con `type='observation'` pre-seleccionado) + CTA "Nueva tarea a instructor"
    - [ ] `.bento-grid` + GSAP + `.surface-hero`
    - [ ] `npm run lint:arch` limpio
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T4.3** — Crear `features/instructor/tareas/instructor-tareas.component.ts` (NUEVA ruta)
  - **AC ref:** AC6, AC8, AC9
  - **DoD:**
    - [ ] Inyecta `TasksFacade`, `DestroyRef`
    - [ ] `ngOnInit`: `facade.initialize()` + `destroyRef.onDestroy(() => facade.dispose())`
    - [ ] Hero: KPI de pendientes
    - [ ] Lista única (sin tabs) de tasks dirigidas al instructor
    - [ ] Sin CTA "Nueva tarea" (instructor = receptor puro en v1)
    - [ ] Click en card → detalle modal con botones de estado + hilo si `type='question'`
    - [ ] `.bento-grid` + GSAP + `.surface-hero`
    - [ ] `npm run lint:arch` limpio
    - [ ] Documentado en `indices/COMPONENTS.md`

- [x] **T4.4** — Registrar ruta, nav e íconos
  - **DoD:**
    - [ ] `app.routes.ts`: ruta `instructor/tareas` lazy bajo portal instructor
    - [ ] `menu-config.service.ts`: item "Tareas" con ícono `clipboard-list` en nav del instructor
    - [ ] `app.config.ts`: íconos Lucide registrados: `clipboard-list`, `clock`, `message-square`, `check-circle`, `alert-triangle`, `eye`, `edit-3`, `send`, `trash-2`
    - [ ] Navegación a `/app/instructor/tareas` sin error 404
    - [ ] Ícono aparece en sidebar del instructor

---

## Fase 5 — Conexión y animación

- [x] **T5.1** — Wire-up: estados loading / error / empty en las 3 páginas
  - **DoD:**
    - [ ] `@if (facade.isLoading())` → skeletons via `loading` input de `app-task-card`
    - [ ] `@if (!isLoading() && tasks().length === 0)` → `<app-empty-state>` con mensaje por tab
    - [ ] Error manejado con toast desde facade (sin error inline adicional)
    - [ ] Los 3 portales verificados manualmente con Supabase local

- [x] **T5.2** — `data-llm-*` en todos los puntos críticos de mutación
  - **AC ref:** regla `ai-readability.md`
  - **DoD:**
    - [ ] `data-llm-action="create-task"` en CTA Nueva tarea
    - [ ] `data-llm-action="create-observation"` en CTA Nueva observación
    - [ ] `data-llm-action="mark-task-in-progress"` en botón del modal
    - [ ] `data-llm-action="mark-task-completed"` en botón del modal
    - [ ] `data-llm-action="mark-observation-seen"` en botón del modal
    - [ ] `data-llm-action="add-reply-to-task"` en botón de hilo
    - [ ] `data-llm-nav="instructor-tasks"` en link del sidebar
    - [ ] `data-llm-description` en `subject`, `body`, `due_date`, `recipient` del drawer

---

## Fase 6 — Validación

- [x] **T6.1** — `npm run lint:arch` corre limpio (0 errores) — archivos del spec sin errores; 17 errores pre-existentes en otros módulos
  - **DoD:**
    - [ ] Sin `*ngIf`, `@Input()`, `@Output()` en archivos nuevos
    - [ ] Sin import de `SupabaseService` en componentes
    - [ ] Sin colores Tailwind hardcodeados
    - [ ] Sin `@angular/animations`

- [x] **T6.2** — `npm run test:ci` corre verde — tasks.facade.spec.ts 36/36 ✓, task.utils.spec.ts 20/20 ✓; 13 spec files en rojo son pre-existentes
  - **DoD:**
    - [ ] `task.utils.spec.ts` → ~15 tests verdes
    - [ ] `tasks.facade.spec.ts` → ~14 tests verdes (AC1–AC9 + AC-E1–AC-E5)

- [ ] **T6.3** — QA manual: los 9 escenarios del plan §7
  - **DoD:**
    - [ ] Escenario 1: admin crea tarea para secretaria → notificación + la ve en bandeja ✓
    - [ ] Escenario 2: secretaria crea observación → admin la lee → queda `seen` ✓
    - [ ] Escenario 3: secretaria asigna a instructor → instructor la ve y completa ✓
    - [ ] Escenario 4: secretaria → secretaria → error "Destinatario no permitido" ✓
    - [ ] Escenario 5: instructor de otra sede vía DevTools → server 403 ✓
    - [ ] Escenario 6: admin cambia sede → lista se refresca sola ✓
    - [ ] Escenario 7: hilo `question` completado → no se pueden agregar replies ✓
    - [ ] Escenario 8: destinatario completa → emisor recibe notificación ✓
    - [ ] Escenario 9: soft delete → desaparece de ambas bandejas ✓

- [ ] **T6.4** — `/spec-verify` con evidencia
  - **DoD:**
    - [ ] AC Verifier devuelve `{ok: true}` o tickets restantes resueltos
    - [ ] `acceptance.md` completado con commits, tests y screenshots

---

## Fase 7 — Cierre

- [x] **T7.1** — Actualizar índices (`/sync-indices`)
  - **DoD:**
    - [ ] `indices/COMPONENTS.md`: 6 Dumb + 3 Smart nuevas/reescritas
    - [ ] `indices/FACADES.md`: `TasksFacade` con signals, métodos, dependencias
    - [ ] `indices/MODELS.md`: DTO `Task`, `TaskReply`; UI `TaskRow`, `TaskWithReplies`, `TaskFilter`, `RoleMatrixKey`
    - [ ] `indices/DATABASE.md`: `tasks` y `task_replies` con schema; `secretary_observations` en eliminadas

- [x] **T7.2** — Mover spec a "Done" en `specs/ROADMAP.md`
  - **DoD:**
    - [ ] Fila de 0001-b en sección "Done" con fecha de cierre
    - [ ] Sección "Activa" queda vacía (`—`)

- [x] **T7.3** — Limpiar `specs/.active`
  - **DoD:**
    - [ ] Archivo vacío
    - [ ] `spec-gate` ya no bloquea escrituras en `src/` (verificar manualmente)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
