# Spec 0024-b — Notificaciones Ola 1: infraestructura de tipos + primeros productores (RF-022)

> **Status:** approved (2026-07-06)
> **Created:** 2026-07-06
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** `indices/NOTIFICATIONS-MAP.md` (relevamiento 2026-07-06) + RF-022 de `docs/primerosrequerimientos.md` (Módulo 2: Notificaciones y Comunicación).

**Persona afectada:** Secretaria y Admin (pre-inscripciones/matrículas), Alumno e Instructor (reprogramaciones, certificados).

**Problema que resuelve:**
La Capa 2 de notificaciones (campana + Realtime + historial) está completa pero solo la alimenta la asignación de tareas. Una pre-inscripción web solo se descubre entrando al dashboard; una clase reprogramada no le avisa a nadie; el alumno no se entera cuando su certificado está listo. Los portales de alumno e instructor no reciben ninguna señal de eventos que los afectan directamente.

**Hipótesis de valor:**
Con 4 productores conectados, la campana pasa de adorno a canal real: la secretaria contacta pre-inscritos al instante (RF-022) y el alumno/instructor dejan de descubrir cambios de agenda por accidente.

---

## 2. User Stories

- **US1**: Como **secretaria**, quiero recibir una notificación al instante cuando entra una pre-inscripción desde la web pública, para contactar al interesado sin depender de revisar el dashboard.
- **US2**: Como **admin**, quiero enterarme de nuevas pre-inscripciones y matrículas confirmadas en mis sedes, para tener visibilidad comercial sin estar presente.
- **US3**: Como **alumno**, quiero recibir una notificación cuando mi clase práctica se reprograma, cuando mi matrícula queda confirmada y cuando mi certificado está disponible, para no depender de que me llamen.
- **US4**: Como **instructor**, quiero recibir una notificación cuando una clase de mi agenda es reprogramada, para no presentarme a un bloque que ya no existe.
- **US5**: Como **usuario de cualquier rol**, quiero que al hacer click en una notificación me lleve a la pantalla del recurso referenciado, para actuar sin buscar manualmente.

---

## 3. Acceptance Criteria (Gherkin)

### Infraestructura transversal

- **AC1 — Tipos nuevos**: Given una notificación con `reference_type` ∈ {`enrollment`, `certificate`, `preinscription`, `document`}, When se mapea a UI (`mapNotificationDtoToUi`), Then `mapReferenceToNotificationType` retorna un `NotificationType` definido para ese valor (no el default genérico) y el panel la renderiza con su ícono/color propio. Tests unitarios en `notification.utils.spec.ts` cubren los 4 valores nuevos + el fallback.
- **AC2 — Helper `notifyRole`**: Given usuarios activos con rol R en la sede S, When un facade llama `notifyRole(R, S, payload)`, Then se inserta exactamente una notificación por cada usuario de ese rol/sede y ninguna para usuarios de otros roles u otras sedes. Para `admin` (branch NULL) el filtro de sede no aplica. Tests en `notifications.facade.spec.ts`.
- **AC3 — Deep-links**: Given una notificación con `reference_type` con ruta definida para el rol del usuario, When hace click en ella, Then navega a la pantalla correspondiente y la notificación queda marcada como leída. Given un `reference_type` sin ruta definida, Then solo cierra el panel sin error (comportamiento actual).
- **AC8 — Mitigación de ruido (agrupación en panel)**: Given existen 3 o más notificaciones no leídas del mismo `reference_type` generadas el mismo día, When el usuario abre el panel, Then se muestran colapsadas en una sola fila agrupada con contador (ej. "4 matrículas confirmadas") expandible a las individuales; el badge de la campana sigue contando las individuales. Marcar como leída la fila agrupada marca todas las del grupo.

### Productores

- **AC4 — Pre-inscripción web (RF-022)**: Given un visitante anónimo completa la pre-inscripción pública, When la EF `public-enrollment` la persiste con éxito, Then cada secretaria de la sede seleccionada y cada admin reciben una notificación (`reference_type='preinscription'`, `reference_id` = id de la pre-inscripción) que les llega vía Realtime sin recargar la página.
- **AC5 — Reprogramación**: Given un admin o secretaria reprograma una clase B desde la Ficha del Alumno, When la mutación tiene éxito, Then el alumno y el instructor de la clase reciben una notificación con la fecha/hora nueva (`reference_type='class_b'`). El actor de la reprogramación no recibe notificación.
- **AC6 — Matrícula confirmada**: Given una secretaria confirma una matrícula (paso 6 del wizard), When la confirmación tiene éxito, Then el alumno recibe una notificación de confirmación y los admins reciben el aviso de nueva matrícula (`reference_type='enrollment'`). Given quien confirma es un admin, Then ese admin no se auto-notifica.
- **AC7 — Certificado listo**: Given se genera o envía un certificado (Clase B o Profesional) para un alumno, When la operación tiene éxito, Then el alumno recibe una notificación (`reference_type='certificate'`).

### Edge cases obligatorios

