# Plan 0001-b — Sistema de tareas y observaciones multi-rol

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-05-17

---

## 0. Hallazgos del descubrimiento

> ⚠️ **Activos pre-existentes que se reaprovechan o reemplazan:**
>
> - Tabla `secretary_observations` (M8 - Admin) — schema completo: `id, type, message, due_date, created_by, status, admin_reply, seen_by, seen_at, created_at`. **Reemplaza por la nueva tabla `tasks`** (decisión spec §9). Datos legacy migran 1:1 con seed SQL antes del DROP.
> - DTO `SecretaryObservation` en `core/models/dto/` — **deprecar** tras la migración. Cualquier import existente (sólo el stub) se reemplaza por `Task`.
> - Stubs vacíos `features/admin/tareas/` y `features/secretaria/observaciones/` — reescribir, sin backwards-compat (confirmado en spec §9).
> - `NotificationsFacade` existente — se extiende vía `reference_type='task'` para emitir alertas in-app al destinatario (sin tocar el facade, solo invocar `createNotification`).
> - `BranchFacade.selectedBranchId()` ya filtra contexto multi-sede para admin (sec/inst quedan anclados a su `user.branchId`).

---

## 1. Resumen ejecutivo

Migración destructiva de `secretary_observations` a una tabla `tasks` unificada con FKs `from_user_id`/`to_user_id` y enum `type ∈ {task, observation, question}`. Una tabla auxiliar `task_replies` soporta los hilos tipo `question`. Un `TasksFacade` nuevo (SWR + Realtime) orquesta los 3 flujos (admin↔sec, sec→inst); 3 Smart pages reemplazan los stubs y agregan el portal del instructor. Notificación al destinatario se delega a `NotificationsFacade.createNotification` con `reference_type='task'`. Estimación: ~5-6 días concentrados (M-L).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260518000000_create_tasks_and_migrate_observations.sql` | Migration | Tabla `tasks` + `task_replies` + índices + RLS + seed legacy + `DROP TABLE secretary_observations` |
| `src/app/core/models/dto/task.model.ts` | DTO | Mapea tabla `tasks` (campos `from_user_id`, `to_user_id`, `from_role`, `to_role`, `type`, `subject`, `body`, `status`, `due_date`, `completed_at`, `seen_at`, `seen_by`, `created_at`, `updated_at`, `deleted_at`, `branch_id`) |
| `src/app/core/models/dto/task-reply.model.ts` | DTO | Mapea tabla `task_replies` (`id`, `task_id`, `from_user_id`, `body`, `created_at`) |
| `src/app/core/models/ui/task.model.ts` | UI Model | Tipos `TaskType`, `TaskStatus`, `TaskRow` (DTO + computeds: `isOverdue`, `displayDueDate`, `senderName`, `recipientName`, `replyCount`, `canEdit`, `canChangeStatus`), `TaskWithReplies`, `TaskFilter`, `RoleMatrix` |
| `src/app/core/utils/task.utils.ts` | Pure utils | Funciones puras: `isOverdue(dueDate, now)`, `canSendTo(fromRole, toRole)` (matriz de roles), `canEditTask(task, currentUserId)`, `formatTaskAge(createdAt, now)`, `mapTaskDtoToRow(dto, userMap)` |
| `src/app/core/utils/task.utils.spec.ts` | Test | Tests unitarios de cada utility puro (función pura → fácil y obligatorio) |
| `src/app/core/facades/tasks.facade.ts` | Facade | Estado SWR + Realtime, branch-scoped, expone signals readonly y métodos de mutación; orquesta llamada a `NotificationsFacade.createNotification` al crear |
| `src/app/core/facades/tasks.facade.spec.ts` | Test (TDD) | Tests del facade: AC1-AC9 + AC-E1 a AC-E5, mocks de Supabase, AuthFacade, BranchFacade, NotificationsFacade |
| `src/app/shared/components/task-card/task-card.component.ts` | Dumb | Card individual con `subject`, `body` preview, badge estado, badge type, due_date relativo, sender, contador de replies |
| `src/app/shared/components/task-card/task-card-skeleton.component.ts` | Dumb skeleton | Skeleton colocated del task-card (mismo footprint) |
| `src/app/shared/components/task-status-badge/task-status-badge.component.ts` | Dumb | Badge con color por status (`pending`/`in_progress`/`completed`/`seen`) usando tokens del DS |
| `src/app/shared/components/task-reply-thread/task-reply-thread.component.ts` | Dumb | Hilo cronológico de respuestas con input para nuevas (solo si type=question y no completed) |
| `src/app/shared/components/task-create-drawer/task-create-drawer.component.ts` | Smart Drawer | Form: type, recipient (filtrado por rol y sede), subject, body, due_date (solo si type=task). Inyecta `TasksFacade` y `BranchFacade`. Validación con Reactive Forms |
| `src/app/shared/components/task-detail-modal/task-detail-modal.component.ts` | Smart Modal | Detalle de task: header, body completo, thread de replies, botones de acción según rol+estado |
| `src/app/features/admin/tareas/admin-tareas.component.ts` | Smart **reescribe stub** | Hero + 4 KPIs + 3 tabs (asignadas por mí / dirigidas a mí / observaciones de sec). Inyecta `TasksFacade` |
| `src/app/features/admin/tareas/admin-tareas.component.html` | Template | Layout bento con tabs y listas |
| `src/app/features/admin/tareas/admin-tareas.component.scss` | Styles | Solo overrides locales si es necesario |
| `src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts` | Smart **reescribe stub** | Hero + 3 tabs (mis observaciones al admin / asignadas a mí / asignadas por mí a instructores) |
| `src/app/features/secretaria/observaciones/secretaria-observaciones.component.html` | Template | Layout bento |
| `src/app/features/instructor/tareas/instructor-tareas.component.ts` | Smart **NUEVO** | Hero + KPI pendientes + lista de tareas dirigidas a mí. Sin CTA "nueva tarea" (instructor solo recibe/responde) |
| `src/app/features/instructor/tareas/instructor-tareas.component.html` | Template | Layout bento |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/app.routes.ts` | Agregar ruta `instructor/tareas` bajo el portal de instructor; las rutas admin/secretaria ya existen (apuntaban a stubs) | AC6: instructor necesita bandeja propia |
| `src/app/core/services/auth/menu-config.service.ts` | Agregar item "Tareas" al nav del instructor (icon: `clipboard-list`); admin y secretaria ya lo tienen | El menú del instructor hoy no tiene esta entrada |
| `src/app/app.config.ts` | Registrar íconos Lucide nuevos si hacen falta (`clipboard-list`, `clock`, `message-square`, `check-circle`, etc.) | Sin registro, Lucide falla en runtime (regla CLAUDE.md) |
| `indices/COMPONENTS.md` | Agregar entradas para los 6 Dumb components nuevos + 3 Smart pages nuevas/reescritas | `/sync-indices` lo refleja al cerrar |
| `indices/FACADES.md` | Agregar entrada `TasksFacade` con responsabilidad + signals + dependencias | Auto-index también lo detecta, pero la doc manual queda |
| `indices/SERVICES.md` | (si se crean services aux, ej: TaskRealtimeService) — TBD si hace falta | Probablemente no, todo cabe en el facade |
| `indices/MODELS.md` | Agregar `Task`, `TaskReply`, `TaskRow`, `TaskWithReplies`, `TaskFilter`, `TaskType`, `TaskStatus`, `RoleMatrix` | Cada entry en la sección correspondiente DTO/UI |
| `indices/DATABASE.md` | Reemplazar fila `secretary_observations` por `tasks` + agregar `task_replies`. Marcar `secretary_observations` en sección de tablas eliminadas | La fuente de verdad del schema |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| `src/app/core/models/dto/secretary-observation.model.ts` | El DTO ya no representa la tabla (la tabla se dropea). Cualquier import legacy se reemplaza por `Task` |

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos

| Componente | Uso |
|------------|-----|
| `app-icon` | Toda iconografía (`clipboard-list` para tareas, `clock` para due date, `message-square` para replies, `check-circle` para completadas, `alert-triangle` para vencidas) |
| `app-skeleton-block` | Loading states de lista de tareas (mientras llega la primera fetch del Facade) |
| `app-empty-state` | "Sin tareas pendientes" en cada uno de los 3 portales |
| `app-section-hero` | Hero de cada Smart page (admin/sec/instructor) con título dinámico + contadores |
| `app-kpi-card-variant` | KPIs en hero: "Pendientes", "Vencidas", "Esta semana", "Sin respuesta" |
| `*appHasRole` | Mostrar/ocultar tabs y CTAs según `currentUser().role` |
| `[appBentoGridLayout]` | Layout raíz de cada Smart page (regla `visual-system.md`) |
| `[appAnimateIn]` | Entrada de cards al cargar |
| `[appCardHover]` | Hover sutil en cards |
| `btn-primary`, `btn-secondary`, `btn-neutral`, `btn-danger-ghost` | CTAs según contexto (no recrear botones ad-hoc) |
| `.surface-hero` | Headers de cada portal (cascade auto de tokens — sin tocar colores en hijos) |
| `.kpi-value` + `.kpi-label` | Métricas en hero (NO `text-4xl font-bold` plano) |
| `.indicator-live` | (futuro) Si abrimos canal Realtime visible, badge de "Conectado" en topbar |
| `.badge-pulse` | Conteo de tareas no leídas en el nav lateral |

