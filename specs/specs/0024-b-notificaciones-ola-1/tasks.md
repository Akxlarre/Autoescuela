# Tasks 0024-b — Notificaciones Ola 1: infraestructura de tipos + primeros productores (RF-022)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done (2026-07-07) — QA manual del owner (T5.3) verificado OK, ver acceptance.md
> **Created:** 2026-07-06

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Modelos y Functional Core

- [x] **T1.1** — Ampliar modelos UI en `core/models/ui/notification.model.ts`
  - **AC ref:** AC1, AC8
  - **DoD:**
    - [x] `NotificationReferenceType` += `'enrollment' | 'certificate' | 'preinscription' | 'document'`
    - [x] Nuevo tipo `NotificationPanelEntry` (union `{ kind: 'single'; notification }` | `{ kind: 'group'; referenceType; type; count; ids: string[]; title; latestAt }`)
    - [x] Sin cambios en el DTO (`dto/notification.model.ts` intacto)
    - [x] Documentado en `indices/MODELS.md`

- [x] **T1.2** — TDD: extender `core/utils/notification.utils.spec.ts` PRIMERO
  - **AC ref:** AC1, AC8
  - **DoD:**
    - [x] Tests de mapeo: `enrollment`→success, `certificate`→success, `preinscription`→info, `document`→info, desconocido→info
    - [x] Tests de `groupNotifications`: 3+ no leídas mismo tipo mismo día → 1 grupo; 2 → sin grupo; tipos mezclados no se cruzan; leídas no agrupan; orden por fecha estable
    - [x] Tests FALLAN (sin implementación aún) — confirmado: 10 fallos por `groupNotifications is not a function`, 19 mapeos ya pasaban

- [x] **T1.3** — Implementar mapeos + `groupNotifications()` en `core/utils/notification.utils.ts`
  - **AC ref:** AC1, AC8
  - **DoD:**
    - [x] Tests de T1.2 PASAN (`npx vitest run src/app/core/utils/notification.utils.spec.ts` → 29/29 verde)
    - [x] `groupNotifications` es función pura (Data In → Data Out, sin inyecciones)
    - [x] Documentado en `indices/UTILS.md`

---

## Fase 2 — Capa Facade (núcleo)

- [x] **T2.1** — TDD: extender `core/facades/notifications.facade.spec.ts` PRIMERO
  - **AC ref:** AC2, AC8, AC-E1
  - **DoD:**
    - [x] `notifyRole`: filtra por rol BD (`'admin'`/`'secretary'`), aplica `.eq('branch_id')` solo para secretary, excluye al actor (`.neq('id', dbId)`), solo `active=true`
    - [x] `notifyUsers`: 1 solo INSERT con array de N filas
    - [x] `markManyAsRead`: optimistic update + rollback si el UPDATE falla
    - [x] `panelEntries`: agrupa con `groupNotifications` y corta a 15 entradas
    - [x] Caso sin destinatarios → no inserta y no lanza (AC-E3 lado cliente)
    - [x] Tests FALLAN — confirmado: 12 fallos por métodos inexistentes, 11 pasaban

- [x] **T2.2** — Implementar helpers en `core/facades/notifications.facade.ts`
  - **AC ref:** AC2, AC8, AC-E1
  - **DoD:**
    - [x] Tests de T2.1 PASAN (`npx vitest run src/app/core/facades/notifications.facade.spec.ts` → 23/23 verde)
    - [x] Patrón de destinatarios copiado de `TasksFacade.loadRecipients()` (query `users` + `roles!role_id(name)`)
    - [x] Errores capturados: fallo de insert solo loguea/warning, nunca lanza hacia el productor
    - [x] `createNotification()` existente queda intacto (lo usa TasksFacade)
    - [x] Documentado en `indices/FACADES.md`
    - [x] `panelNotifications` reemplazado por `panelEntries` (el consumo en `topbar.component.ts` se corrige en T3.3, Fase 3)

---

## Fase 3 — Capa UI (panel + deep-links)

- [x] **T3.1** — Panel agrupado en `shared/components/notifications-panel/` (`.ts` + `.scss`)
  - **AC ref:** AC8, AC1
  - **DoD:**
    - [x] Input pasa a `entries: NotificationPanelEntry[]` (req) + `notifications: Notification[]` (req, lookup para expandir miembros del grupo)
    - [x] Fila de grupo: contador + título ("4 matrículas confirmadas"), expandible con signal local `expandedGroups`
    - [x] Click en grupo expande/colapsa, NO navega; `data-llm-action="expand-notification-group"`
    - [x] Marcar grupo como leído emite `markReadMany(ids)` (botón dedicado `data-llm-action="mark-group-read"`, con `stopPropagation` para no togglear el expand)
    - [x] `iconFor` considera `referenceType` (enrollment/certificate/preinscription/class_b/professional_session/document/document_expiry/payment) con fallback a severidad
    - [x] Sigue siendo Dumb: solo `input()`/`output()`, OnPush, tokens del DS, `<app-icon>` (signal local solo para expand/collapse, sin Facades)
    - [x] `ng build` limpio (los component specs no corren en vitest — memoria del proyecto)
    - Nota: `npm run lint:arch` marca ARCH-09 (252 líneas, límite recomendado 200) como **warning**, no error — aceptado por el tamaño del template con grupo+nested list

