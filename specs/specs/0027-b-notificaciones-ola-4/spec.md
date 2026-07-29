# Spec 0027-b — Notificaciones Ola 4 (vencimiento de documentos de flota)

> **Status:** done
> **Created:** 2026-07-10
> **Owner:** Akxlarre
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `indices/NOTIFICATIONS-MAP.md` (mapa de productores, Spec 0024), sección "Priorización acordada" — Ola 4. Grupo D del mapa (D3).

**Persona afectada:** Admin, Secretaria, Instructor (asignado al vehículo).

**Problema que resuelve:**
Hoy el vencimiento de documentos de flota (SOAP, Revisión Técnica, Permiso de Circulación, Seguro) solo se ve como una alerta viva en el dashboard de admin/secretaria (`DashboardAlertsFacade`, calculada en cada carga contra `vehicle_documents.expiry_date` + `alert_config.advance_days`). El **instructor asignado al vehículo nunca se entera** — ni siquiera tiene ese dashboard — y no queda ningún registro histórico de que se avisó. Esta spec agrega la notificación persistente in-app para ambos casos ("por vencer" y "ya vencido"), sin tocar ni duplicar la alerta de dashboard existente.

**Hipótesis de valor:**
El instructor puede reportar antes un vehículo con documentación por vencer (o dejar de usarlo si ya venció), reduciendo el riesgo de que circule con documentos vencidos.

---

## 2. User Stories

- **US1**: Como instructor, quiero recibir una notificación cuando un documento del vehículo que tengo asignado está por vencer, para poder avisar a tiempo.
- **US2**: Como instructor, quiero recibir una notificación cuando un documento del vehículo que tengo asignado ya venció, para dejar de usarlo si corresponde.
- **US3**: Como admin, quiero que estas notificaciones también queden en mi campana (no solo en el dashboard), para tener un historial de cuándo se avisó de cada vencimiento.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 (Documento entra en ventana "por vencer")**: Given un `vehicle_documents` cuyo `expiry_date` cae exactamente `advance_days` (de `alert_config`, tipo `document_expiry`) días a partir de hoy, When corre el chequeo diario, Then el instructor con asignación activa (`vehicle_assignments.end_date IS NULL`) sobre ese vehículo Y todos los admins reciben una notificación tipo `document_expiry`.
- **AC2 (Documento vence)**: Given un `vehicle_documents` cuyo `expiry_date` es exactamente hoy, When corre el chequeo diario, Then el instructor asignado Y todos los admins reciben una notificación tipo `document_expiry` con mensaje distinto ("venció hoy", más urgente que el aviso previo).
- **AC3 (No duplicado)**: Given que ya se notificó el aviso de "por vencer" o "vencido" de un documento en su día correspondiente, When el chequeo diario vuelve a correr al día siguiente, Then NO se genera un segundo aviso para el mismo documento y mismo motivo (el chequeo compara `expiry_date` contra la fecha exacta de hoy ± `advance_days`, no un rango — cada documento dispara como máximo 1 vez por motivo).
- **AC4 (Vehículo sin instructor asignado)**: Given un vehículo sin asignación activa, When su documento entra en ventana de aviso o vence, Then igual notifica a los admins (nunca falla por falta de instructor).
- **AC5 (Reutiliza el umbral configurado)**: Given que `alert_config.advance_days` para `document_expiry` cambia (hoy 30 por defecto), When corre el chequeo diario, Then usa ese valor configurado, no un número fijo hardcodeado — mismo umbral que ya usa `DashboardAlertsFacade`.

### Edge cases obligatorios

- **AC-E1**: Given un documento que ya venció hace tiempo (antes de que existiera esta spec), When corre el chequeo por primera vez tras el deploy, Then NO genera una notificación retroactiva (el chequeo es por fecha EXACTA de hoy, no "vencidos en el pasado") — evita una oleada de notificaciones viejas al activar la spec.
- **AC-E2**: Given un vehículo con más de un documento venciendo el mismo día, When corre el chequeo, Then genera una notificación por documento (no una sola agrupada) — el panel ya agrupa visualmente notificaciones del mismo tipo/día (Ola 1).
- **AC-E3**: Given un error al notificar (ej. destinatario inválido), When ocurre dentro del chequeo diario, Then no debe abortar el procesamiento del resto de los documentos de esa corrida (cada documento se procesa de forma aislada).

