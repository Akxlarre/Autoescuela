# Spec 0001-b — Sistema de tareas y observaciones multi-rol

> **Status:** approved
> **Created:** 2026-05-17
> **Approved:** 2026-05-17
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Piloto del sistema SDD. Existen stubs vacíos en `/app/admin/tareas` y `/app/secretaria/observaciones`. Hoy la comunicación operativa entre roles ocurre por WhatsApp, hojas sueltas y memoria.

**Personas afectadas:**
- **Admin:** necesita asignar tareas y dar seguimiento a las secretarias de su sede; recibe observaciones de las secretarias.
- **Secretaria:** recibe tareas del admin, le manda observaciones, y necesita asignar tareas a los instructores (ej: "llamar al alumno Pérez", "revisar agenda del jueves").
- **Instructor:** hasta hoy no recibe comunicación estructurada. Hay que abrirle un canal para recibir tareas/preguntas desde secretaría.

**Problema que resuelve:**
El equipo coordina operación por canales informales que dejan sin rastro las instrucciones, no permiten medir cumplimiento y obligan a la secretaria a repetir lo mismo varias veces. Sin sistema de tareas con trazabilidad, no hay manera de saber qué se le dijo al instructor sobre un alumno hace una semana.

**Hipótesis de valor:**
Con un canal estructurado dentro de la app, cada rol abre la pestaña "Tareas" y ve exactamente qué le pidieron, quién, cuándo, con due date y estado. Reduce el tiempo de coordinación diaria y elimina la pregunta "¿quién te dijo eso?".

---

## 2. User Stories

- **US1:** Como **admin**, quiero crear tareas para una secretaria de mi sede con tipo, asunto, cuerpo y opcionalmente due date, para asignar trabajo con seguimiento.
- **US2:** Como **secretaria**, quiero dejar observaciones dirigidas al admin de mi sede (sin acción requerida, solo informativas), para que tenga contexto cuando llegue a la oficina.
- **US3:** Como **secretaria**, quiero asignar tareas a un instructor que trabaja en mi sede, para coordinar acciones operativas (ej: "llamar al alumno X", "no usar el vehículo Y mañana").
- **US4:** Como **instructor**, quiero ver mi bandeja de tareas asignadas por secretaría, para no perderme indicaciones operativas.
- **US5:** Como **destinatario** de cualquier tarea, quiero marcar la tarea como "en progreso" o "completada", para que el emisor sepa que ya la vi y/o la resolví.
- **US6:** Como **participante** de un hilo tipo "pregunta", quiero responder con texto libre y ver el historial de respuestas, para resolver dudas operativas sin salir de la app.
- **US7:** Como **destinatario**, quiero recibir notificación en tiempo real cuando me asignan una tarea nueva, para no tener que estar refrescando la bandeja.

---

## 3. Acceptance Criteria (Gherkin)

### Flujo admin → secretaria

- **AC1:** Given soy admin autenticado y existe una secretaria activa en mi sede, When creo una tarea con `type="task"`, destinatario=esa secretaria, asunto, body y `due_date` válida, Then la tarea queda persistida con `status="pending"` y la secretaria recibe una notificación in-app vía `NotificationsFacade`.

- **AC2:** Given existe una tarea pendiente dirigida a mí, When la marco como `in_progress`, Then el `status` se actualiza y el admin emisor ve el cambio en tiempo real (Supabase Realtime).

- **AC3:** Given una tarea está en `in_progress`, When el destinatario la marca como `completed`, Then el `status` cambia a `completed`, queda `completed_at` con timestamp, y el emisor recibe notificación.

### Flujo secretaria → admin

- **AC4:** Given soy secretaria autenticada, When creo una observación con `type="observation"` y body de texto libre, Then la observación queda visible para todos los admin de mi sede con `status="seen=false"`, y el sistema **no** permite definir `due_date` (campo deshabilitado en UI y rechazado en server).

- **AC5:** Given un admin abre una observación dirigida a él, When la lee, Then el `status` pasa a `seen=true` y queda registrado `seen_at` + `seen_by`.

### Flujo secretaria → instructor

- **AC6:** Given soy secretaria de la sede A y el instructor X tiene asignaciones activas en la sede A, When le asigno una tarea, Then la tarea queda dirigida a X y aparece en su bandeja `/app/instructor/tareas` con notificación.

- **AC7:** Given soy secretaria de la sede A, When intento asignar una tarea a un instructor que **no** trabaja en mi sede, Then el server rechaza con 403 y la UI muestra error "Sin permisos sobre este instructor".

### Hilos tipo pregunta

- **AC8:** Given existe una tarea con `type="question"` entre dos usuarios, When cualquier participante envía una respuesta de texto, Then la respuesta se agrega como `task_replies` ligada por `task_id`, y ambos ven el historial cronológico al abrir la tarea.

