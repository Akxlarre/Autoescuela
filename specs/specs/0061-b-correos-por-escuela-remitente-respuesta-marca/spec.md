# Spec 0061-b — Correos por escuela: remitente, respuesta y marca

> **Status:** approved (owner, 2026-11-12)
> **Created:** 2026-11-12
> **Owner:** Akxlarre
> **Priority:** P1
> **refs:** `docs/DEPLOY.md` §Cambiar de dominio · `fix-181-b` (recuperar contraseña de punta a
> punta) · `0040-b` (consentimiento de comunicaciones) · `0045-b` (archivos en comunicados,
> backlog) · `indices/NOTIFICATIONS-MAP.md` §9.4

---

## 1. Contexto de negocio

**Origen:** análisis con el owner del 2026-11-11 y 2026-11-12, después de que
`app.gestordeautoescuelas.cl` quedara como dominio de la app (hotfix-173-b, 2026-11-06).

**Persona afectada:** alumno (y apoderado) que recibe los correos; secretaria y admin de cada
escuela, que hoy no reciben las respuestas.

**Problema que resuelve:**
Dos escuelas (Autoescuela Chillán y Conductores Chillán) comparten la plataforma y **son razones
sociales distintas** (owner, 2026-11-12): cada una es un responsable de datos separado, como ya
reconocen `privacy-policy.model.ts` y `consents.branch_id`. Pero todo correo sale con **un solo
remitente global** (`SMTP_FROM`, el mismo en las 8 funciones que envían por SMTP), la escuela solo
se distingue dentro del cuerpo, no hay dirección de respuesta y el pie dice "Por favor no
responder": un alumno que responde un contrato o un enlace de Zoom no le llega a nadie.

Además, los comunicados mezclan las dos escuelas:

- Toman la marca y el correo de baja de la escuela donde se registró el **destinatario**, no de la
  escuela que envía.
- El filtro de consentimiento promocional (`filterByPromotionalConsent`) mira el último
  consentimiento del alumno **sin importar ante qué escuela lo dio**. Un alumno que aceptó
  promociones de una escuela y las rechazó en la otra recibiría promociones de las dos.
- En su portal, el alumno ve y puede revocar **un solo** consentimiento promocional (el primero que
  encuentra), aunque tenga uno por escuela.

Todavía no se ha enviado ningún comunicado, así que nada de esto ha afectado a nadie.

**Lo verificado (DNS público, cPanel y código, solo lectura):**

- `gestordeautoescuelas.cl` resuelve, su correo lo maneja el mismo hosting y **ya tiene SPF, DKIM
  y DMARC** (2026-11-12). El SPF incluye `relay.mailchannels.net`: el hosting envía a través de
  MailChannels. El DMARC está en `p=none` (solo observa, no protege). No tiene ninguna casilla
  creada todavía.
- `autoescuelachillan.cl` tiene SPF y DKIM, sin DMARC.
- `conductoreschillan.cl` (donde existe la cuenta `no-reply@`) **no existe en DNS**: no sirve como
  remitente. `conductorchillan.cl` tiene los nameservers en Vercel y no tiene correo.
- El correo de contacto de cada escuela vive en **dos lugares**: `branches.email` (lo usan los
  correos; **no se puede editar desde la app**) y `website_config.config.contact.email` (lo edita
  admin o secretaria en Configuración web; lo usa la web pública). Hoy son direcciones de Gmail,
  que sirven para recibir respuestas pero no como remitente.
- Zoom no está integrado: no hay cuenta de Zoom en la app. La secretaria pega el enlace de cada
  clase (`saveZoomLink` en ciclos teóricos; `zoom_link` en sesiones profesionales), así que cada
  escuela ya usa su propia cuenta sin que la app lo sepa.
- 2 de 216 alumnos con matrícula tienen matrículas en las dos escuelas. La cuenta es una por
  correo electrónico.