### Facades / Services existentes que se inyectan en `TasksFacade`

| Dependencia | Para qué |
|-------------|----------|
| `SupabaseService` | Cliente único de BD + Realtime (regla: solo se usa en facades/services) |
| `AuthFacade.currentUser()` | Obtener `from_user_id`, `from_role`, `branchId` del emisor en cada `createTask` |
| `BranchFacade.selectedBranchId()` | Filtro multi-sede en `SELECT`; admin con sede=null ve todas, sec/inst usan su `user.branchId` |
| `NotificationsFacade.createNotification()` | Emitir notificación al destinatario al crear task; `reference_type='task'`, `reference_id=task.id` |
| `ToastService.success/error` | Feedback efímero en mutaciones (regla `notifications.md`: NO `MessageService` directo) |
| `LayoutDrawerService` | Abrir `task-create-drawer` desde los 3 portales |
| `ConfirmModalService` | Confirmar eliminación / cierre de hilo |

### Services / Edge Functions que NO se reutilizan (justificación)

- **No se crea Edge Function**. Toda la lógica vive en el facade + RLS de Supabase. No hay validaciones cross-table complejas que requieran lógica server-side aislada.
- **No se reutiliza el patrón de `DashboardAlertsFacade`** (Capa 3 de notificaciones): ese es para "estado vivo del sistema" (documentos vencidos, deudas). Tareas son persistentes con ciclo de vida propio → encajan en patrón estándar.

### Componentes que NO existen y debemos crear (justificación)

| Componente nuevo | ¿Por qué no se puede reutilizar uno existente? |
|------------------|-----------------------------------------------|
| `app-task-card` | Layout específico (status badge + type icon + due date relativo + reply count). `app-kpi-card-variant` es para métricas numéricas; no aplica |
| `app-task-status-badge` | Aunque existe `p-badge` PrimeNG, queremos control fino del color por estado (tokens) y el componente lo encapsula |
| `app-task-reply-thread` | Patrón conversacional cronológico — no hay nada similar en el repo |
| `app-task-create-drawer` | Form específico con campos condicionales (due_date solo si type=task) y destinatario dinámico filtrado por rol+sede |
| `app-task-detail-modal` | Combina detalle + thread + acciones — no hay modal genérico de este shape |