- [x] **T3.2** — Registrar íconos Lucide nuevos en `src/app/app.config.ts`
  - **AC ref:** AC1
  - **DoD:**
    - [x] Cross-check de cada nombre usado por `iconFor` (`user-plus`, `award`, `clipboard-check`, `car`, `graduation-cap`, `file-text`, `credit-card`, `check`, `chevron-up`, `chevron-down`) contra el `pick()` actual → **todos ya estaban registrados**, sin cambios necesarios
    - [x] `npm run lint:arch` sin errores ARCH-14 nuevos (solo el info pre-existente de íconos sin uso, backlog)

- [x] **T3.3** — Deep-links en `layout/topbar.component.ts`
  - **AC ref:** AC3
  - **DoD:**
    - [x] `onNotifClicked` implementa la tabla tipo × rol (task existente intacto + preinscription, enrollment, class_b, certificate)
    - [x] **Corrección sobre plan §5:** la ruta real de `task` para secretaria es `/app/secretaria/observaciones` (verificado en `indices/ROUTES.md`), no `/app/secretaria/tareas` como decía la tabla del plan — se mantuvo el código existente, no se tocó
    - [x] Tipo sin ruta para el rol → cierra panel sin error ni navegación
    - [x] Topbar consume `panelEntries` (+ `notifications` para lookup) y conecta `markReadMany`
    - [x] Al navegar, la notificación queda leída (el `markRead.emit` del panel dispara antes del click de navegación en `onItemClick`)

---

## Fase 4 — Productores

- [x] **T4.1** — Matrícula confirmada en `core/facades/enrollment.facade.ts`
  - **AC ref:** AC6, AC-E1, AC-E4
  - **DoD:**
    - [x] Helper privado `notifyEnrollmentConfirmed(enrollmentNumber)` con: alumno (`draft.userId`, `reference_id` = **student_id**) + `notifyRole('admin', null)` (excluir actor lo hace `notifyRole` internamente vía `.neq('id', actorDbId)`)
    - [x] Llamado en la rama de éxito de **AMBOS** caminos: `confirmEnrollment()` y `confirmWithPayment()`
    - [x] Fire-and-forget (`.catch` → warning), la confirmación nunca falla por la notificación
    - [x] Tests en `enrollment.facade.spec.ts`: se notifica en ambos caminos (8 tests nuevos); el rechazo del insert no rompe (AC-E1); guard `!draft.userId` cubre el caso sin destinatario
    - [x] `npx vitest run src/app/core/facades/enrollment.facade.spec.ts` → 53/53 verde
    - Nota: se agregó `rpc: vi.fn()` al mock de Supabase del spec (faltaba, requerido por `generateEnrollmentNumber`/`confirm_enrollment_with_payment`)

- [x] **T4.2** — Reprogramación en `core/facades/admin-alumno-detalle.facade.ts`
  - **AC ref:** AC5, AC-E1
  - **DoD:**
    - [x] **Hallazgo confirmado:** `class_b_sessions.instructor_id` referencia `instructors(id)`, **NO** `users.id` directo (migración `20260301000003_03_academy_class_b.sql:41`). `instructors.user_id → users.id` (`:15`). Se agregó `resolveInstructorUserIds()` para resolver `instructors.id → users.id` vía `.in('id', [...])` antes de notificar.
    - [x] SELECT de la sesión ANTES del UPDATE para capturar instructor anterior (`previousInstructorId`)
    - [x] Notifica: alumno (`this._alumno()?.userId`, ya disponible en el facade sin query extra) + instructor nuevo + instructor anterior si cambió (`reference_type='class_b'`, `reference_id`=session_id, mensaje con fecha/hora vía `formatChileanDate`/`to24hTime`)
    - [x] El actor (admin/secretaria) no se auto-notifica (nunca está en la lista de destinatarios)
    - [x] Fire-and-forget; 4 tests nuevos en `admin-alumno-detalle.facade.spec.ts` (no cambia instructor / cambia instructor / AC-E1 / creación sin sessionId); `npx vitest run src/app/core/facades/admin-alumno-detalle.facade.spec.ts` → 11/11 verde