- **AC9:** Given hay un hilo de preguntas activo, When uno de los dos lo marca como `completed`, Then ambos quedan bloqueados de agregar más respuestas (el hilo queda en modo solo-lectura).

### Edge cases obligatorios

- **AC-E1:** Given soy secretaria, When intento crear una tarea para mí misma o para otra secretaria, Then el sistema rechaza con error "Destinatario no permitido para tu rol". Matriz permitida en v1: `admin→{secretaria, instructor}`, `secretaria→{admin, instructor}`. Bloqueado: `secretaria→secretaria`, `instructor→cualquiera` (instructor solo recibe y responde dentro de hilos `type='question'` donde fue invitado).

- **AC-E2:** Given existe una tarea pendiente, When el destinatario intenta editar el `subject` o `body` (no el `status`), Then el server rechaza con 403 (solo el emisor puede editar contenido, y solo mientras `status="pending"`).

- **AC-E3:** Given estoy creando una tarea con `type="task"` y `due_date` en el pasado, When confirmo, Then el sistema permite (a veces se carga retroactivamente) pero la tarea queda visualmente marcada como "vencida" desde el inicio.

- **AC-E4:** Given un usuario es eliminado/desactivado, When tenía tareas pendientes asignadas, Then las tareas siguen visibles para el emisor pero marcadas con badge "Destinatario inactivo" — no se eliminan en cascada.

- **AC-E5:** Given el admin filtra por sede en su contexto multi-sede, When listo tareas, Then solo se muestran las tareas cuya `branch_id` coincide con la sede seleccionada (filtro vía `BranchFacade.selectedBranchId()`).

---

## 4. Out of scope

> Si surge durante la implementación, **crear spec nueva**, NO extender ésta.

- ❌ **Notificaciones por email o SMS** — solo in-app via `NotificationsFacade` Realtime
- ❌ **Adjuntos de archivos** (fotos, PDFs) en tareas — solo texto en esta versión
- ❌ **Vinculación a entidades** (Alumno / Clase / Vehículo) — el usuario decidió "mensajes sueltos" sin contexto. Si más adelante hace falta, se agrega en spec nueva con migración de `related_entity_type` + `related_entity_id`.
- ❌ **Sistema de menciones** `@usuario` dentro del body
- ❌ **Plantillas de tareas recurrentes** (ej: "Todos los lunes recordar X")
- ❌ **Reportes / KPIs** de cumplimiento (tareas vencidas %, tiempo promedio de resolución, etc.)
- ❌ **Push notifications mobile** (PWA/native)
- ❌ **Flujo instructor → secretaria/admin** (instructor solo recibe en esta versión; canal de respuesta solo dentro de hilos tipo "pregunta" donde él fue invitado)
- ❌ **Permisos finos por sub-rol** (ej: secretaria_junior vs secretaria_senior)
- ❌ **Eliminación lógica con papelera** — soft delete simple (`deleted_at`), sin UI de recuperación

---

## 5. Dependencias

### Specs previas
- Ninguna. Es la primera spec del proyecto.

### Capacidades del proyecto que se asumen existentes
- `AuthFacade` con `currentUser()` que incluye `id`, `dbId`, `role`, `branchId`
- `BranchFacade` con `selectedBranchId()` para scope multi-sede
- `NotificationsFacade` (Capa 2 — persistente + Realtime) para alertas in-app
- `SupabaseService` con cliente configurado
- Tablas existentes: `users`, `roles`, `branches`, `enrollments`, `instructor_assignments` (para validar que un instructor "trabaja" en una sede)
- Patrón de drawers y modales del Design System
- `ToastService` para feedback efímero

### Capacidades nuevas requeridas
- Tabla nueva `tasks` (unificada según decisión del usuario)
- Tabla nueva `task_replies` (para hilos type=question)
- **Migración destructiva de `secretary_observations`:** transferir filas existentes a `tasks` con `type='observation'`, y luego `DROP TABLE secretary_observations`. Sin vista de compatibilidad (no hay UI productiva que la consuma — solo el stub vacío)
- Nuevo `TasksFacade` en `core/facades/tasks.facade.ts`
- Nueva rutas: `/app/admin/tareas`, `/app/secretaria/observaciones` (reemplazan stubs), `/app/instructor/tareas` (nueva)
- Componentes Dumb nuevos: card de tarea, drawer de creación, modal de detalle/respuestas
- Integración Realtime con la tabla `tasks` filtrada por `to_user_id` o `from_user_id`

---

## 6. Datos y modelo (preliminar)

> Detalle técnico final va en `plan.md`. Acá solo el shape conceptual.

### Tabla `tasks`