**Decisión (owner, 2026-11-11):** los correos salen desde el dominio de la plataforma, con una
dirección y un nombre visible por escuela, y las respuestas llegan al correo de contacto de cada
escuela. Razones: coincide con el dominio de los enlaces (un correo de "Conductores Chillán" con
enlaces a otro dominio parece phishing), se autentica un solo dominio y sirve igual para una
tercera escuela. Un dominio propio por escuela queda como opción futura (ver Out of scope).

**Hipótesis de valor:** el alumno reconoce quién le escribe, sus respuestas llegan a la escuela
correcta, cada escuela le escribe solo con el consentimiento que le dieron a ella, y los correos no
caen en spam.

---

## 2. User Stories

- **US1**: Como alumno, quiero que el correo diga en el remitente y en el asunto de qué escuela
  viene, para reconocerlo y no confundirlo con spam.
- **US2**: Como alumno, quiero poder responder un correo de mi escuela y que la respuesta le llegue
  a esa escuela, para resolver dudas sin buscar otro contacto.
- **US3**: Como alumno matriculado en las dos escuelas, quiero que cada correo use la escuela de la
  matrícula, clase o comunicado que lo originó, y que cada escuela respete lo que le autoricé a
  ella, para no recibir de una escuela lo que solo le permití a la otra.
- **US4**: Como secretaria, quiero que las respuestas de los alumnos lleguen al correo de contacto
  de mi escuela, para atenderlas.
- **US5**: Como admin, quiero configurar desde la app el remitente y el correo de respuesta de cada
  escuela, y probarlos, para no depender de un desarrollador cuando cambia un dato o llega una
  escuela nueva.

---

## 3. Acceptance Criteria (Gherkin)

> "Escuela del correo" = la regla de AC4. "Dirección de envío de la escuela" = la configurada para
> esa escuela en AC11.

- **AC1 — Remitente por escuela**: Given una matrícula de Conductores Chillán, When se envía su
  contrato, su certificado o un enlace de Zoom de su ciclo, Then el correo llega con remitente
  visible "Conductores Chillán" y la dirección de envío de esa escuela. Lo mismo para Autoescuela
  Chillán con la suya.
- **AC2 — Las respuestas llegan a la escuela**: Given un correo de AC1, When el alumno pulsa
  "Responder", Then el destinatario propuesto es el correo de respuesta de esa escuela, no la
  dirección de envío.
- **AC3 — Asunto y pie con la escuela**: Given cualquier correo enviado por la app a nombre de una
  escuela, Then el asunto incluye el nombre de la escuela, el pie dice "Enviado por [escuela]
  mediante Gestor de Autoescuelas" con el teléfono y el correo de respuesta de la escuela, y ya no
  dice "Por favor no responder".
- **AC4 — Regla de marca**: la escuela del correo es:
  - contrato y certificado → la escuela de la matrícula (`enrollments.branch_id`);
  - enlace de Zoom → la escuela del ciclo;
  - comunicado de una escuela → **la escuela que lo envía** (`announcements.branch_id`), incluidos
    el nombre, el pie y el correo para darse de baja (comunicado de todas las escuelas: AC-E5);
  - invitación de secretaria o instructor → la escuela de esa persona;
  - activación de cuenta del alumno → la escuela de la matrícula que la originó.
- **AC5 — Comunicado a un alumno de las dos escuelas**: Given un alumno registrado en Conductores
  Chillán y con matrícula en Autoescuela Chillán, When Autoescuela Chillán le envía un comunicado,
  Then llega con remitente, marca, pie y correo de baja de Autoescuela Chillán.
- **AC6 — Primera invitación del alumno también por escuela**: Given un alumno nuevo, When la
  secretaria activa su cuenta por primera vez, Then el correo de activación sale con el remitente
  de la escuela (AC1), no con el remitente ni la plantilla de Supabase Auth.
- **AC7 — Correos de cuenta neutros**: Given cualquier usuario, When pide recuperar su contraseña,
  Then el correo llega desde la dirección neutra de la plataforma con remitente visible "Gestor de
  Autoescuelas", un texto que no nombra a una escuela, y el enlace lleva a
  `https://app.gestordeautoescuelas.cl/recuperar-contrasena`.