---

## 4. Out of scope

- ❌ **D2 (Zoom automático)** — investigado pero diferido. Tiene 2 interpretaciones con complejidad muy distinta: (a) solo notificación in-app "tu clase es hoy" (simple, sin infra nueva) vs (b) automatizar el ENVÍO REAL del email vía la EF `send-zoom-email` existente, que requeriría `pg_net`/`net.http_post` desde un cron — patrón sin precedente en este proyecto (todos los cron jobs existentes llaman funciones SQL puras, ninguno invoca una Edge Function por HTTP). Queda documentado acá para cuando se retome, con la decisión pendiente de cuál de las 2 interpretaciones implementar.
- ❌ **D4 (Encuesta al terminar curso)** — bloqueado: no existe módulo de encuestas en el proyecto. Requiere spec propia para ese módulo antes de poder notificar nada.
- ❌ **Canal WhatsApp** — decisión de infraestructura/costo aparte (proveedor de WhatsApp Business API), no se toma dentro de esta spec.
- ❌ **Formalizar un canal de email genérico** — el canal SMTP ya existe (`send-zoom-email`, `activate-student-account`) pero esta spec no lo extiende ni lo generaliza; solo trabaja con notificaciones in-app.
- ❌ **Modificar la alerta de dashboard existente** (`DashboardAlertsFacade`) — sigue funcionando igual, esta spec solo agrega el canal de notificación persistente en paralelo.

---

## 5. Dependencias

### Specs previas
- Specs 0024, 0025, 0026 (Olas 1-3) — todas `done`. Reutiliza `notifications`, tipo `document_expiry` (ya existe desde Ola 1, mapea a severidad `warning`).

### Capacidades del proyecto que se asumen existentes
- `vehicle_documents.expiry_date`, `alert_config.advance_days` (tipo `document_expiry`) — ya usados por `DashboardAlertsFacade`.
- `vehicle_assignments` (`vehicle_id`, `instructor_id`, `end_date IS NULL` = asignación activa) → `instructors.user_id`.
- pg_cron ya habilitado y en uso en el proyecto (`auto_transition_promotion_status()`, `cleanup_expired_drafts()`, etc.) — mismo mecanismo, función SQL pura invocada por horario, sin necesitar `pg_net`.

### Capacidades nuevas requeridas
- 1 función SQL nueva (`SECURITY DEFINER`) + 1 registro de `cron.schedule(...)` — mismo patrón que las funciones cron ya existentes en el proyecto.
- Nada de Angular, nada de Edge Functions nuevas.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas: ninguna.
- RLS: sin cambios — la función es `SECURITY DEFINER`, bypasea el RLS de `notifications` igual que las funciones de Ola 3.
- Modelos UI/DTO: ninguno modificado — `document_expiry` ya existe en `NotificationReferenceType` desde Ola 1.

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): ninguna nueva — campana/panel ya existente en los 4 portales (el instructor YA ve su propia campana, solo faltaba que le llegara algo de tipo `document_expiry`).
- Flujo: cron diario → función SQL → INSERT en `notifications` (admin + instructor si aplica) → Realtime → campana.

---

## 8. Métricas de éxito post-launch

- Reducción de vehículos circulando con documentos vencidos sin que el instructor lo supiera (cualitativo, sin instrumentación hoy).

---

## 9. Notas / decisiones abiertas

- [x] ✅ Decidido 2026-07-10: alcance de esta spec = solo D3. D2 queda documentado como diferido (ver Out of scope) para retomar con una decisión explícita entre sus 2 interpretaciones. D4 y WhatsApp quedan fuera, bloqueados/pendientes de otra decisión.
- [x] ✅ Decidido: el mensaje incluye `vehicle_documents.type` (SOAP/Rev. Técnica/etc.) — dato ya disponible en el chequeo, sin costo adicional, mejora la utilidad del mensaje.
- [x] ✅ Decidido: mismo horario `0 6 * * *` que el resto de los cron jobs del proyecto (`auto_transition_promotion_status`, `auto_transition_theory_cycle_status`) — consistencia, sin necesidad de un horario ad-hoc.

---

## Changelog

- 2026-07-10 — draft inicial por Akxlarre, basado en `indices/NOTIFICATIONS-MAP.md` (priorización Ola 4, alcance reducido a D3 tras discusión de scope — D2/D4/WhatsApp diferidos).