---

## 4. Modelo de datos

### Migración SQL (esqueleto — el SQL final va en la tarea T1.1 de `tasks.md`)

```sql
-- Migración: 20260518000000_create_tasks_and_migrate_observations.sql

-- 1. Tabla principal
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     INT         NOT NULL REFERENCES branches(id),
  from_user_id  INT         NOT NULL REFERENCES users(id),
  from_role     TEXT        NOT NULL CHECK (from_role IN ('admin','secretaria')),
  to_user_id    INT         NOT NULL REFERENCES users(id),
  to_role       TEXT        NOT NULL CHECK (to_role IN ('admin','secretaria','instructor')),
  type          TEXT        NOT NULL CHECK (type IN ('task','observation','question')),
  subject       TEXT        NOT NULL,
  body          TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','completed','seen')),
  due_date      TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  seen_at       TIMESTAMPTZ,
  seen_by       INT         REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  -- Solo type='task' admite due_date
  CONSTRAINT due_date_only_for_tasks
    CHECK (type = 'task' OR due_date IS NULL),
  -- Matriz de roles permitidos (AC-E1)
  CONSTRAINT role_matrix CHECK (
    (from_role = 'admin'      AND to_role IN ('secretaria','instructor')) OR
    (from_role = 'secretaria' AND to_role IN ('admin','instructor'))
  )
);

-- 2. Hilos
CREATE TABLE IF NOT EXISTS task_replies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id  INT         NOT NULL REFERENCES users(id),
  body          TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices
CREATE INDEX idx_tasks_to_user_status   ON tasks(to_user_id, status)   WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_from_user_status ON tasks(from_user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_branch_status    ON tasks(branch_id, status)    WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_due_date         ON tasks(due_date)             WHERE deleted_at IS NULL AND type='task';
CREATE INDEX idx_task_replies_task      ON task_replies(task_id, created_at);

-- 4. RLS activo
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_replies  ENABLE ROW LEVEL SECURITY;

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION tasks_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_set_updated_at();

-- 6. Migración de datos legacy (secretary_observations → tasks)
INSERT INTO tasks (
  branch_id, from_user_id, from_role, to_user_id, to_role,
  type, subject, body, status, due_date, seen_by, seen_at, created_at
)
SELECT
  u_sender.branch_id,
  so.created_by,
  'secretaria',
  COALESCE(
    (SELECT id FROM users u_admin
     WHERE u_admin.branch_id = u_sender.branch_id
       AND u_admin.role_id = (SELECT id FROM roles WHERE name='admin')
     ORDER BY u_admin.id LIMIT 1),
    so.created_by  -- fallback: si sede sin admin, autoreceptor (queda visible para auditoría)
  ),
  'admin',
  CASE WHEN so.type IN ('urgent','reminder') THEN 'task' ELSE 'observation' END,
  LEFT(so.message, 80),
  so.message,
  CASE so.status WHEN 'resolved' THEN 'completed' WHEN 'seen' THEN 'seen' ELSE 'pending' END,
  so.due_date::TIMESTAMPTZ,
  so.seen_by,
  so.seen_at,
  so.created_at
FROM secretary_observations so
JOIN users u_sender ON u_sender.id = so.created_by;

-- 7. Replies legacy (si había admin_reply, crear primer reply en el hilo)
-- (detalle SQL en tasks.md — requiere mapeo de IDs viejos a nuevos uuids)

-- 8. DROP final
DROP TABLE secretary_observations CASCADE;
```

### RLS preliminar (detalle de cada policy va en `tasks.md`)

