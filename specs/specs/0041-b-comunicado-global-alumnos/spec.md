# Spec 0041-b — Comunicado global a alumnos (1:N, email + in-app)

> **Status:** done
> **Created:** 2026-09-09
> **Owner:** Benjamín
> **Priority:** P1 — no bloquea el despliegue, pero es el mayor ahorro de tiempo identificado para la secretaria

---

## 1. Contexto de negocio

**Origen:** Interrogatorio `/grill_me` sobre el sistema de comunicación (2026-09-08). Diagnóstico,
decisiones (D-1, D-2, D-3) y el corte conceptual que fundamenta esta spec están en
`indices/NOTIFICATIONS-MAP.md` §9. Desbloqueada legalmente por la spec `0040-b` (cerrada
2026-09-09).

**Persona afectada:** Secretaria (emisora, protagonista). Alumno (receptor). Admin (emisor
multi-sede y auditor).

**Problema que resuelve:**
Bajo "comunicación al alumno" conviven dos sistemas distintos que el mapa de notificaciones nunca
separó (§9.3): el **aviso derivado** (1:1, lo calcula el sistema — "tu clase es mañana a las 10")
y el **comunicado global** (1:N, lo redacta una persona — "mañana no hay clases por el feriado").
El segundo no se deriva de ningún dato, así que ninguna automatización lo cubre; hoy la secretaria
lo resuelve copiando y pegando a una lista de difusión de WhatsApp. Eso ocurre fuera del sistema:
no queda registro de qué se comunicó, a quién ni cuándo, y no hay forma de responder "¿se le avisó
del feriado a este alumno?".

**Hipótesis de valor:**
Un comunicado que hoy cuesta N copiar/pegar pasa a un solo envío con la lista resuelta por el
sistema, y deja registro auditable de qué se dijo y a quién.

---

## 2. User Stories

- **US1**: Como secretaria, quiero redactar un comunicado y enviarlo a un segmento de alumnos, para
  dejar de copiar y pegar mensajes en una lista de difusión de WhatsApp.
- **US2**: Como secretaria, quiero declarar si el comunicado es operativo o promocional y que el
  sistema respete solo el consentimiento de cada alumno, para no tener que revisar a mano quién
  aceptó recibir promociones.
- **US3**: Como secretaria o admin, quiero ver el historial de comunicados enviados con sus
  destinatarios, para poder responder qué se le comunicó a un alumno y cuándo.
- **US4**: Como alumno, quiero ver el comunicado en mi portal aunque no haya leído el correo, para
  no perderme un aviso de la escuela.
- **US5**: Como admin, quiero enviar a cualquier sede y que la secretaria solo pueda enviar a la
  suya, para que nadie comunique fuera de su ámbito.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given una secretaria en el módulo Comunicación, When abre el compositor de comunicados y
  aplica filtros de sede, tipo de curso y estado de matrícula, Then ve la lista de destinatarios
  resueltos con su nombre y email, y el conteo total.
- **AC2**: Given un comunicado en redacción, When intenta enviarlo sin haber declarado si es
  `operativo` o `promocional`, Then el envío se bloquea y se le exige elegir el tipo.
- **AC3**: Given un comunicado declarado `promocional`, When se resuelve la lista de destinatarios,
  Then solo incluye alumnos con un consentimiento `comunicaciones_promocionales` en estado otorgado
  (no revocado), y los excluidos se informan con su motivo.
- **AC4**: Given un comunicado declarado `operativo`, When se resuelve la lista de destinatarios,
  Then incluye a todos los alumnos del segmento sin filtrar por consentimiento (Art. 13 c — es
  necesario para la ejecución del contrato).
- **AC5**: Given una lista de destinatarios ya resuelta, When la secretaria destilda destinatarios
  puntuales, Then el envío alcanza solo a los que quedaron tildados y el conteo se actualiza.
- **AC6**: Given un comunicado con destinatarios válidos, When se confirma el envío, Then cada
  destinatario recibe un email vía SMTP **y** se le crea una notificación in-app visible en su
  portal.
- **AC7**: Given un comunicado ya enviado, When se consulta el historial, Then aparece con su
  asunto, cuerpo, tipo, quién lo envió, cuándo, y el detalle por destinatario (entregado / fallido).
- **AC8**: Given una secretaria de la sede A, When abre el compositor, Then los filtros solo pueden
  resolver alumnos de la sede A, y un intento de enviar a la sede B es rechazado por RLS (no solo
  ocultado en la UI).