- **AC8 — Línea que explica el dominio**: Given un correo con un enlace a la app, Then incluye una
  línea del tipo "El portal de alumnos de [escuela] funciona en app.gestordeautoescuelas.cl".
- **AC9 — Autenticación del dominio**: Given un correo de AC1 y uno de AC7 recibidos en una cuenta
  de Gmail, When se miran sus encabezados originales, Then `Authentication-Results` muestra
  `spf=pass`, `dkim=pass` y `dmarc=pass` para `gestordeautoescuelas.cl`.
- **AC10 — Consentimiento promocional por escuela**:
  - Given un alumno que aceptó promociones ante Autoescuela Chillán y las rechazó (o revocó) ante
    Conductores Chillán, When cada escuela envía un comunicado promocional, Then recibe el de
    Autoescuela Chillán y no el de Conductores Chillán. Vale el último consentimiento **ante la
    escuela que envía**.
  - Given ese mismo alumno en su portal, When abre Privacidad, Then ve un consentimiento
    promocional por escuela y puede revocar cada uno por separado.
- **AC11 — El admin configura el correo de cada escuela**: Given un admin, When abre la
  configuración de una escuela, Then puede editar el nombre visible del remitente, la dirección de
  envío, el correo de respuesta y el teléfono del pie, y los correos siguientes usan los valores
  nuevos sin redesplegar nada. La secretaria no puede editarlos.
- **AC12 — Correo de prueba**: Given un admin con la configuración de una escuela guardada, When
  pulsa "Enviar correo de prueba", Then le llega a su propio correo un mensaje con el remitente, la
  respuesta y el pie de esa escuela, o la pantalla le muestra el error del servidor de correo.
- **AC13 — Un solo correo de contacto**: Given un admin que cambia el correo de respuesta de una
  escuela (AC11), When la web pública de esa escuela muestra su contacto, Then muestra ese mismo
  correo, salvo que en Configuración web se haya escrito otro a propósito para la web.

### Edge cases obligatorios

- **AC-E1 — Escuela sin correo de respuesta**: Given una escuela sin correo de respuesta, When se
  envía un correo a su nombre, Then sale igual, sin dirección de respuesta, y el pie no invita a
  responder.
- **AC-E2 — Escuela sin dirección de envío configurada** (por ejemplo, una tercera escuela): Given
  una escuela sin dirección de envío propia, When se envía un correo a su nombre, Then sale desde
  la dirección neutra con el nombre de la escuela como remitente visible. Nunca falla el envío por
  falta de esa configuración.
- **AC-E3 — Alumno de las dos escuelas, correos de matrícula**: Given un alumno con una matrícula
  en cada escuela, When recibe el contrato de cada una, Then cada contrato usa su propia escuela y
  ningún correo mezcla datos de las dos.
- **AC-E4 — Nombres con tildes y signos**: Given una escuela cuyo nombre lleva tilde ("Autoescuela
  Chillán"), comas o comillas, Then el remitente visible se muestra correcto en Gmail y Outlook (sin
  caracteres rotos ni el nombre partido en dos direcciones).
- **AC-E5 — Comunicado de todas las escuelas** (admin, `announcements.branch_id` vacío): Given un
  comunicado sin escuela, When se envía, Then cada destinatario lo recibe **una vez por cada
  escuela** en la que cumple el segmento (y, si es promocional, en la que tiene el consentimiento
  vigente), con la marca de esa escuela. Un alumno de las dos puede recibirlo dos veces, cada una de
  su escuela: son dos responsables distintos y ninguno escribe a nombre del otro.
- **AC-E6 — Dirección de envío fuera del dominio autenticado**: Given un admin que escribe una
  dirección de envío que no termina en `@gestordeautoescuelas.cl` (por ejemplo, una de Gmail),
  When guarda, Then la app no lo permite y le explica que solo ese dominio está autenticado. El
  correo de respuesta sí puede ser de cualquier dominio.

---

## 4. Out of scope