| Rol | SELECT | INSERT | UPDATE | DELETE (soft) |
|-----|--------|--------|--------|---------------|
| Admin | `branch_id` está en sus sedes | `from_role='admin'`, `to_role IN ('secretaria','instructor')`, `to_user.branch_id` en sus sedes | Status si destinatario; `subject/body` si emisor + `status='pending'` | `from_user_id = auth_user_id` |
| Secretaria | `from_user_id = me OR to_user_id = me` (NO ve cross-sec) | `from_role='secretaria'`, `to_role IN ('admin','instructor')`, mismo `branch_id` que ella | Status si destinatario; `subject/body` si emisor + `status='pending'` | `from_user_id = auth_user_id` |
| Instructor | `to_user_id = me` | Bloqueado en `tasks`. Solo INSERT en `task_replies` donde `task.type='question'` y es participante | Solo `status` si es destinatario | Nunca |

### Modelos UI/DTO

**`core/models/dto/task.model.ts`** (mapea tabla 1:1, todos los campos snake_case):

```typescript
export interface Task {
  id: string;            // uuid
  branch_id: number;
  from_user_id: number;
  from_role: 'admin' | 'secretaria';
  to_user_id: number;
  to_role: 'admin' | 'secretaria' | 'instructor';
  type: 'task' | 'observation' | 'question';
  subject: string;
  body: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'seen';
  due_date: string | null;
  completed_at: string | null;
  seen_at: string | null;
  seen_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

**`core/models/ui/task.model.ts`** (extensión con derivados):

```typescript
import type { Task as TaskDto } from '@core/models/dto/task.model';
import type { TaskReply as TaskReplyDto } from '@core/models/dto/task-reply.model';

export type TaskType = TaskDto['type'];
export type TaskStatus = TaskDto['status'];

export interface TaskRow extends TaskDto {
  senderName: string;
  recipientName: string;
  replyCount: number;
  isOverdue: boolean;
  ageInDays: number;
  canEdit: boolean;        // emisor y status='pending'
  canChangeStatus: boolean; // destinatario o emisor (según)
}

export interface TaskWithReplies extends TaskRow {
  replies: TaskReplyDto[];
}

export type TaskFilter = 'all' | 'sent' | 'received' | 'pending' | 'overdue';
export type RoleMatrixKey = `${TaskDto['from_role']}->${TaskDto['to_role']}`;
```

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Usuario (admin / secretaria / instructor)
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│ Smart Components (features/)                                 │
│  ┌────────────────────────┐  ┌─────────────────────────────┐ │
│  │ admin-tareas           │  │ secretaria-observaciones    │ │
│  │ + 3 tabs               │  │ + 3 tabs                    │ │
│  └────────────────────────┘  └─────────────────────────────┘ │
│  ┌────────────────────────┐                                  │
│  │ instructor-tareas      │   inject(TasksFacade)            │
│  │ (solo recibida)        │   inject(BranchFacade) si admin  │
│  └────────────────────────┘                                  │
└──────────────────────────────────────────────────────────────┘
   │  pasa signals → ↓        emit (rowClicked / actionClicked)
   ▼
┌──────────────────────────────────────────────────────────────┐
│ Dumb Components (shared/components/)                         │
│  app-task-card  +  app-task-card-skeleton                    │
│  app-task-status-badge                                       │
│  app-task-reply-thread                                       │
│  app-task-create-drawer  (Smart-drawer, inyecta facade)      │
│  app-task-detail-modal   (Smart-modal,  inyecta facade)      │
└──────────────────────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│ TasksFacade (core/facades/tasks.facade.ts)                   │
│   State: tasks, replies, selected, isLoading, error, filter  │
│   Computed: pendingCount, overdueCount, byTab(...)           │
│   Methods: initialize, refreshSilently, createTask,          │
│            updateStatus, addReply, markSeen, softDelete,     │
│            dispose                                            │
│   SWR + Realtime: canal 'tasks-{userId}' filtrado            │
│   Branch-scoped: lee BranchFacade.selectedBranchId()         │
│   Side-effect: createTask → NotificationsFacade.createNotif. │
└──────────────────────────────────────────────────────────────┘
   │  inject(SupabaseService)
   ▼
┌──────────────────────────────────────────────────────────────┐
│ Supabase                                                     │
│   tables: tasks, task_replies                                │
│   trigger: trg_tasks_updated_at                              │
│   RLS: 4 policies por tabla (Admin/Sec/Inst × CRUD)          │
│   Realtime: postgres_changes en tasks (filtros server-side   │
│             limitados → filtro extra client-side)            │
└──────────────────────────────────────────────────────────────┘
```