### Edge cases obligatorios

- **AC-E1**: Given un segmento cuyos filtros no resuelven ningún destinatario, When la secretaria
  intenta enviar, Then el envío se bloquea con un mensaje explícito de lista vacía (no se registra
  un comunicado con 0 destinatarios).
- **AC-E2**: Given un alumno del segmento sin email registrado, When se envía el comunicado, Then se
  lo reporta como no alcanzable por email, el resto del envío continúa, y **sí** recibe la
  notificación in-app.
- **AC-E3**: Given un fallo de SMTP para algunos destinatarios, When termina el envío, Then el
  comunicado queda registrado con el detalle de cuáles fallaron y cuáles no, y las notificaciones
  in-app de los que fallaron por email igual quedan creadas.
- **AC-E4**: Given un alumno que revoca su consentimiento promocional después de que la secretaria
  previsualizó la lista pero antes de confirmar el envío, When se confirma el envío de un comunicado
  `promocional`, Then ese alumno queda excluido — el consentimiento se evalúa en el momento del
  envío, no en el del preview.

---

## 4. Out of scope

- ❌ **CRUD de plantillas guardadas.** `notification_templates` sigue vacía. El v1 es texto libre
  sobre el wrapper HTML de marca. Editor, campos variables (`{{nombre}}`) y gestión de plantillas
  → spec futura.
- ❌ **Comunicados a instructores o secretarias.** Solo alumnos. El canal interno sigue siendo el
  módulo `tasks`.
- ❌ **Bidireccionalidad.** El alumno no puede responder el comunicado (D-1: hacia el alumno el
  sistema avisa, no conversa).
- ❌ **WhatsApp como canal.** Decidido en D-2: email por SMTP propio, uniforme para toda la
  población.
- ❌ **Programar envíos a futuro** (scheduling) y **envíos recurrentes**.
- ❌ **Adjuntos** en el comunicado.
- ❌ **Avisos derivados automáticos por evento** (§9.3, columna izquierda). Ya están mapeados en
  §2-§5 del mapa de notificaciones y son un sistema distinto.
- ❌ **Segmentación por ciclo teórico o grupo específico.** El v1 segmenta por sede, tipo de curso
  y estado de matrícula; cortes más finos se resuelven destildando a mano (AC5).

---

## 5. Dependencias

### Specs previas
- `0040-b-consentimiento-comunicaciones-alumno` (✅ done) — aporta los `consent_type`
  `comunicaciones_operativas` / `comunicaciones_promocionales` sobre los que se apoya AC3/AC4.

### Capacidades del proyecto que se asumen existentes
- Edge Function `send-zoom-email` como precedente de envío SMTP: ya recibe
  `recipients: {name,email}[]` arbitrarios y usa los secrets `SMTP_HOST/PORT/USER/PASS/FROM`.
- Tabla `notifications` con policy `insert_notifications` que ya permite a `admin` y `secretary`
  insertar — la notificación in-app no necesita Edge Function ni trigger.
- `NotificationsFacade` (historial + Realtime en el portal del alumno).
- `BranchFacade` + `resolveBranchScope` para el scope de sede de la secretaria.
- Tabla `consents` con `consent_type` y `revoked_at`.
- `enrollments` (`branch_id`, `license_group`, `status`) → `students` → `users` (email) como fuente
  de destinatarios.

### Capacidades nuevas requeridas
- Tabla `announcements` (el comunicado) y `announcement_recipients` (el detalle por destinatario).
- Edge Function `send-announcement` — generaliza el patrón de `send-zoom-email` con asunto y cuerpo
  arbitrarios sobre el wrapper HTML de marca.
- Facade nueva (`AnnouncementsFacade`) para compositor e historial.

---

## 6. Datos y modelo (preliminar)

**Tablas nuevas:**

- `announcements` — el comunicado enviado. Campos previstos: `id`, `subject`, `body`, `kind`
  (`operativo` | `promocional`), `branch_id` (FK, la sede del emisor; `NULL` = admin multi-sede),
  `sent_by` (FK `users.id`), `sent_at`, `recipients_total`, `email_ok_count`, `email_failed_count`,
  `created_at`. Append-only en espíritu: un comunicado enviado no se edita ni se borra (es el
  registro de qué se dijo).