- ❌ Un dominio propio por escuela como remitente (`autoescuelachillan.cl`, `conductorchillan.cl`).
  Hoy solo `autoescuelachillan.cl` podría hacerlo. Queda como opción futura por escuela.
- ❌ Escribir contraseñas de correo (SMTP) desde la app. Viven como secrets de Edge Functions (ver
  §9).
- ❌ Zoom: integración con la API de Zoom, cuenta de Zoom por escuela o un enlace predeterminado por
  escuela. Hoy el enlace se pega por clase y eso ya funciona por escuela; ver §9.
- ❌ Adjuntar archivos en comunicados (`0045-b`).
- ❌ Notificaciones dentro de la app (`notifications`), WhatsApp o SMS.
- ❌ Rediseñar las plantillas de correo más allá del remitente, el asunto, el pie y la línea del
  dominio.
- ❌ Crear las casillas en el hosting: lo hace el owner (ver §5).

---

## 5. Dependencias

### Specs previas
- Ninguna. `fix-181-b` (recuperar contraseña) comparte la configuración de Supabase Auth: si se
  cierra antes, AC7 parte con la Site URL y las Redirect URLs ya resueltas.

### Configuración que hace el owner (fuera del código, antes de verificar)
- Crear en `gestordeautoescuelas.cl` las direcciones de envío de cada escuela y la neutra.
- Subir el DMARC de `p=none` a `p=quarantine` una vez que AC9 pase con los correos reales.
- Supabase Auth → SMTP propio con la dirección neutra; Site URL y Redirect URLs en el dominio nuevo.
- Secrets de Edge Functions con las credenciales SMTP que defina el plan.

### Capacidades del proyecto que se asumen existentes
- Envío por SMTP con nodemailer en 8 Edge Functions: `send-enrollment-contract-email`,
  `send-certificate-email`, `send-zoom-email`, `send-announcement` (y `_shared/announcement-send.ts`),
  `activate-student-account`, `activate-instructor-account`, `create-instructor`, `create-secretary`.
- `consents.branch_id` (ante qué escuela se otorgó cada consentimiento) y la auto-revocación del
  titular (`update_consents_self_revoke_promocional`).
- `announcements.branch_id` registra la escuela que envía el comunicado.

### Capacidades nuevas requeridas
- Configuración de correo por escuela, editable por admin (AC11), con una sola fuente para el
  correo de contacto (§9).
- Un único punto en `supabase/functions/_shared/` que arme remitente, dirección de respuesta y pie
  a partir de la escuela, usado por las 8 funciones.
- Filtro de consentimiento promocional por escuela en el envío de comunicados, y lista de
  consentimientos por escuela en el portal del alumno.
- Primera activación del alumno sin `inviteUserByEmail` (que envía con el remitente de Supabase),
  usando el mismo envío por SMTP que ya usa el reenvío.

---

## 6. Datos y modelo (preliminar)

- Tablas modificadas: configuración de correo por escuela (nombre visible, dirección de envío,
  correo de respuesta, teléfono). Dónde vive: §9.
- Modelos UI nuevos: configuración de correo de la escuela; consentimiento promocional por escuela.
- RLS requerida: lectura para staff; escritura solo admin.

---

## 7. UX y flujos (preliminar)

- Pantallas afectadas:
  - Configuración de la escuela (admin): sección "Correo" con los 4 campos y "Enviar correo de
    prueba".
  - Portal del alumno → Privacidad: un consentimiento promocional por escuela.
  - El resto son los correos.
- Flujo principal: una acción de la secretaria o del sistema dispara el correo → se determina la
  escuela del correo (AC4) → se envía con su remitente, su dirección de respuesta y su pie.
- Estados especiales: escuela sin correo de respuesta (AC-E1) o sin dirección de envío (AC-E2);
  error del servidor de correo en la prueba (AC12).

---

## 8. Métricas de éxito post-launch

- Los correos de prueba de cada tipo llegan a la bandeja de entrada de Gmail y Outlook, no a spam.
- Las respuestas de alumnos llegan al correo de contacto de cada escuela.
- `dmarc=pass` en los encabezados de los correos enviados.