### Capas tocadas (resumen)

- **Smart (3):** `admin-tareas`, `secretaria-observaciones` (reescriben stubs), `instructor-tareas` (nuevo)
- **Dumb (6):** `task-card`, `task-card-skeleton`, `task-status-badge`, `task-reply-thread`, `task-create-drawer`, `task-detail-modal`
- **Facade (1):** `tasks.facade.ts`
- **Utils puros (1):** `task.utils.ts`
- **DTO (2):** `task.model.ts`, `task-reply.model.ts`
- **UI Model (1):** `task.model.ts` (ui)
- **Migration (1):** crea + migra + dropea legacy

---

## 6. Restricciones aplicables

> Marcadas las reglas Koa que aplican a este feature. Las completas viven en `.claude/rules/`.

- [x] **`architecture.md`** — Patrón Facade estricto, OnPush en TODOS los componentes, Signals para estado UI, RxJS interno en services, `toSignal()` en Facade. Templates con `@if`/`@for`, `[class.x]`, `input()`/`output()`. NO `*ngIf`, NO `@Input()`. Smart en `features/`, Dumb en `shared/`.
- [x] **`facades.md`** — `TasksFacade` es **branch-scoped** (§7): inyecta `BranchFacade`, lee `selectedBranchId()` en cada fetch, **NO** pone `effect()` dentro del facade. La reactividad de branch va en el Smart component con `destroyRef`.
- [x] **`models.md`** — DTO en `core/models/dto/`, UI Model en `core/models/ui/`. Mapeo DTO→UI **solo** en el facade. NO interfaces locales en componentes.
- [x] **`visual-system.md`** — `app-icon` para todo ícono, `[appBentoGridLayout]` raíz, tokens semánticos (`var(--ds-brand)`, `text-primary`, `bg-surface`), `.surface-hero` en headers, `.kpi-value`/`.kpi-label` para métricas. Solo 1 `.card-accent` por sección bento. Regla 3-2-1 del brand color. **PROHIBIDO** colores Tailwind hardcodeados y emojis como íconos.
- [x] **`swr-pattern.md`** — `TasksFacade.initialize()` con guard `_initialized`: primera visita muestra skeleton, re-visitas hacen `refreshSilently()`. Realtime sobre tabla base `tasks` (NO sobre vistas). Lifecycle: el Smart component llama `dispose()` desde `destroyRef.onDestroy`.
- [x] **`notifications.md`** — `TasksFacade.createTask()` invoca `NotificationsFacade.createNotification({ recipient_id, type:'info', subject, message, reference_type:'task', reference_id })`. **NUNCA** `MessageService` directo: usar `ToastService`. **NO** inyectar `NotificationsFacade` en Dumb components.
- [x] **`testing-tdd.md`** — `tasks.facade.spec.ts` **OBLIGATORIO** antes de implementar; cubre AC1-AC9 + AC-E1-E5 con mocks. `task.utils.spec.ts` para utils puros (las más fáciles y valiosas). Si `task-create-drawer` tiene `computed()` con lógica (ej: filtrar destinatarios), incluye `.spec.ts`.
- [x] **`ai-readability.md`** — Botones de mutación con `data-llm-action` (`create-task`, `mark-task-completed`, `add-reply-to-task`, `mark-observation-seen`). Inputs críticos del drawer con `data-llm-description`. Tabs con `data-llm-nav`.

---

## 7. Plan de testing

### Tests unitarios obligatorios (con Vitest)