- `announcement_recipients` — una fila por destinatario. Campos previstos: `id`, `announcement_id`
  (FK), `user_id` (FK), `email` (snapshot al momento del envío), `email_sent_ok`, `send_error`,
  `notification_id` (FK a la notificación in-app creada).

**RLS requerida:**
- `announcements` / `announcement_recipients`: SELECT e INSERT para `admin` (todas las sedes) y
  `secretary` (acotada a su `branch_id`, mismo patrón que `select_enrollments`). Sin DELETE para
  ningún rol. El alumno **no** lee estas tablas — ve el comunicado a través de `notifications`.

**Modelos UI nuevos:** `Announcement`, `AnnouncementDraft`, `AnnouncementRecipient`,
`RecipientSegmentFilters`.

**Nota sobre el filtro de consentimiento:** la resolución de destinatarios de un comunicado
`promocional` debe evaluarse en el servidor al momento del envío (AC-E4), no confiar en la lista
que la UI previsualizó.

---

## 7. UX y flujos (preliminar)

**Pantalla afectada:** el módulo **Comunicación** ya existente (`/app/admin/tareas`,
`/app/secretaria/observaciones`), como una pestaña nueva "Comunicados" junto a la lista de tareas
actual. No se crea un ítem de menú nuevo — mismo criterio que corrigió `fix-167-b`: primero buscar
el lugar que ya existe.

**Flujo principal (happy path):**
1. La secretaria entra a Comunicación → pestaña "Comunicados" → "Nuevo comunicado".
2. Declara el tipo (operativo / promocional) — obligatorio, sin default (AC2).
3. Aplica filtros de segmento (sede, tipo de curso, estado de matrícula) y ve la lista resuelta con
   el conteo; si es promocional, ve también cuántos quedaron excluidos y por qué (AC3).
4. Destilda destinatarios puntuales si hace falta (AC5).
5. Redacta asunto y cuerpo, previsualiza el email con el wrapper de marca.
6. Confirma → se envían los emails y se crean las notificaciones in-app (AC6).
7. Ve el resultado: cuántos entregados, cuántos fallidos, y el comunicado queda en el historial (AC7).

**Estados especiales:**
- *Loading*: resolución de la lista de destinatarios (puede ser lenta con muchos alumnos) y envío en
  curso, con progreso — el envío es la operación más larga de la app.
- *Vacío*: segmento sin destinatarios (AC-E1) e historial sin comunicados.
- *Error*: fallo total de SMTP vs. fallo parcial (AC-E3) deben distinguirse en el mensaje.

---

## 8. Métricas de éxito post-launch

- Comunicados enviados por semana (si es 0 después de un mes, la secretaria volvió a WhatsApp).
- Ratio de destinatarios alcanzados por email vs. solo in-app (mide la calidad de los emails
  registrados).
- Tasa de fallo de SMTP por envío — es el indicador temprano del riesgo de reputación de dominio
  (§9.4).
- Cualitativo: preguntarle a la secretaria si dejó de usar la lista de difusión.

---

## 9. Notas / decisiones abiertas

- [ ] **Throttling / tamaño de lote del envío.** §9.4 marca la reputación del dominio como el riesgo
      técnico principal: con SMTP propio, quemarla arrastra también a los correos normales
      (contratos, certificados, facturas) a spam. Hay que fijar un límite de envíos por lote y una
      pausa entre lotes antes de implementar. Propuesta a validar: lotes de 50 con pausa, y un tope
      duro de destinatarios por comunicado.
- [ ] **¿El alumno ve un historial de comunicados recibidos en su portal, o solo la notificación
      in-app suelta?** El v1 asume lo segundo (reusa `notifications` sin pantalla nueva). Si se
      quiere una sección "Comunicados de la escuela" en el portal del alumno, es alcance extra.
- [ ] **¿El cuerpo del comunicado admite formato (negrita, enlaces) o es texto plano?** Texto plano
      es más simple y más seguro (evita inyección de HTML); formato mínimo es más útil. Propuesta a
      validar: texto plano con saltos de línea respetados en el v1.

---

## Changelog

- 2026-09-09 — draft inicial por Benjamín. Alcance de las 4 decisiones de producto tomadas al
  abrir la spec: (1) operativo + promocional con gating de consentimiento, sin CRUD de plantillas;
  (2) segmentación por filtros con ajuste manual; (3) admin + secretaria acotada a su sede;
  (4) canal email + notificación in-app.