- [x] **T4.3** — Certificados en `certificacion-clase-b.facade.ts` y `certificacion-profesional.facade.ts`
  - **AC ref:** AC7, AC-E1
  - **DoD:**
    - [x] Notifica al alumno tras `generarCertificado()` exitoso y por cada éxito de `generarPendientes()` (helper `notifyCertificateReady()` en ambos facades)
    - [x] `enviarEmail()`/masivo NO generan segunda notificación (no se tocaron esos métodos, decisión del plan §5)
    - [x] `reference_type='certificate'`, `reference_id`=enrollment_id
    - [x] Recipient resuelto vía `resolveStudentUserId()` (`students.id → users.id`, análogo al hallazgo de T4.2 — el modelo solo trae `studentId`, no `users.id`)
    - [x] Fire-and-forget; **`certificacion-clase-b.facade.spec.ts` no existía — creado desde cero** (18 tests: smoke + generarCertificado + verCertificado + 3 de notificaciones); `certificacion-profesional.facade.spec.ts` extendido (+3 tests); `npx vitest run` → 18/18 y 21/21 verde

- [x] **T4.4** — Pre-inscripción web en `supabase/functions/public-enrollment/index.ts`
  - **AC ref:** AC4, AC-E1, AC-E3
  - **DoD:**
    - [x] En `handleSubmitPreInscription()` (tras el INSERT exitoso en `professional_pre_registrations`, línea ~838-841): query `users` (`roles!role_id(name)`, `active=true`) → filtra `admin` (todos) + `secretary` de `branch_id === branchId` → INSERT batch en `notifications` (`reference_type='preinscription'`, `reference_id`=id de la pre-inscripción)
    - [x] Todo el bloque en try/catch propio (líneas ~847-886): un fallo del INSERT (o de la query de destinatarios) jamás afecta la respuesta de la pre-inscripción — solo `console.error`
    - [x] Sede sin secretarias → notifica solo admins (el filtro no exige secretarias); 0 destinatarios → `notifyIds.length > 0` evita el INSERT vacío, sin error
    - [ ] **Prueba local pendiente** (`npx supabase start` + submit): no se ejecutó en esta sesión — Deno EF sin harness de test automatizado (plan §7) y sin stack local levantado. Queda como parte del QA manual de Fase 5 (T5.3), que ya lo contempla explícitamente.

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (sin errores nuevos sobre el backlog pre-existente)
  - Verificado con `git stash`/`pop`: HEAD = 39 errores/151 warnings → con la spec = 38 errores/155 warnings. **0 errores nuevos** (uno menos: se cerró el ARCH-03 de `certificacion-clase-b.facade.ts`, que no tenía spec). Los +4 warnings son ARCH-10 (inject()/método largo) en archivos tocados — no bloqueantes, mismo patrón que el resto del código.
- [x] **T5.2** — Tests por archivo verdes (utils, notifications, enrollment, alumno-detalle, certificación ×2) + `ng build` limpio
  - **Nota:** NO exigir suite global verde — `test:ci` tiene ~87 fallos ambientales pre-existentes (memoria del proyecto); comparar solo los archivos tocados
  - `npx vitest run` de los 6 specs tocados → **155/155 verde**. `ng build --configuration development` → limpio (solo el warning preexistente NG8113 de `AsistenciaClaseBContentComponent`, no relacionado)
- [x] **T5.3** — QA con `/verify` (Playwright, requiere `ng serve`)
  - **Verificado manualmente por el owner (Akxlarre) el 2026-07-07** — todo OK, sin issues.
  - **DoD:**
    - [x] Matrícula de prueba → campana del admin recibe en vivo (Realtime + toast)
    - [x] 3 notificaciones del mismo tipo → fila agrupada expandible (AC8), badge cuenta individuales
    - [x] Click en cada tipo → deep-link correcto según rol; tipo sin ruta no navega
    - [x] Pre-inscripción pública local → notificación llega a secretaria (AC4)
    - [x] Dark mode + consola sin errores
- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** los 12 ACs (AC1-AC8 + AC-E1..E4) con evidencia en `acceptance.md` → veredicto ✅ PASA (10 cumplidos con test, 2 por construcción documentada, 0 fallidos; T5.3 verificado manualmente por el owner 2026-07-07)

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar índices (`/sync-indices`): FACADES, MODELS, UTILS, COMPONENTS, USAGE-MAP + estado de productores en `indices/NOTIFICATIONS-MAP.md`
  - `/sync-indices` + `npm run indices:sync` (11 índices regenerados, anotaciones manuales de Spec 0024-b preservadas). `indices/NOTIFICATIONS-MAP.md` actualizado: R4/R5/R6 marcadas resueltas, A1/A2/A3/B1 marcados ✅ implementados, Ola 1 marcada implementada en §8
- [x] **T6.2** — Marcar spec 0024-b como `done` en `specs/ROADMAP.md`
  - Movida de "Backlog" a "Done" con fecha 2026-07-07 y resumen de verificación; `tasks.md` status → `done`
- [x] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
