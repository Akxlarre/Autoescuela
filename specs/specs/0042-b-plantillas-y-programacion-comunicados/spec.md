# Spec 0042-b — Plantillas y programación de comunicados

> **Status:** in_progress
> **Created:** 2026-09-10
> **Owner:** Benjamín
> **Priority:** P2 — el comunicado global ya funciona sin esto; acá se reduce la fricción de usarlo

---

## 1. Contexto de negocio

**Origen:** las dos cosas que la spec `0041-b` dejó explícitamente fuera de alcance (§4 y §9):
el CRUD de plantillas guardadas (`notification_templates` quedó creada pero vacía) y programar
un envío para más adelante.

**Persona afectada:** Secretaria (emisora principal). Admin (dueño de las plantillas).

**Problema que resuelve:**
El comunicado global existe y funciona, pero cada envío se redacta desde cero. Los comunicados
de una autoescuela son repetitivos por naturaleza — feriados, cambios de horario, recordatorios
de documentación — así que la secretaria termina reescribiendo el mismo texto, o peor,
copiándolo de un correo viejo, con la deriva de tono y los errores que eso trae. Y no puede
adelantar trabajo: si el lunes sabe que el jueves hay feriado, tiene que acordarse de entrar el
jueves a mandarlo.

**Hipótesis de valor:**
Un comunicado repetido pasa de redactarse a elegirse, y el trabajo se puede hacer cuando hay
tiempo en vez de cuando corresponde mandarlo.

---

## 2. User Stories

- **US1**: Como admin, quiero guardar plantillas de comunicado con variables, para que el texto
  institucional se escriba una vez y se reutilice con el tono correcto.
- **US2**: Como secretaria, quiero partir de una plantilla al redactar un comunicado, para no
  reescribir desde cero lo que ya se mandó otras veces.
- **US3**: Como secretaria, quiero que la plantilla se personalice sola con el nombre de cada
  alumno, para que el correo no se lea como un mensaje masivo.
- **US4**: Como secretaria, quiero programar un comunicado para una fecha y hora futura, para
  poder prepararlo cuando tengo tiempo y no cuando toca mandarlo.
- **US5**: Como secretaria, quiero ver y cancelar lo que está programado, para corregir un aviso
  que dejó de aplicar antes de que salga.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un admin en la gestión de plantillas, When crea una plantilla con nombre, asunto
  y cuerpo, Then queda guardada en `notification_templates` y disponible para el compositor.
- **AC2**: Given una secretaria en el compositor, When elige una plantilla, Then el asunto y el
  cuerpo se cargan en el formulario y puede editarlos antes de enviar (la plantilla es un punto
  de partida, no un texto bloqueado).
- **AC3**: Given una plantilla cuyo cuerpo contiene `{{nombre}}` y `{{sede}}`, When se envía el
  comunicado, Then cada destinatario recibe el correo con sus propios valores sustituidos.
- **AC4**: Given una secretaria, When intenta crear, editar o borrar una plantilla, Then la
  operación es rechazada por RLS — solo el admin administra plantillas (puede leerlas y usarlas).
- **AC5**: Given un comunicado en el compositor, When elige "Programar" e indica una fecha y hora
  futura, Then el comunicado queda registrado como programado y **no** se envía en ese momento.
- **AC6**: Given un comunicado programado cuya hora llegó, When corre el dispatcher, Then el
  comunicado se envía resolviendo el segmento **en ese momento** (no el que se previsualizó al
  programarlo), respetando el filtro de consentimiento vigente.
- **AC7**: Given comunicados programados, When la secretaria abre el historial, Then los ve
  listados como "Programado" con su fecha de envío, separados de los ya enviados.
- **AC8**: Given un comunicado programado que todavía no salió, When la secretaria lo cancela,
  Then no se envía nunca y queda registrado como cancelado (no se borra: es trazabilidad).

### Edge cases obligatorios