- **`task.utils.spec.ts`** — cubre `isOverdue`, `canSendTo` (matriz completa de combinaciones de roles), `canEditTask`, `formatTaskAge`, `mapTaskDtoToRow`. ~15 tests.
- **`tasks.facade.spec.ts`** — un test por AC + edge cases. ~14 tests. Mocks: `SupabaseService` con `vi.fn()`, `AuthFacade.currentUser()` con `signal()` mockeado, `BranchFacade.selectedBranchId()` con `signal()`, `NotificationsFacade.createNotification` espiado.
- **`task-create-drawer.spec.ts`** — solo si el computed de "destinatarios disponibles" tiene lógica no trivial.

### QA manual (golden path + edge cases)

1. **Como admin** → crear tarea para secretaria con due_date → verificar que secretaria recibe notificación + ve la tarea
2. **Como secretaria** → crear observación al admin (sin due_date) → admin la ve, la marca como vista
3. **Como secretaria** → crear tarea para instructor de su sede → instructor la ve en `/instructor/tareas` y la marca completada
4. **Como secretaria** → intentar crear tarea para otra secretaria → bloqueo UI + error servidor
5. **Como secretaria sede A** → intentar crear tarea para instructor sede B (vía manipulación DevTools) → server 403
6. **Como admin** → cambiar sede en topbar → la lista se refresca con `effect()` en el Smart
7. **Como admin/sec** → crear `type='question'` → responder ida y vuelta → marcar completada → comprobar que no se pueden agregar más replies
8. **Como destinatario** → marcar tarea como completed → emisor recibe notificación
9. **Soft delete** → emisor elimina su propia tarea → desaparece de su lista; destinatario ya no la ve

### Tests de regresión (smoke)

- `npm run lint:arch` debe correr limpio (Architect Guard del proyecto valida OnPush, sin `*ngIf`, sin colores hardcoded, sin import Supabase en UI, etc.)
- `npm run test:ci` debe pasar en verde
- `npx supabase db reset` en local debe correr migración sin error (incluida la `DROP TABLE`)

---

## 8. Riesgos y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|------------|
| R1 | Migración legacy de `secretary_observations`: si una sede no tiene admin, `to_user_id` queda NULL → falla constraint NOT NULL | Baja | Alto | **✅ DECIDIDO:** Saltar esas filas (`WHERE EXISTS admin en sede`). Confirmado que no hay filas reales en producción — el stub estaba vacío. Sin pérdida de datos reales. |
| R2 | `to_role` denormalizado puede divergir si un usuario cambia de rol después | Media | Bajo | **✅ DECIDIDO:** Aceptar drift. `to_role` es snapshot de display, no fuente de verdad para permisos. RLS opera sobre `to_user_id` (FK real). Sin trigger — más simple y correcto semánticamente. |
| R3 | Supabase Realtime sólo admite filtros de igualdad simple (no OR) → no podemos sub a `from_user_id=me OR to_user_id=me` en un solo canal | Alta | Medio | **✅ DECIDIDO:** Dos canales separados: `tasks-sent` (filter `from_user_id=eq.{me}`) y `tasks-received` (filter `to_user_id=eq.{me}`). Ambos llaman `refreshSilently()`. `dispose()` cierra los dos. Filtro server-side eficiente, no envía datos de otras sedes al cliente. |
| R4 | `createTask` falla en `NotificationsFacade.createNotification` después del INSERT → task creada sin notificación | Media | Bajo | Side-effect fire-and-forget con `.catch()` que muestra `ToastService.warning("Tarea creada, notificación pendiente")`. No revertir la task (UX peor que quedarse sin notif) |
| R5 | Hilo type=question completado y aún así alguien intenta INSERT en `task_replies` (race condition o cliente desactualizado) | Baja | Bajo | Constraint check: `WHERE EXISTS (SELECT 1 FROM tasks WHERE id=task_id AND status NOT IN ('completed'))`. RLS policy + check trigger doble candado |
| R6 | Branch-scoped: secretaria intenta asignar a instructor que ya no trabaja en su sede (instructor cambió de sede entre vistas) | Baja | Medio | Validar en server vía RLS WITH CHECK con subquery `EXISTS (SELECT 1 FROM users WHERE id = to_user_id AND branch_id = current_sec_branch)` |
| R7 | Spec deja UX abierto a interpretación en algunos puntos (qué hacer si due_date pasa en `pending`) | Media | Bajo | Cubierto por AC-E3 (sistema marca visualmente como vencida). UI muestra badge rojo + ícono `alert-triangle` |
| R8 | Carga inicial de tareas para admin con muchas secretarias/instructores podría ser lenta (sin paginación) | Baja en piloto | Bajo en piloto | Hard limit de 50 filas más recientes en la primera carga; agregar paginación si supera. No es bloqueante para v1 |