```
id                  uuid PK
branch_id           int FK -> branches (scope multi-sede)
from_user_id        int FK -> users
from_role           text ('admin' | 'secretaria')  -- denormalizado para query rápido
to_user_id          int FK -> users
to_role             text ('admin' | 'secretaria' | 'instructor')
type                text ('task' | 'observation' | 'question')
subject             text NOT NULL
body                text
status              text ('pending' | 'in_progress' | 'completed' | 'seen')
due_date            timestamptz NULL  -- solo si type='task'
completed_at        timestamptz NULL
seen_at             timestamptz NULL
seen_by             int FK -> users NULL
created_at          timestamptz DEFAULT now()
updated_at          timestamptz
deleted_at          timestamptz NULL  -- soft delete
```

### Tabla `task_replies`

```
id                  uuid PK
task_id             uuid FK -> tasks ON DELETE CASCADE
from_user_id        int FK -> users
body                text NOT NULL
created_at          timestamptz DEFAULT now()
```

### RLS preliminar

| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|--------|--------|--------|
| Admin | tareas de su(s) sede(s) — visibilidad completa | crear como admin a sec/instructor de su sede | propias (subject/body si pending) + status si destinatario | soft delete propias |
| Secretaria | **solo** tareas donde `from_user_id = ella` OR `to_user_id = ella` (NO ve las de otras secretarias de su sede) | crear como secretaria a admin/instructor de su sede | propias (si pending) + status si destinatario | soft delete propias |
| Instructor | tareas donde `to_user_id = él` | **solo** `task_replies` en hilos donde fue invitado (NO puede crear filas en `tasks` — receptor puro en v1) | solo `status` cuando es destinatario | nunca |

---

## 7. UX y flujos (preliminar)

> Wireframe verbal. Detalle visual va con el design-system existente (bento-grid, drawers, cards).

### Pantalla admin: `/app/admin/tareas`

- Hero con conteo "X tareas pendientes" y CTA "Nueva tarea"
- Tabs: `[Asignadas por mí]` `[Dirigidas a mí]` `[Observaciones de secretaría]`
- Lista de cards con badge de estado, due date (si aplica), destinatario, asunto
- Click en card → modal/drawer detalle con body, historial de respuestas (si type=question), botones según rol y estado

### Pantalla secretaría: `/app/secretaria/observaciones`

- Hero con CTA "Nueva observación" + CTA secundario "Nueva tarea a instructor"
- Tabs: `[Mis observaciones al admin]` `[Tareas que me asignaron]` `[Tareas que asigné a instructores]`
- Mismo patrón de cards

### Pantalla instructor: `/app/instructor/tareas` (NUEVA ruta)

- Hero con conteo de pendientes
- Lista de cards de tareas dirigidas a él
- Click → detalle con body, botones "Marcar en progreso" / "Marcar completada" / responder (si type=question)
- NO ve botón "Nueva tarea" (no puede iniciar comunicación, solo recibir/responder)

### Estados especiales
- **Loading:** skeleton de cards (siguiendo patrón existente)
- **Empty:** `<app-empty-state>` con mensaje "Sin tareas pendientes"
- **Error:** toast con mensaje + retry

---

## 8. Métricas de éxito post-launch

- 80%+ de las tareas creadas pasan a `completed` dentro de 7 días (medible vía query)
- < 5% de tareas con `due_date` quedan vencidas más de 48h sin marcar (señal de adopción real)
- 100% de las observaciones de secretaría son leídas por algún admin dentro de 24h
- Reducción cualitativa (encuesta interna a las 2 semanas) de la fricción de coordinación por WhatsApp

---

## 9. Decisiones tomadas (resolución del cuestionario inicial)

- [x] **Prioridad:** P1 — necesario en este sprint, no bloquea operativa actual
- [x] **`secretary_observations`:** migrar datos a `tasks` con `type='observation'` y luego `DROP TABLE`. Sin vista de compat (no hay UI productiva consumidora — solo el stub vacío)
- [x] **Visibilidad cruzada de secretarias:** una secretaria **no** ve tareas asignadas a otras secretarias de su sede. Privacidad por defecto. Solo ve tareas donde es emisora o destinataria
- [x] **Instructor iniciador:** instructor es **receptor puro** en v1. No puede crear `tasks`. Solo responde en hilos `type='question'` donde el otro participante lo invitó
- [x] **Sobrescritura de stubs:** los stubs `/admin/tareas` y `/secretaria/observaciones` se reemplazan sin backwards-compatibility (están vacíos)

---

## Changelog

- 2026-05-17 — draft inicial por Claude (con decisiones del usuario en cuestionario SDD), pendiente review humano
- 2026-05-17 — aprobada por Akxlarre tras cuestionario de 4 decisiones (prioridad P1, migrar y dropear `secretary_observations`, secretarias sin visibilidad cruzada, instructor solo receptor). Status: draft → approved