- **AC-E1**: Given una plantilla con una variable que no existe (ej. `{{telefono}}`), When se
  envía, Then el marcador se reemplaza por vacío y el envío no falla — un comunicado no se cae
  por un typo en una plantilla.
- **AC-E2**: Given un comunicado programado para una fecha que ya pasó (porque el dispatcher
  estuvo caído), When el dispatcher corre, Then igual lo envía y lo registra, en vez de saltearlo
  en silencio.
- **AC-E3**: Given un comunicado programado cuyo segmento no resuelve a nadie cuando llega la
  hora, When corre el dispatcher, Then queda marcado como enviado con 0 destinatarios y con el
  motivo, sin quedar reintentándose para siempre.
- **AC-E4**: Given dos corridas del dispatcher que se solapan, When ambas ven el mismo comunicado
  vencido, Then se envía **una sola vez** (el segundo no duplica el envío).

---

## 4. Out of scope

- ❌ **Envíos recurrentes.** Solo se programa una fecha puntual. La recurrencia obliga a decidir
  qué pasa con destinatarios que cambian entre corridas, y eso es una spec propia.
- ❌ **Variables financieras o de agenda** (`{{saldo}}`, `{{proxima_clase}}`). Meterían datos
  individuales sensibles en un envío masivo: si el segmento se arma mal, un alumno ve el dato de
  otro. Solo identidad: `{{nombre}}` y `{{sede}}`.
- ❌ **Lógica condicional en plantillas** (`{{#if}}`, bloques opcionales). Es un motor de
  templating, no una plantilla.
- ❌ **Editor de texto enriquecido.** El cuerpo sigue siendo texto plano escapado, como en 0041-b.
- ❌ **Plantillas por sede.** Una plantilla es institucional y sirve para toda la escuela.
- ❌ **Envío de archivos.** Diferido a una spec propia (`0043-b`), decidido el 2026-09-10. No es
  un detalle del compositor: adjuntar de verdad un PDF a cientos de destinatarios multiplica el
  tráfico SMTP y es señal de spam, así que la forma sana es subir el archivo a Storage (el bucket
  privado `documents` ya existe) y mandar un enlace — y ahí aparece la decisión real, que es el
  control de acceso a ese enlace (firmado y con expiración vs. exige login). Eso merece sus
  propios ACs, no colarse acá.
- ❌ **Bidireccionalidad** y **comunicados a instructores/secretarias** — siguen fuera, igual que
  en 0041-b.

---

## 5. Dependencias

### Specs previas
- `0041-b-comunicado-global-alumnos` (✅ done) — aporta `announcements`,
  `announcement_recipients`, el compositor, el historial y la Edge Function `send-announcement`.
- `0040-b-consentimiento-comunicaciones-alumno` (✅ done) — el filtro de consentimiento que AC6
  debe seguir respetando al enviar diferido.

### Capacidades del proyecto que se asumen existentes
- Tabla `notification_templates` con su RLS ya alineada a lo que pide AC4 (INSERT/UPDATE/DELETE
  solo `admin`, SELECT `admin` + `secretary`). **No hace falta migrarla.**
- `pg_cron` (1.6.4) y `pg_net` (0.19.5) instalados, con precedente en el repo: el job
  `auto-create-next-promotions` invoca una Edge Function vía `net.http_post` leyendo `project_url`
  y `service_role_key` de `vault.decrypted_secrets`.
- `AnnouncementsFacade`, `AnnouncementComposerDrawerComponent`, `AnnouncementsContentComponent`.

### Capacidades nuevas requeridas
- Columnas de programación en `announcements` (`scheduled_for`, `status`).
- Edge Function nueva para despachar lo programado (no se reusa `send-announcement` tal cual:
  esa valida un usuario autenticado y el cron no tiene uno — ver §6).
- Job de `pg_cron` que la invoque.
- UI de gestión de plantillas (admin).

---

## 6. Datos y modelo (preliminar)