---

## 9. Orden de implementación

> Ejecutar fases en orden estricto. Cada fase es una checkpoint: lint + tests verdes antes de avanzar.

1. **Fase 1 — Datos y modelo** (~0.5 día)
   - SQL migration + seed legacy + DROP
   - DTOs `task.model.ts`, `task-reply.model.ts`
   - UI Models en `ui/task.model.ts`
   - `task.utils.ts` + `task.utils.spec.ts` (verde)

2. **Fase 2 — Facade** (~1.5 días, TDD)
   - `tasks.facade.spec.ts` PRIMERO (todos los AC mockeados → rojo)
   - `tasks.facade.ts` hasta que todos los tests pasen
   - Incluye SWR + Realtime + branch-scoped + integración `NotificationsFacade`

3. **Fase 3 — Dumb UI** (~1.5-2 días)
   - `app-task-status-badge` + skeleton
   - `app-task-card` + `app-task-card-skeleton` colocated
   - `app-task-reply-thread`
   - `app-task-create-drawer`
   - `app-task-detail-modal`
   - Cada Dumb con storybook visual rápido (manual) en página de pruebas si hace falta

4. **Fase 4 — Smart pages** (~1 día)
   - Reescribir `admin-tareas` (stub → real)
   - Reescribir `secretaria-observaciones` (stub → real)
   - Crear `instructor-tareas`
   - Registrar rutas + nav del instructor + íconos Lucide en `app.config.ts`
   - `effect()` para reactividad branch en cada Smart

5. **Fase 5 — Wire-up + animación** (~0.5 día)
   - Conectar Smart ↔ Dumb pasando signals
   - GsapAnimationsService.animateBentoGrid() en `ngAfterViewInit`
   - Empty states con `app-empty-state`
   - data-llm-action / data-llm-description en mutaciones críticas

6. **Fase 6 — Validación + cierre** (~0.5 día)
   - `npm run lint:arch` verde
   - `npm run test:ci` verde
   - QA manual de los 9 escenarios de §7
   - `/spec-verify` con evidencia (commits, tests, screenshots)
   - Actualizar `indices/COMPONENTS.md`, `FACADES.md`, `MODELS.md`, `DATABASE.md`
   - Mover spec a "Done" en `ROADMAP.md`
   - `/spec-activate --clear` para liberar el gate

---

## 10. Estimación

**Total: ~5-6 días de trabajo concentrado (M-L).**

Distribución: 0.5 + 1.5 + 1.5-2 + 1 + 0.5 + 0.5 días por fase.

Asume Claude haciendo el grueso del código con review humana en cada fase. Si la review introduce ajustes significativos al modelo (ej: agregar `tags` o `priority`), agregar +0.5 día.

---

## Changelog

- 2026-05-17 — plan inicial generado por Claude desde la spec aprobada, cruzando con `indices/COMPONENTS.md`, `FACADES.md`, `SERVICES.md`, `DATABASE.md`, `MODELS.md`, `DIRECTIVES.md`, `STYLES.md` y las 8 reglas de `.claude/rules/`. Pendiente review humano antes de `/spec-tasks`