---

## 9. Notas / decisiones

### Resueltas

- [x] **¿Las dos escuelas son la misma razón social?** No (owner, 2026-11-12). Consecuencias:
      AC10 (consentimiento por escuela) y AC-E5 (un comunicado de todas las escuelas se envía una
      vez por escuela, nunca desde un remitente común).
- [x] **SPF, DKIM y DMARC de `gestordeautoescuelas.cl`:** existen (2026-11-12). Falta endurecer el
      DMARC después de AC9 (§5).
- [x] **Comunicado de todas las escuelas a un alumno de las dos:** una vez por escuela (AC-E5).
- [x] **Texto del correo de recuperar contraseña:** neutro. Supabase Auth usa una plantilla única
      para todos y el usuario puede ser de las dos escuelas.
- [x] **Qué se configura desde la app** (aprobado por el owner, 2026-11-12):
      - **Sí, por admin:** nombre visible del remitente, dirección de envío (solo del dominio
        autenticado), correo de respuesta y teléfono del pie. Son datos de cada escuela, cambian
        rara vez y una escuela nueva no debería necesitar a un desarrollador.
      - **No:** la contraseña del servidor de correo. Queda como secret de Edge Functions, fuera de
        la base de datos y de la pantalla.
      - **Zoom, fuera de esta spec:** no hay cuenta de Zoom en la app; cada clase guarda el enlace
        que pega la secretaria, así que cada escuela ya usa la suya. Solo tendría sentido un
        "enlace predeterminado por escuela" si alguna usa siempre la misma sala.
- [x] **Una sola fuente para el correo de contacto** (aprobado por el owner, 2026-11-12): hoy hay
      dos (`branches.email`, no editable, y `website_config.contact.email`, editable también por
      secretaria). El correo de respuesta de AC11 pasa a ser la fuente, y la web pública lo
      muestra salvo que en Configuración web se escriba otro (AC13).
- [x] **Nombres de las direcciones** (aprobado por el owner, 2026-11-12): `autoescuela-chillan@`,
      `conductores-chillan@` y `cuentas@` (neutra) en `gestordeautoescuelas.cl`.

### Abiertas (requieren una prueba o un dato del owner)

- [ ] **¿El hosting deja enviar con varias direcciones de remitente usando una sola cuenta
      autenticada?** Se prueba después de crear las casillas: enviar desde una cuenta con el
      remitente de la otra y ver si llega y pasa DKIM/DMARC. El hosting sale por MailChannels,
      que puede rechazarlo. Si no deja, hace falta una cuenta SMTP por dirección (un secret por
      escuela), y AC11 solo permite elegir entre las direcciones que tienen credencial.
- [ ] **Configuración actual:** valor real de `SMTP_FROM` (se ve en el remitente de cualquier
      correo que el sistema ya envió) y si Supabase Auth ya tiene SMTP propio. Sin SMTP propio,
      Supabase usa su servicio de prueba, con su propio remitente y un límite muy bajo de correos
      por hora.

---

## Changelog

- 2026-11-12 — draft inicial por Akxlarre (a partir del análisis del 2026-11-11)
- 2026-11-12 — razones sociales distintas: AC10 (consentimiento por escuela), AC-E5 reescrito.
  Configuración por admin (AC11, AC12, AC-E6). DNS verificado. Zoom fuera de alcance.
- 2026-11-12 — el owner aprueba la configuración por admin y deja Zoom fuera de esta spec.
- 2026-11-12 — el owner aprueba un solo correo de contacto por escuela (AC13) y los nombres de las
  direcciones. Quedan abiertas solo la prueba del hosting y la configuración actual.
- 2026-11-12 — aprobada por el owner. Las 2 abiertas de §9 son técnicas y se resuelven en el plan.
- 2026-11-12 — asignada a `m` vía Asignación ASG-b-103
  (`specs/assignments/ASG-b-103-correos-por-escuela-remitente-respuesta-marca.md`).