**`notification_templates`** — se usa tal cual está (`id`, `name`, `type`, `subject`, `body`,
`active`, `created_at`). Hoy tiene 0 filas. `type` se usará para distinguir plantillas de
comunicado (`announcement`) de otros usos futuros.

**`announcements`** — columnas nuevas:
- `scheduled_for TIMESTAMPTZ NULL` — cuándo debe salir. `NULL` = envío inmediato (lo actual).
- `status TEXT` — `enviado` | `programado` | `cancelado` | `enviando`. El v1 no tenía estado
  explícito: se infería de `sent_at`. Ahora hace falta uno real.
- `template_id INT NULL REFERENCES notification_templates(id)` — de qué plantilla salió, para
  saber cuáles se usan de verdad.

**Autorización del envío diferido — el punto delicado:** `send-announcement` valida que el
llamador sea un `admin`/`secretary` autenticado. Un job de cron no tiene sesión de usuario, así
que **no** se le puede abrir una puerta de servicio a esa función sin debilitarla. En su lugar va
una función separada (`dispatch-scheduled-announcements`) que corre con `service_role`, busca lo
vencido y ejecuta el envío: la decisión de autorización ya se tomó cuando la persona programó el
comunicado, y quedó registrada en `sent_by` y `branch_id`.

**Idempotencia (AC-E4):** el dispatcher marca el comunicado como `enviando` con un UPDATE
condicional (`WHERE status = 'programado'`) antes de tocar SMTP. Dos corridas solapadas compiten
por ese UPDATE y solo una gana.

---

## 7. UX y flujos (preliminar)

**Gestión de plantillas (admin):** entra por el drawer de Ajustes, tab "Ajustes" — el mismo lugar
donde ya viven "Límite de Visualización de Agenda", precios y tarifas, todas configuraciones de
admin. No se crea un ítem de menú nuevo (lección de `fix-167-b`).

**Compositor:** gana un selector de plantilla arriba de Asunto ("Partir de una plantilla…",
opcional) y, en el footer, el botón de envío se acompaña de "Programar". Elegir "Programar" pide
fecha y hora y cambia la confirmación.

**Historial:** los comunicados programados aparecen arriba, con badge "Programado", su fecha, y
acción de cancelar. Los cancelados se muestran atenuados, no se ocultan.

**Estados especiales:** plantilla sin variables se comporta igual que texto libre; fecha en el
pasado se rechaza en el formulario; un comunicado en estado `enviando` no ofrece cancelar.

---

## 8. Métricas de éxito post-launch

- Proporción de comunicados que salen desde una plantilla vs. redactados a mano (si es ~0, las
  plantillas no le sirven a la secretaria y hay que preguntarle por qué).
- Cuántos comunicados se programan vs. se envían al toque.
- Comunicados cancelados antes de salir — cada uno es un error que el programar permitió atajar.

---

## 9. Notas / decisiones abiertas

- [ ] **Frecuencia del cron.** Cada 5 minutos da buena precisión pero corre 288 veces al día casi
      siempre en vacío; cada 15 alcanza para un comunicado y es más barato. Propuesta a validar:
      **cada 15 minutos**, y que la UI redondee/comunique esa granularidad en vez de prometer una
      precisión que no tiene.
- [ ] **¿La plantilla guarda también el segmento?** Un "aviso de feriado" casi siempre va al mismo
      corte. Guardar filtros junto al texto ahorraría más, pero mezcla dos cosas (qué se dice vs. a
      quién) que hoy están separadas. Propuesta: **no** en esta spec.

---

## Changelog

- 2026-09-10 — draft inicial por Benjamín. Alcance de las 4 decisiones tomadas al abrir la spec:
  (1) plantillas + programación puntual, sin recurrencia; (2) variables solo de identidad
  (`{{nombre}}`, `{{sede}}`); (3) solo admin administra plantillas, secretaría las usa;
  (4) el segmento de un comunicado programado se resuelve al enviar, no al programar.
