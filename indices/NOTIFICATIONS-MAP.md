# Mapa de Productores de Notificaciones (Capa 2)

> Relevamiento funcional: qué flujos de negocio deberían emitir notificaciones persistentes,
> quién las recibe, por qué vía se insertan y en qué orden conviene implementarlas.
> Fecha: 2026-07-06. **Actualizado 2026-07-07 (Spec 0024 — Ola 1 implementada):** además de `TasksFacade`,
> ahora también producen `EnrollmentFacade` (A1), `AdminAlumnoDetalleFacade` (A2), `CertificacionClaseBFacade`/
> `CertificacionProfesionalFacade` (A3) y la EF `public-enrollment` (B1). Ver §8 para el detalle.

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
| A4 | **Pago presencial registrado** | `EnrollmentPaymentFacade.recordPayment()` · `PagosFacade` (abonos) · `CursosSingularesFacade.marcarEnrollmentPagado()` · `ServiciosEspecialesFacade.registrarCobro()` | Alumno (comprobante in-app). ⚠️ Al admin NO (ruido; dashboard ya tiene F-1) | `payment` | RF-018 (conexo) | Alto |
| A5 | **Notas confirmadas** (profesional) | `EvaluacionesProfesionalFacade.confirmarNotas()` | Cada alumno del curso; severidad distinta si reprobó (module < 75) | `professional_session` | — | Medio-alto |
| A6 | **Anticipo registrado** | `AnticiposFacade` | Instructor | `payment` | — | Medio |
| A7 | **Liquidación pagada** | `LiquidacionesFacade` (registro de pago) | Instructor | `payment` | — | Medio |
| A8 | **Documento subido a la ficha** | `DmsFacade.uploadStudentDocument()` | Alumno (confirmación de recepción) | `document` (nuevo) | RF-025 | Medio |
| A9 | **Reasignación de ciclo teórico** | `CiclosTeoricosFacade` (override de ciclo) | Alumno movido | `class_b` | — | Medio |
| A10 | **Link Zoom enviado** (espejo in-app del email masivo) | `CiclosTeoricosFacade` (junto a EF `send-zoom-email`) | Alumnos seleccionados del ciclo | `class_b` | RF-016 (refuerzo) | Medio |

## 3. Grupo B — Requieren tocar Edge Functions existentes (actor sin permiso RLS)

Las EF corren con service role → pueden insertar ya, sin cambios de RLS. Solo agregar el INSERT dentro de la función.

| # | Evento | Edge Function | Destinatario(s) | `reference_type` | RF | Valor |
|---|---|---|---|---|---|---|
| B1 | ✅ **Pre-inscripción web recibida** — implementado Spec 0024 | `public-enrollment` (`handleSubmitPreInscription`) | Secretarias de la sede + todos los admins | `preinscription` | **RF-022 explícito** | 🔥🔥 Máximo |
| B2 | **Pago online del alumno** | `student-payment` | Secretaria/admin de la sede + confirmación al propio alumno | `payment` | — | Alto |
| B3 | **Cuenta de alumno activada** | `activate-student-account` | Alumno (bienvenida al portal) | — (`info`) | — | Bajo-medio (onboarding) |

## 4. Grupo C — Requieren decisión técnica (actor = instructor, bloqueado por R1)

Opciones por evento: (a) **trigger SQL** AFTER UPDATE/INSERT (recomendado: no confía en el cliente, cubre todos los roles), (b) ampliar RLS con `WITH CHECK` estricto, (c) nueva EF.

| # | Evento | Origen | Destinatario(s) | `reference_type` | Vía sugerida |
|---|---|---|---|---|---|
| C1 | **Clase completada** (práctica B) | `InstructorClasesFacade.finishClass()` | Alumno ("clase 5/12 completada") | `class_b` | Trigger en `class_b_sessions` cuando `end_time` pasa de NULL a valor |
| C2 | **Respuesta / cierre de tarea** | `TasksFacade.addReply()` / `updateStatus()` | La contraparte de la tarea (emisor o receptor) | `task` | Trigger en `task_replies` y en `tasks.status` — nota: hoy este gap existe **incluso para admin/secretaria** (el módulo de tareas solo notifica la creación) |

## 5. Grupo D — Programados (sin actor humano; pg_cron o EF agendada) — horizonte posterior

| # | Evento | RF | Destinatario | Nota |
|---|---|---|---|---|
| D1 | Aviso de 2ª cuota antes de la 7ª clase | **RF-018** | Alumno | La alerta B-1 ya avisa al staff; lo que falta es el aviso al **alumno** |
| D2 | Envío automático de Zoom según calendario | RF-016/017 | Alumnos del ciclo/curso | Hoy es manual (botón en Ciclos Teóricos) |
| D3 | Vencimiento docs de flota como notificación | RF-021/024 | Admin + instructor del vehículo asignado | La alerta de dashboard ya existe; el valor nuevo es el instructor y el historial |
| D4 | Encuesta al terminar curso | RF-023 | Alumno | Depende de que exista el módulo de encuestas |

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
| **Ola 2** | A4, B2, A6, A7, A5, B3 | Pendiente | Completa el circuito financiero (alumno e instructor) y el onboarding |
| **Ola 3** | Grupo C (triggers) + D1 (RF-018) | Pendiente | Requieren migraciones SQL; D1 es el RF pendiente de mayor valor para el alumno |
| **Ola 4** | D2-D4 + canales email/WhatsApp (R7) | Pendiente | Automatización programada y plantillas |
