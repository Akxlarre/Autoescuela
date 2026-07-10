# Mapa de Productores de Notificaciones (Capa 2)

> Relevamiento funcional: qué flujos de negocio deberían emitir notificaciones persistentes,
> quién las recibe, por qué vía se insertan y en qué orden conviene implementarlas.
> Fecha: 2026-07-06. **Actualizado 2026-07-07 (Spec 0024 — Ola 1 implementada):** además de `TasksFacade`,
> ahora también producen `EnrollmentFacade` (A1), `AdminAlumnoDetalleFacade` (A2), `CertificacionClaseBFacade`/
> `CertificacionProfesionalFacade` (A3) y la EF `public-enrollment` (B1).
> **Actualizado 2026-07-10 (Spec 0025 — Ola 2 implementada):** además producen `EnrollmentPaymentFacade`,
> `PagosFacade`, `CursosSingularesFacade`, `ServiciosEspecialesFacade` (A4), `EvaluacionesProfesionalFacade` (A5),
> `AnticiosFacade` (A6), `LiquidacionesFacade` (A7) y las EF `student-payment` (B2) y `activate-student-account` (B3).
> **Actualizado 2026-07-10 (Spec 0026 — Ola 3 implementada):** los últimos 3 productores (C1, C2, D1) ya no
> dependen de código Angular — son triggers SQL `SECURITY DEFINER` en `class_b_sessions` y `tasks`/`task_replies`
> (`notify_class_b_completed`, `notify_deposit_reminder`, `notify_task_reply`, `notify_task_completed`).
> **Actualizado 2026-07-10 (Spec 0027 — Ola 4 implementada, D3):** vencimiento de documentos de flota
> resuelto con `notify_vehicle_document_expiry()` (pg_cron diario, mismo patrón sin `pg_net`). D2/D4/WhatsApp
> quedan fuera del alcance de esta ola (ver §8).
> Ver §8 para el detalle.

---

## 1. Restricciones verificadas (leyes del terreno)

Antes de proponer productores, esto es lo que la infraestructura permite hoy:

| # | Restricción | Evidencia | Consecuencia |
|---|---|---|---|
| R1 | **RLS INSERT: solo `admin` y `secretary`** pueden insertar en `notifications` desde el cliente | `20260522000003_fix_notifications_insert_rls_secretary.sql` | Eventos cuyo actor es instructor, alumno o público anónimo **no pueden** notificar vía `NotificationsFacade.createNotification()` — necesitan Edge Function (service role), trigger SQL o ampliación de RLS |
| R2 | La campana existe en **los 4 portales** | `AppShellComponent` inicializa `NotificationsFacade` para todo usuario autenticado; `TopbarComponent` muestra panel + badge | Cualquier usuario (admin, secretaria, instructor, alumno) puede **recibir**; llegan por Realtime + toast simultáneo |
| R3 | Solo el **instructor** tiene página completa de notificaciones funcional (`/app/instructor/notificaciones`) | Las rutas `/app/{admin,secretaria,alumno}/notificaciones` existen pero son **stubs PLANO** | Admin/secretaria/alumno solo ven las últimas 15 del panel (historial carga 50); construir esas páginas = reemplazar 3 stubs, no crear rutas |
| R4 | ~~`reference_type` conocidos: `class_b`, `professional_session`, `document_expiry`, `payment`, `task`~~ | `notification.utils.ts` (`mapReferenceToNotificationType`) | ✅ **Resuelto (Spec 0024):** se agregaron `enrollment`, `certificate`, `preinscription`, `document` con mapeo de color propio |
| R5 | ~~Deep-link solo para `task`~~ | `topbar.component.ts` → `onNotifClicked()` | ✅ **Resuelto (Spec 0024):** tabla tipo × rol para `task`, `preinscription`, `enrollment`, `class_b`, `certificate` |
| R6 | ~~No existe helper "notificar a un rol/sede"~~ | `notifications.facade.ts` | ✅ **Resuelto (Spec 0024):** `notifyRole(role, branchId, payload)` + `notifyUsers(recipientIds, payload)` |
| R7 | Canales `email`/`whatsapp` y `notification_templates` (RF-016/017) modelados pero **sin implementación de envío** | Tabla `notifications` (type, sent_ok, send_error) + tabla `notification_templates` vacía de uso | Este mapa cubre solo canal `system` (in-app). Email/WhatsApp es un proyecto aparte |

**Principios de diseño** (para no generar ruido):

- **Nunca notificar al actor su propia acción** — el toast (Capa 1) ya lo cubre.
- **No espejar las alertas del dashboard (Capa 3)** — las alertas son estado vivo que se auto-resuelve; la notificación es un evento puntual dirigido a una persona. Solo se justifica notificación cuando el destinatario NO vive en el dashboard (alumno, instructor) o el evento es puntual (llegó una pre-inscripción ≠ hay N pendientes).
- **Cuidado con el volumen hacia el admin** — 30 pagos/día como notificaciones es spam; el dashboard ya tiene KPI "pagos de hoy" (F-1).

---

## 2. Grupo A — Implementables HOY desde el cliente (actor = admin/secretaria)