- **AC-E1 — Fire-and-forget**: Given el INSERT de la notificación falla (RLS, red), When ocurre dentro de cualquier productor, Then el flujo principal (matrícula, reprogramación, certificado) se completa igual y el error solo se registra/avisa como warning (patrón `TasksFacade.createTask`).
- **AC-E2 — Alumno sin cuenta activada**: Given el alumno destinatario aún no activó su cuenta del portal, When se le genera una notificación, Then el INSERT no falla y la notificación aparece en su historial al primer login.
- **AC-E3 — Sede sin secretarias**: Given la sede de la pre-inscripción no tiene secretarias activas, When la EF notifica, Then notifica solo a los admins y la pre-inscripción se persiste sin error.
- **AC-E4 — Sin duplicados por reintento**: Given una matrícula draft que se retoma y re-guarda varias veces, When finalmente se confirma, Then la notificación de confirmación se emite una sola vez (solo en la transición a confirmada). Reprogramar dos veces sí genera dos notificaciones (cada evento es un aviso distinto).

---

## 4. Out of scope

- ❌ Olas 2-4 del mapa: pagos (A4/B2), anticipos/liquidaciones (A6/A7), notas confirmadas (A5), documento subido (A8), ciclos teóricos (A9/A10), activación de cuenta (B3), triggers para eventos de instructor (Grupo C), avisos programados RF-018/016/017/023 (Grupo D).
- ❌ Canales email/WhatsApp y `notification_templates` — solo canal `system` (in-app).
- ❌ Cambios a la RLS de `notifications` — Ola 1 no los necesita (actores admin/secretaria + EF con service role).
- ❌ Página "ver todas las notificaciones" para roles distintos de instructor.
- ❌ Preferencias de notificación por usuario (opt-out, silenciar).

---

## 5. Dependencias

### Specs previas
- Ninguna (el mapa `indices/NOTIFICATIONS-MAP.md` es el insumo, no una spec).

### Capacidades del proyecto que se asumen existentes
- `NotificationsFacade` completo (Realtime, unreadCount, panel, markAsRead) inicializado en `AppShellComponent` para los 4 portales.
- RLS `insert_notifications` para `admin` y `secretary` (migración `20260522000003`).
- EF `public-enrollment` operativa (service role).
- Facades productores: `EnrollmentFacade` (paso 6), `AdminAlumnoDetalleFacade.reprogramarClase()`, `CertificacionClaseBFacade` / `CertificacionProfesionalFacade`.
- Todo alumno matriculado tiene fila en `users` (el wizard hace upsert user+student) → siempre hay `recipient_id`.

### Capacidades nuevas requeridas
- Helper `notifyRole(role, branchId, payload)` en `NotificationsFacade` (resuelve dbIds por rol/sede + N inserts).
- INSERT de notificaciones dentro de la EF `public-enrollment`.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: **ninguna** — se usan `notifications` y `users` existentes. Solo valores nuevos (TEXT libre) en `reference_type`.
- Modelos UI: ampliar `NotificationReferenceType` en `core/models/ui/notification.model.ts` con `enrollment | certificate | preinscription | document`.
- RLS requerida: sin cambios.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): panel de notificaciones del topbar (íconos/colores por tipo nuevo + agrupación AC8), sin pantallas nuevas.
- Flujo principal: evento de negocio → INSERT en `notifications` → Realtime entrega al destinatario → toast + badge + panel (agrupado si hay 3+ del mismo tipo en el día) → click → deep-link a la pantalla del recurso según rol.
- Estados especiales: fallo del INSERT es silencioso para el flujo principal (AC-E1); destinatarios inexistentes no rompen nada (AC-E3).

---

## 8. Métricas de éxito post-launch

- Tiempo entre pre-inscripción web y primer contacto de la secretaria (hoy: hasta el próximo vistazo al dashboard).
- Reclamos por clases reprogramadas sin aviso → 0.

---

## 9. Notas / decisiones resueltas

- [x] **Instructor anterior en reprogramación:** SÍ — si cambia el instructor, se notifica a ambos (al anterior se le liberó el bloque). *(Resuelto 2026-07-06)*
- [x] **Política anti-ruido admin:** los admins reciben TODAS las matrículas confirmadas (el flujo diario no es tan grande); el ruido se mitiga en el componente con la agrupación del panel (AC8). *(Resuelto 2026-07-06, decisión del owner)*
- [x] **Mapeo severidad/color:** `enrollment`→success, `certificate`→success, `preinscription`→info, `document`→info. *(Aprobado 2026-07-06)*
- [x] **Deep-links exactos por tipo × rol:** la tabla completa se define en `plan.md` contra `indices/ROUTES.md`. *(Delegado al plan)*

---

## Changelog

- 2026-07-06 — draft inicial por Akxlarre (US/AC redactados por el agente desde `indices/NOTIFICATIONS-MAP.md`)
- 2026-07-06 — decisiones abiertas resueltas por el owner; agregado AC8 (agrupación anti-ruido en panel); status → approved
