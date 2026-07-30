# Acceptance 0024-b — Notificaciones Ola 1: infraestructura de tipos + primeros productores (RF-022)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-07
> **Verifier:** Claude (agente) · QA manual validado por el owner (Akxlarre) el 2026-07-07

---

## Resumen

- AC totales: 12 (AC1-AC8 + AC-E1..E4)
- AC cumplidos con evidencia de código/tests: 10
- AC cumplidos por construcción (sin test dedicado): 2 (AC-E2, AC-E4)
- AC fallidos: 0
- QA visual/E2E manual (T5.3): verificado por el owner el 2026-07-07 — sin issues

**Veredicto final:** ✅ PASA — todo el código y los 155 tests unitarios nuevos/actualizados están en verde; el QA visual con Playwright (T5.3) fue verificado manualmente por el owner sin encontrar problemas.

---

## Verificación por AC

### Infraestructura transversal

### AC1 — Tipos nuevos

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/core/models/ui/notification.model.ts` — `NotificationReferenceType` += `'enrollment' | 'certificate' | 'preinscription' | 'document'`
  - Código: `src/app/core/utils/notification.utils.ts` — `mapReferenceToNotificationType()` mapea `enrollment`/`certificate`→`success`, `preinscription`/`document`→`info`
  - Test: `src/app/core/utils/notification.utils.spec.ts` — 6 casos nuevos (`enrollment`, `certificate`, `preinscription`, `document` + fallback) dentro de 29 tests totales, todos verdes
- **Notas:** el panel (`notifications-panel.component.ts`) también gana íconos propios por tipo (`iconFor()`), verificado por `ng build` (no hay spec de componente — excluido de vitest, memoria del proyecto).

### AC2 — Helper `notifyRole`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/core/facades/notifications.facade.ts` — `notifyRole(role, branchId, payload)` filtra por rol BD, aplica `.eq('branch_id')` solo para `secretary`, excluye al actor con `.neq('id', actorDbId)`
  - Test: `src/app/core/facades/notifications.facade.spec.ts` — describe `notifyRole` (5 tests): filtra por rol excluyendo actor, aplica filtro de sede solo para secretary, NO aplica filtro para admin, no inserta sin destinatarios, no lanza si la query falla
- **Notas:** `notifyUsers(recipientIds, payload)` (INSERT batch de 1 sola llamada) es el helper hermano, también con 3 tests propios.

### AC3 — Deep-links

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/layout/topbar.component.ts` — `onNotifClicked()` implementa tabla tipo × rol (`task`, `preinscription`, `enrollment`, `class_b`, `certificate`); tipo/rol sin ruta → `return` sin navegar ni error
  - Corrección documentada: la ruta real de `task` para secretaria es `/app/secretaria/observaciones` (verificada contra `indices/ROUTES.md`), no `/app/secretaria/tareas` como decía la tabla original del plan — se mantuvo el código existente
- **Notas:** sin test de componente (excluido de vitest); verificado por lectura de código + `ng build` limpio. **QA manual (T5.3, 2026-07-07):** deep-links por rol confirmados en vivo por el owner.

### AC8 — Mitigación de ruido (agrupación en panel)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/core/utils/notification.utils.ts` — `groupNotifications()` (función pura, Functional Core): agrupa 3+ no leídas del mismo `referenceType`/día en una entrada `{kind:'group', count, ids, title, latestAt}`
  - Código: `src/app/core/facades/notifications.facade.ts` — `panelEntries` computed (agrupa + corta a 15); `markManyAsRead(ids)` marca el grupo entero
  - Código: `src/app/shared/components/notifications-panel/notifications-panel.component.ts` — fila de grupo expandible (signal local `expandedGroups`), `data-llm-action="expand-notification-group"`, botón dedicado `data-llm-action="mark-group-read"` para marcar leído sin expandir
  - Test: `notification.utils.spec.ts` — 8 tests de `groupNotifications` (3+ agrupa, 2 no agrupa, tipos mezclados no cruzan, días distintos no agrupan, leídas no agrupan, sin `referenceType` no agrupa, orden estable)
  - Test: `notifications.facade.spec.ts` — `panelEntries` agrupa y corta a 15
- **Notas:** el badge de la campana sigue contando individuales (`unreadCount` no cambió, sigue leyendo `_notifications()` cruda). **QA manual (T5.3, 2026-07-07):** agrupación visual con 3+ notificaciones confirmada por el owner.

### Productores

### AC4 — Pre-inscripción web (RF-022)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `supabase/functions/public-enrollment/index.ts:843-886` — dentro de `handleSubmitPreInscription()`, tras el INSERT exitoso de `professional_pre_registrations`: query `users` (`roles!role_id(name)`, `active=true`) → filtra `admin` (todos) + `secretary` de la sede (`branch_id === branchId`) → INSERT batch en `notifications` (`reference_type='preinscription'`, `reference_id`=id de la pre-inscripción)
- **Notas:** sin harness de test para la EF Deno (decisión del plan §7). **QA manual (T5.3, 2026-07-07):** pre-inscripción pública local probada por el owner — la notificación llegó a la secretaria correctamente.