Mismo patrón que `TasksFacade.createTask()`: insert fire-and-forget tras la mutación exitosa.

| # | Evento | Origen (facade · método) | Destinatario(s) | `reference_type` | RF | Valor |
|---|---|---|---|---|---|---|
| A1 | ✅ **Matrícula confirmada** (paso 6 del wizard) — implementado Spec 0024 | `EnrollmentFacade.notifyEnrollmentConfirmed()` | Alumno (confirmación de su matrícula) · Todos los admins | `enrollment` | RF-022 (parcial) | 🔥 Alto |
| A2 | ✅ **Clase B reprogramada** — implementado Spec 0024 | `AdminAlumnoDetalleFacade.reprogramarClase()` / `notifyClaseReprogramada()` | Alumno **y** instructor(es) afectados (nuevo + anterior si cambió) | `class_b` | — | 🔥 Alto |
| A3 | ✅ **Certificado listo** — implementado Spec 0024 (solo generación, no envío por email) | `CertificacionClaseBFacade` / `CertificacionProfesionalFacade` · `notifyCertificateReady()` | Alumno ("tu certificado está disponible") | `certificate` | RF-025 (cercano) | 🔥 Alto |
| A4 | ✅ **Pago presencial registrado** — implementado Spec 0025 | `EnrollmentPaymentFacade.recordPayment()` · `PagosFacade.registrarNuevoPago()` · `CursosSingularesFacade.marcarEnrollmentPagado()` · `ServiciosEspecialesFacade.registrarCobro()` | Alumno (comprobante in-app). ⚠️ Al admin NO (ruido; dashboard ya tiene F-1) | `payment` | RF-018 (conexo) | Alto |
| A5 | ✅ **Notas confirmadas** (profesional) — implementado Spec 0025 | `EvaluacionesProfesionalFacade.confirmarNotas()` / `notifyGradesConfirmed()` | Cada alumno del curso; severidad distinta si reprobó (promedio < 75) | `professional_session` | — | Medio-alto |
| A6 | ✅ **Anticipo registrado** — implementado Spec 0025 | `AnticiosFacade.registrarAnticipo()` (nombre real de la clase, typo pre-existente) | Instructor | `payment` | — | Medio |
| A7 | ✅ **Liquidación pagada** — implementado Spec 0025 | `LiquidacionesFacade.registrarPago()` | Instructor (vía `LiquidacionRow.userId`, sin query extra) | `payment` | — | Medio |
| A8 | **Documento subido a la ficha** | `DmsFacade.uploadStudentDocument()` | Alumno (confirmación de recepción) | `document` (nuevo) | RF-025 | Medio |
| A9 | **Reasignación de ciclo teórico** | `CiclosTeoricosFacade` (override de ciclo) | Alumno movido | `class_b` | — | Medio |
| A10 | **Link Zoom enviado** (espejo in-app del email masivo) | `CiclosTeoricosFacade` (junto a EF `send-zoom-email`) | Alumnos seleccionados del ciclo | `class_b` | RF-016 (refuerzo) | Medio |

## 3. Grupo B — Requieren tocar Edge Functions existentes (actor sin permiso RLS)

Las EF corren con service role → pueden insertar ya, sin cambios de RLS. Solo agregar el INSERT dentro de la función.

| # | Evento | Edge Function | Destinatario(s) | `reference_type` | RF | Valor |
|---|---|---|---|---|---|---|
| B1 | ✅ **Pre-inscripción web recibida** — implementado Spec 0024 | `public-enrollment` (`handleSubmitPreInscription`) | Secretarias de la sede + todos los admins | `preinscription` | **RF-022 explícito** | 🔥🔥 Máximo |
| B2 | ✅ **Pago online del alumno** — implementado Spec 0025 | `student-payment` (`handleConfirmPayment`) | Secretaria/admin de la sede + confirmación al propio alumno | `payment` | — | Alto |
| B3 | ✅ **Cuenta de alumno activada** — implementado Spec 0025 (solo en la primera invitación, no en reenvío) | `activate-student-account` | Alumno (bienvenida al portal) | — (`info`) | — | Bajo-medio (onboarding) |

## 4. Grupo C — Requieren decisión técnica (actor = instructor, bloqueado por R1)

Opciones por evento: (a) **trigger SQL** AFTER UPDATE/INSERT (recomendado: no confía en el cliente, cubre todos los roles), (b) ampliar RLS con `WITH CHECK` estricto, (c) nueva EF.

| # | Evento | Origen | Destinatario(s) | `reference_type` | Vía sugerida |
|---|---|---|---|---|---|
| C1 | ✅ **Clase completada** (práctica B) — implementado Spec 0026 | `InstructorClasesFacade.finishClass()` → trigger `notify_class_b_completed()` | Alumno ("Clase N/12 completada") | `class_b` | Trigger `AFTER UPDATE OF status ON class_b_sessions` (`20260710000000`) |
| C2 | ✅ **Respuesta / cierre de tarea** — implementado Spec 0026 | `TasksFacade.addReply()` / `updateStatus()` → triggers `notify_task_reply()`/`notify_task_completed()` | La contraparte de la tarea (emisor o receptor), nunca el actor | `task` | Trigger en `task_replies` (AFTER INSERT) y en `tasks.status` (AFTER UPDATE, excluye al actor vía `auth_user_id()`) — `20260710000100` |