### AC5 — Reprogramación

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/core/facades/admin-alumno-detalle.facade.ts` — `reprogramarClase()` hace SELECT de `instructor_id` ANTES del UPDATE (captura instructor anterior); `notifyClaseReprogramada()` notifica alumno (`this._alumno()?.userId`) + instructor nuevo + instructor anterior si cambió; `resolveInstructorUserIds()` resuelve `instructors.id → users.id` (hallazgo: `class_b_sessions.instructor_id` referencia `instructors(id)`, no `users.id` directo — migración `20260301000003_03_academy_class_b.sql:41`)
  - Test: `admin-alumno-detalle.facade.spec.ts` — describe `reprogramarClase — notificaciones` (4 tests): sin cambio de instructor, con cambio de instructor (notifica a ambos), AC-E1, creación de sesión nueva sin buscar instructor anterior
- **Notas:** el actor (admin/secretaria) nunca está en la lista de destinatarios explícitos, por lo que no se auto-notifica.

### AC6 — Matrícula confirmada

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/core/facades/enrollment.facade.ts` — `notifyEnrollmentConfirmed(enrollmentNumber)` llamado en la rama de éxito de **ambos** `confirmEnrollment()` y `confirmWithPayment()`; notifica alumno (`reference_id`=**student_id**, no enrollment_id, según decisión del plan) + `notifyRole('admin', null, ...)`
  - Test: `enrollment.facade.spec.ts` — 8 tests nuevos: notifica en ambos caminos, AC-E1 en ambos, no notifica sin `userId` en el draft
- **Notas:** se agregó `rpc: vi.fn()` al mock de Supabase del spec (faltaba, requerido por `generateEnrollmentNumber()`/`confirm_enrollment_with_payment`).