## 5. Grupo D — Programados (sin actor humano; pg_cron o EF agendada) — horizonte posterior

| # | Evento | RF | Destinatario | Nota |
|---|---|---|---|---|
| D1 | ✅ **Aviso de 2ª cuota antes de la 7ª clase** — implementado Spec 0026 (resuelto como trigger reactivo al completarse la clase 6, no cron, reutilizando el mismo evento de C1) | **RF-018** | Alumno | trigger `notify_deposit_reminder()`, `20260710000000` — guard `payment_mode='partial' AND pending_balance>0` |
| D2 | ⏸️ **Envío automático de Zoom según calendario** — diferido 2026-07-10 (Spec 0027) | RF-016/017 | Alumnos del ciclo/curso | Hoy es manual (botón en Ciclos Teóricos). 2 interpretaciones sin decidir: (a) solo notificación in-app "tu clase es hoy" (simple) vs (b) automatizar el ENVÍO REAL del email vía EF `send-zoom-email` — requiere `pg_net`/`net.http_post` desde cron, sin precedente en el proyecto (todos los cron jobs existentes llaman funciones SQL puras). Retomar con decisión explícita del owner. |
| D3 | ✅ **Vencimiento docs de flota como notificación** — implementado (Spec 0027) | RF-021/024 | Admin + instructor del vehículo asignado | La alerta de dashboard ya existía (`DashboardAlertsFacade`, `alert_config.advance_days`); el valor nuevo es el instructor y el historial. Resuelto vía `notify_vehicle_document_expiry()` + `cron.schedule('notify-vehicle-document-expiry', '0 6 * * *', ...)`, mismo patrón que otros jobs del proyecto, sin `pg_net`. Verificado con datos reales vía RPC directo. |
| D4 | ❌ **Encuesta al terminar curso** — bloqueado, fuera de scope de Ola 4 | RF-023 | Alumno | Depende de que exista el módulo de encuestas (no existe hoy). Requiere spec propia para ese módulo antes de poder notificar nada. |

## 6. No recomendados (redundancia / ruido)

- Notificar al actor su propia acción (toast la cubre).
- Cierre de caja / cuadratura (alerta F-3 ya lo cubre; es el flujo diario de la misma persona).
- Espejar las 17 alertas del dashboard como notificaciones — duplicaría capas y llenaría la campana de estado que se auto-resuelve.
- Pagos individuales hacia el admin (KPI F-1 + alerta ya existen).

## 7. Pre-requisitos transversales (antes del primer productor nuevo)

1. ✅ **Ampliar tipos** (Spec 0024): `NotificationReferenceType` + `mapReferenceToNotificationType()` + íconos del panel para `enrollment`, `certificate`, `document`, `preinscription`. Incluye agrupación anti-ruido (`groupNotifications()`, panel con filas colapsadas 3+/día).
2. ✅ **Deep-links** (Spec 0024): `onNotifClicked()` (topbar) con ruta por `reference_type` × rol.
3. ✅ **Helper de destinatarios** (Spec 0024): `notifyRole(role, branchId, payload)` + `notifyUsers(recipientIds, payload)` en `NotificationsFacade`.
4. **Política anti-ruido**: ✅ decidida (spec 0024) — admin recibe TODAS las matrículas confirmadas (A1) y pre-inscripciones (B1); el ruido se mitiga con la agrupación del panel (pre-requisito 1), no restringiendo destinatarios.
5. Pendiente: decidir si admin/secretaria/alumno necesitan página "ver todas" (hoy solo instructor, R3) — fuera de scope de Ola 1.

## 8. Priorización sugerida (valor ÷ esfuerzo)

| Ola | Ítems | Estado | Justificación |
|---|---|---|---|
| **Ola 1** | Pre-requisitos 1-3 + B1 + A2 + A1 + A3 | ✅ **Implementada (Spec 0024, 2026-07-07)** | RF-022 es requerimiento explícito; A2/A3 dan valor inmediato al portal alumno/instructor; todo es insert cliente salvo B1 (EF ya existe) |
| **Ola 2** | A4, B2, A6, A7, A5, B3 | ✅ **Implementada (Spec 0025, 2026-07-10)** | Completa el circuito financiero (alumno e instructor) y el onboarding |
| **Ola 3** | Grupo C (triggers) + D1 (RF-018) | ✅ **Implementada (Spec 0026, 2026-07-10)** | Requerían migraciones SQL; D1 resuelto como trigger reactivo (no cron) tras descubrir el patrón `trg_enable_certificate_b` |
| **Ola 4** | D2-D4 + canales email/WhatsApp (R7) | ✅ **Implementada (Spec 0027, 2026-07-10) — alcance reducido a D3** | D3 implementado. D2 diferido (decisión pendiente entre 2 interpretaciones), D4 bloqueado (sin módulo de encuestas), WhatsApp fuera (decisión de infra/costo aparte). Canal email ya existe (SMTP), no se formaliza acá. |