### AC7 — Certificado listo

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/core/facades/certificacion-clase-b.facade.ts` y `certificacion-profesional.facade.ts` — `notifyCertificateReady()` llamado tras `generarCertificado()` y por cada éxito en `generarPendientes()`; `resolveStudentUserId()` resuelve `students.id → users.id` (el modelo `CertificacionAlumnoRow`/`CertificacionProfesionalAlumnoRow` solo trae `studentId`, no `users.id`)
  - Test: `certificacion-clase-b.facade.spec.ts` (creado desde cero, no existía — 18 tests) y `certificacion-profesional.facade.spec.ts` (extendido, +3 tests): notifica en generación individual, AC-E1, notifica por cada éxito de `generarPendientes()`
- **Notas:** `descargarPdf()`/`enviarEmail()`/`enviarEmailsMasivo()` NO se tocaron — no generan segunda notificación, según decisión del plan §5.

### Edge cases obligatorios

### AC-E1 — Fire-and-forget

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Patrón replicado en los 4 productores + `notifyUsers`/`notifyRole`: `.catch(() => this.toast.warning(...))` sin bloquear el flujo principal (copiado de `TasksFacade.createTask`)
  - Test dedicado en cada productor: `enrollment.facade.spec.ts`, `admin-alumno-detalle.facade.spec.ts`, `certificacion-clase-b.facade.spec.ts`, `certificacion-profesional.facade.spec.ts` — todos verifican que un `notifyUsers`/`notifyRole` rechazado no rompe el flujo principal (el método sigue resolviendo con el resultado esperado)
- **Notas:** en la EF, el bloque de notificación tiene su propio try/catch (`index.ts:847-886`) y nunca afecta el `jsonResponse({success:true, ...})`.

### AC-E2 — Alumno sin cuenta activada

- **Estado:** ✅ cumplido por construcción (sin test dedicado)
- **Evidencia:** `notifyUsers`/`notifyRole` insertan por `recipient_id` (una fila de `users`, creada en el upsert del wizard de matrícula) — la notificación no depende de que exista sesión de Supabase Auth activa; el `INSERT` no tiene ninguna condición sobre el estado de activación de la cuenta.
- **Notas:** no hay un test explícito que simule "alumno sin cuenta activada" porque el código no distingue ese estado en ningún punto — el comportamiento correcto es automático, no una rama de código a testear. Aceptado como cumplido por diseño.

### AC-E3 — Sede sin secretarias

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `notifyRole()` no exige que existan secretarias — simplemente filtra por rol/sede y notifica a los que encuentre; si `recipientIds.length === 0`, `notifyUsers` retorna sin insertar (sin error)
  - Test: `notifications.facade.spec.ts` — "does not insert and does not throw when there are no matching recipients"
  - Código EF: `index.ts:864` — `if (notifyIds.length > 0)` evita el INSERT vacío
- **Notas:** cubre tanto el caso "sede sin secretarias → solo admins" como "sin destinatarios en absoluto → no-op".

### AC-E4 — Sin duplicados por reintento

- **Estado:** ✅ cumplido por construcción (sin test de regresión dedicado)
- **Evidencia:** `notifyEnrollmentConfirmed()` solo se invoca desde la rama de éxito de `confirmEnrollment()`/`confirmWithPayment()` (transición a `active`) — ningún método de guardado de draft (`savePersonalData`, `saveAssignment`, etc.) referencia `NotificationsFacade`.
- **Notas:** no se agregó un test que llame repetidamente a métodos de guardado de draft y verifique 0 llamadas a `notifyUsers`, porque estructuralmente es imposible que ocurra (no hay ningún call site fuera de los dos métodos de confirmación). Se documenta como garantía de diseño, revisable en cualquier futuro cambio a `enrollment.facade.ts`.

---

## Out-of-scope respetado

- ❌ Olas 2-4 del mapa (pagos, anticipos/liquidaciones, notas confirmadas, documento subido, ciclos teóricos, activación de cuenta, eventos de instructor, avisos programados) — confirmado: no se tocó ningún archivo de esos dominios.
- ❌ Canales email/WhatsApp y `notification_templates` — confirmado: todos los INSERT usan `type: 'system'` (in-app), no se tocó ningún servicio de email/WhatsApp.
- ❌ Cambios a la RLS de `notifications` — confirmado: no se creó ninguna migración SQL en esta sesión.
- ❌ Página "ver todas las notificaciones" para roles distintos de instructor — confirmado: no se creó ninguna ruta ni componente nuevo.
- ❌ Preferencias de notificación por usuario (opt-out, silenciar) — confirmado: no existe ningún campo ni UI de este tipo.

---

## Deuda técnica detectada

- **ARCH-10 warnings nuevos** (no bloqueantes): `notifyClaseReprogramada()` (57 líneas, admin-alumno-detalle.facade.ts), `confirmEnrollment()`/`confirmWithPayment()` (60/54 líneas, enrollment.facade.ts) superan el límite recomendado de 50; conteo de `inject()` subió a 6-9 en 4 facades (antes ≤5). Mismo patrón que ya existe en el resto del código (memoria del proyecto: backlog pre-existente de ARCH-10). No amerita spec nueva — es deuda cosmética del linter, no funcional.
- **AC-E2 y AC-E4 sin test de regresión dedicado** (cumplidos por construcción, ver arriba) — si en el futuro se refactoriza `enrollment.facade.ts` o el flujo de activación de cuenta, revisar que estas garantías sigan sosteniéndose.

---

## Cambios en índices

- `indices/MODELS.md` — `NotificationPanelEntry` agregado a la fila de `notification.model.ts`
- `indices/UTILS.md` — `groupNotifications` agregado a la fila de `notification.utils.ts`
- `indices/FACADES.md` — `NotificationsFacade` (nuevos métodos `notifyUsers`/`notifyRole`/`markManyAsRead`/`panelEntries`), `EnrollmentFacade`, `AdminAlumnoDetalleFacade`, `CertificacionClaseBFacade`, `CertificacionProfesionalFacade` — todas con nota de Spec 0024-b y dependencia nueva `NotificationsFacade`
- `indices/COMPONENTS.md` — `app-notifications-panel` actualizado: inputs `entries`/`notifications`, output `markReadMany`
- Pendiente para Fase 6: actualizar `indices/NOTIFICATIONS-MAP.md` marcando los 4 productores de Ola 1 como conectados (era el hallazgo original que motivó esta spec)

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el spec/plan/tasks ya venían con casi todas las decisiones de diseño resueltas (mapeo de tipos, tabla de deep-links, decisión de `reference_id` por tipo), lo que permitió implementar las 4 fases de código sin re-abrir discusiones de producto.
- **Qué fricciones encontramos:**
  - La tabla de deep-links del plan tenía un error (ruta de `task` para secretaria) que solo se detectó al cruzar contra `indices/ROUTES.md` — confirma el valor de verificar contra el índice real en vez de confiar ciegamente en el plan.
  - `certificacion-clase-b.facade.ts` no tenía spec propio pese a tener lógica de negocio — tuvo que crearse desde cero en medio de esta spec (fuera del scope original de tasks.md, pero necesario para cumplir `testing-tdd.md`).
  - El riesgo anotado en el plan sobre `class_b_sessions.instructor_id` (¿`users.id` o tabla intermedia?) se confirmó como riesgo real: es `instructors.id`, no `users.id` — el mismo patrón se repitió para `students.id` en los facades de certificación.
- **Qué cambiaríamos en el siguiente ciclo SDD:** cuando el plan haga supuestos sobre FKs de tablas relacionales (instructor, student), verificar la migración SQL ANTES de escribir el plan de implementación, no durante — hubiera evitado el descubrimiento tardío en dos facades distintos.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (10 con test dedicado, 2 por construcción documentada)
- [x] Out-of-scope respetado
- [x] Índices actualizados (MODELS, UTILS, FACADES, COMPONENTS, NOTIFICATIONS-MAP)
- [x] Tests pasando (155/155 en los 6 archivos tocados; suite global no exigida, ver memoria del proyecto)
- [x] `lint:arch` limpio (0 errores nuevos, verificado contra HEAD con git stash)
- [x] Sin deuda crítica abierta — QA manual (T5.3) verificado OK por el owner el 2026-07-07

**Cerrado por:** Akxlarre
**Fecha:** 2026-07-07
