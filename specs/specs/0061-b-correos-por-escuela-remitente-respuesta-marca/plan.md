# Plan 0061-b — Correos por escuela: remitente, respuesta y marca

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (Matías, 2026-11-12)
> **Created:** 2026-11-12
> **Talla:** L (confirmada por Matías, 2026-11-12) — **revisar el plan antes de implementar**

---

## 1. Resumen ejecutivo

Un módulo compartido `_shared/school-email.ts` pasa a ser el único lugar que decide remitente,
dirección de respuesta, asunto y pie. Lo usan las 9 funciones que envían correo: las 8 de la spec
más `public-enrollment`, que también invitaba con `inviteUserByEmail`. La configuración vive en
columnas de `branches` y la edita el admin desde un drawer nuevo con "Enviar correo de prueba".
Los comunicados se materializan por `(alumno, escuela)`: la marca y el consentimiento son los de la
escuela que envía.

El único correo que todavía manda Supabase Auth es el de recuperar contraseña. Ese pasa por un Send
Email Hook propio, para que lleve texto neutro y pase DKIM.

**Decisiones confirmadas (Matías, 2026-11-12):**

| # | Decisión |
|---|---|
| D1 | La configuración de correo va en **columnas de `branches`**: `email_sender_name`, `email_sender_address`, `email` (correo de respuesta) y `phone` (teléfono del pie). |
| D2 | `announcement_recipients.branch_id`, con UNIQUE `(announcement_id, user_id, branch_id)`. |
| D3 | **Reducida (2026-11-12):** `branches.email` es la única fuente del correo de contacto en los correos. La migración lo llena con `website_config.contact.email` si está vacío. Configuración web y `webs/` no se tocan: las webs Astro no se usan (hotfix-109-b) y las públicas actuales no son nuestras. |
| D4 | Send Email Hook de Supabase Auth → Edge Function propia, solo para el correo de recuperar contraseña. Cualquier otro tipo usa un texto genérico neutro. |

**Ya hecho fuera del código (2026-11-12):**
- Casillas creadas en cPanel.
- Secrets `SMTP_*` → `cuentas@`.
- Supabase Auth SMTP → `cuentas@` / "Gestor de Autoescuelas".
- Detalle en spec §9.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20261112200000_spec0061b_correo_por_escuela.sql` | Migration | D1 + D2 + D3 (datos) |
| `supabase/functions/_shared/school-email.ts` | Shared (puro + carga) | Remitente, respuesta, asunto, pie, línea del dominio, transporte SMTP |
| `supabase/functions/_shared/school-mailer.ts` | Shared (transporte) | `createSmtpTransport`, `sendSchoolMail`, `platformAddress`. Separado de `school-email.ts` porque importa nodemailer, que no se puede testear en local |
| `supabase/functions/_shared/school-email.test.ts` | Test Deno | Vectores de AC1–AC4, AC8, AC-E1, AC-E2, AC-E4 |
| `supabase/functions/_shared/student-invite-email.ts` | Shared | HTML de activación del alumno. Se extrae de `activate-student-account`, donde ya es la copia del `invite-user.html`, y lo usan las 2 funciones que invitan |
| `supabase/functions/_shared/student-invite-email.test.ts` | Test Deno | Escapado y marca |
| `supabase/functions/_shared/instructor-invite-email.ts` (+ test) | Shared | HTML de activación del instructor, que `create-instructor` y `activate-instructor-account` tenían copiado idéntico con "Conductores Chillán" fijo |
| `supabase/functions/_shared/announcement-email.ts` (+ test) | Shared (puro) | Plantilla del comunicado, pares (alumno, escuela) y consentimiento por escuela. Separado de `announcement-send.ts` para poder testearlo; reemplaza `announcement-send.test.ts` |
| `supabase/functions/_shared/auth-email.ts` | Shared (puro) | Texto neutro de recuperar contraseña y texto genérico (AC7), y armado del enlace `verify` |
| `supabase/functions/_shared/auth-email.test.ts` | Test Deno | Enlace, `redirect_to` y texto sin nombre de escuela |
| `supabase/functions/send-auth-email/index.ts` | Edge Function (hook) | Send Email Hook: verifica la firma `standardwebhooks` y envía por SMTP. `verify_jwt = false` |
| `supabase/functions/send-branch-test-email/index.ts` | Edge Function | AC12: solo admin. Envía al correo del admin con la configuración de la escuela y devuelve el error SMTP tal cual |
| `src/app/core/models/dto/branch-email-config.model.ts` | DTO | `Pick` de las columnas de correo de `branches` |
| `src/app/core/models/ui/branch-email-config.model.ts` | UI model | `{ branchId, branchName, senderName, senderAddress, replyTo, phone }` |
| `src/app/core/utils/branch-email.utils.ts` (+ `.spec.ts`) | Util puro | Validación AC-E6 (dominio autenticado), formato de correo y normalización |
| `src/app/core/facades/branch-email.facade.ts` (+ `.spec.ts`) | Facade | Carga y guardado por escuela, y `enviarPrueba(branchId)` |
| `src/app/features/admin/configuracion-correo/correo-escuelas-drawer.component.ts` (+ `.spec.ts`) | Smart (drawer) | Formulario de AC11 + botón de AC12, sobre `app-drawer-form` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `supabase/functions/send-enrollment-contract-email/index.ts` | `from`/`replyTo`/asunto/pie desde `school-email`, escuela = `enrollments.branch_id` | AC1–AC4, AC-E3 |
| `supabase/functions/_shared/contract-email.ts` | Asunto y pie por escuela; quita "no responder"; línea del dominio | AC3, AC8 |
| `supabase/functions/send-certificate-email/index.ts` | Igual; escuela de la matrícula | AC1–AC4 |
| `supabase/functions/send-zoom-email/index.ts` + `_shared/zoom-email.ts` | Igual; escuela del ciclo | AC1–AC4 |
| `supabase/functions/_shared/announcement-send.ts` | Marca de `recipient.branch_id` (la escuela que envía); `filterByPromotionalConsent(service, userIds, branchId)`; materializa por `(user, branch)`; re-chequeo por lote agrupado por escuela | AC4, AC5, AC10, AC-E5 |
| `supabase/functions/_shared/announcement-progress.ts` | Conteos por fila. Un alumno de las dos escuelas son 2 filas | AC-E5 |
| `supabase/functions/send-announcement/index.ts` | Vista previa del correo con la escuela del comunicado | AC4 |
| `supabase/functions/activate-student-account/index.ts` | Primera vez: `generateLink({type:'invite'})` + SMTP propio, en lugar de `inviteUserByEmail` | AC6 |
| `supabase/functions/public-enrollment/index.ts` | Igual (`inviteStudentToAuth`) | AC6 (2º camino, spec §9) |
| `supabase/functions/activate-instructor-account/index.ts`, `create-instructor/index.ts` | Remitente de la escuela del instructor, en vez del texto fijo "Conductores Chillán" | AC4 |
| `supabase/functions/create-secretary/index.ts` + `_shared/staff-invite-email.ts` | Remitente y pie de la escuela de la secretaria | AC4 |
| `supabase/config.toml` | `[functions.send-auth-email] verify_jwt = false` | D4 |
| `src/app/core/facades/announcements.facade.ts` | `loadPreview`: consentimiento por escuela; con "todas las escuelas", una fila por `(alumno, escuela)` | AC10, AC-E5 (vista previa = envío) |
| `src/app/core/facades/consents.facade.ts` | `loadByUser` también selecciona `branch_id` (el modelo UI ya tiene `branchId`, pero la consulta no lo traía) | AC10 |
| `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` | Alumno: un bloque de consentimiento promocional por escuela (el último ante cada una). Admin: tarjeta "Correo de las escuelas" | AC10, AC11 |
| `supabase/email-templates/invite-user.html` | Encabezado: "ya no se usa desde 0061-b", se mantiene como referencia histórica | AC6 |
| `indices/DATABASE.md`, `FACADES.md`, `COMPONENTS.md`, `MODELS.md`, `UTILS.md`, `NOTIFICATIONS-MAP.md` §9.4, `DOMAIN-GOTCHAS.md` (DG-067) | Sincronizar | Paso 5 |
| `docs/DEPLOY.md` §Cambiar de dominio | Hook, secrets y casillas | Operación |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Lo que ya existe y se reutiliza
- **Envío SMTP con nodemailer + `SMTP_*`** (9 funciones). Solo se centraliza el transporte en
  `school-email.ts`, sin cambiar la librería. La prueba del 2026-11-12 mostró que nodemailer pasa
  DKIM y que con una sola cuenta se puede enviar como cualquier dirección del dominio.
- **`generateLink({type:'invite'})` + SMTP propio**, patrón de DG-067 (`create-instructor`,
  `create-secretary`). Se aplica igual a los dos caminos que invitan alumnos.
- **HTML de activación del alumno** ya portado a TypeScript en `activate-student-account` (el que
  usa el reenvío). Se mueve a `_shared/student-invite-email.ts`, sin escribir uno nuevo.
- **`consents.branch_id`** (NOT NULL) y la auto-revocación del titular. No hace falta tocar la BD
  para AC10.
- **`ConsentsFacade.revoke(id)`** revoca por fila, así que ya sirve para revocar por escuela.
- **Precedente de UI:** `TarifaInstructoresDrawerComponent` + `PayrollConfigFacade`. Es un drawer
  admin de configuración por escuela, con selector de escuela y abierto desde `ajustes-drawer`.
  Se copia su estructura.
- **`app-drawer-form`** (fix-025/026), `BranchFacade.branches()`, `ToastService`, `staff-auth.ts`
  (`requireStaff`) para autorizar `send-branch-test-email`.
- **Policies de `branches`:** admin escribe, staff lee y anon lee. AC11 no necesita policies nuevas.

### Lo que se crea y por qué
- **`school-email.ts`:** hoy cada una de las 9 funciones arma `from` por su cuenta, y 3 tienen
  "Conductores Chillán" fijo en el código. La spec pide un solo punto (§5).
- **`BranchEmailFacade`:** ningún Facade escribe en `branches`. `BranchFacade` es transversal
  (filtro de sede); meterle edición mezclaría responsabilidades.
- **`send-auth-email`** (D4): es la única forma de que el correo de Supabase Auth pase DKIM y
  quede con su texto versionado en el repo.
- **`send-branch-test-email`:** AC12 necesita que la respuesta traiga el error SMTP real. Ninguna
  función existente envía a un destinatario arbitrario con la configuración de una escuela.

---

## 4. Modelo de datos

### Migración `20261112200000_spec0061b_correo_por_escuela.sql`

```sql
-- D1: configuración de correo por escuela (email = respuesta, phone = pie: ya existían)
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email_sender_name    TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS email_sender_address TEXT;
ALTER TABLE branches ADD CONSTRAINT branches_email_sender_domain_chk   -- AC-E6 (guard en BD)
  CHECK (email_sender_address IS NULL
         OR lower(email_sender_address) ~ '^[a-z0-9._%+-]+@gestordeautoescuelas\.cl$');
  -- idempotente: DROP CONSTRAINT IF EXISTS antes

-- Seed: slug → casilla creada en cPanel (autoescuela-chillan / conductores-chillan)
UPDATE branches SET email_sender_name = name,
                    email_sender_address = slug || '@gestordeautoescuelas.cl'
 WHERE email_sender_address IS NULL AND slug IN ('autoescuela-chillan','conductores-chillan');

-- D3: un solo correo de contacto (website_config no se modifica)
UPDATE branches b SET email = wc.config->'contact'->>'email'          -- solo si branches.email está vacío
  FROM website_config wc WHERE wc.branch_id = b.id AND coalesce(trim(b.email),'') = '' ...;

-- D2: un destinatario por (alumno, escuela)
ALTER TABLE announcement_recipients ADD COLUMN IF NOT EXISTS branch_id INT REFERENCES branches(id);
UPDATE announcement_recipients r SET branch_id = coalesce(a.branch_id, u.branch_id) ... ;  -- backfill
ALTER TABLE announcement_recipients ALTER COLUMN branch_id SET NOT NULL;
-- reemplazar UNIQUE (announcement_id, user_id) por (announcement_id, user_id, branch_id)
```

- **Antes de escribir el SQL final**, la tarea consulta (solo lectura) los valores actuales de
  `branches.email`, `branches.phone`, `website_config.contact.email` y si hay filas en
  `announcement_recipients` (solo deberían existir pruebas en seco). Con esos datos se decide el
  backfill.
- **La migración la aplica Matías**, no el agente.
- `ARCH-28`: nada de `CURRENT_DATE` ni `::date` en el SQL.

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `branches` | admin | UPDATE | existente (sin cambios) |
| `branches` | secretaria / instructor / alumno / anon | SELECT | existente. Las columnas nuevas son públicas por naturaleza (un remitente). No hay secretos: la contraseña SMTP sigue en los secrets |
| `announcement_recipients` | — | — | sin cambios. Solo escriben las Edge Functions con service role |

### Modelos

- `core/models/dto/branch-email-config.model.ts`:
  `Pick<Branch, 'id'|'name'|'email_sender_name'|'email_sender_address'|'email'|'phone'>`.
  Si no existe un DTO `Branch`, se define con las columnas reales.
- `core/models/ui/branch-email-config.model.ts`: camelCase; `replyTo` = `email`.
- El modelo UI de consentimiento ya tiene `branchId`; solo falta que la consulta lo traiga.

---

## 5. Arquitectura del feature

### Correo saliente (las 9 funciones)

```
evento (secretaria / sistema / cron)
  └─ Edge Function X
       ├─ resuelve branchId según AC4 (matrícula | ciclo | comunicado | persona)
       ├─ loadSchoolSender(service, branchId)  ──► branches (1 select)
       │     └─ sin fila / sin dirección → PLATFORM_SENDER con nombre de la escuela (AC-E2)
       ├─ html = plantilla propia + schoolFooterHtml(sender) + domainLine(sender) (AC3, AC8)
       └─ sendSchoolMail(transport, sender, { to, subject: withSchool(subject, sender), html })
             from    = { name: sender.name, address: sender.address }   ← nodemailer codifica RFC 2047 (AC-E4)
             replyTo = sender.replyTo || undefined                     ← AC2 / AC-E1
```

### `school-email.ts` (API)

| Función | Pura | Qué hace |
|---|---|---|
| `resolveSender(branchRow \| null, platformAddress)` | sí | Devuelve `{ name, address, replyTo, phone, schoolName }` y aplica AC-E2 |
| `withSchool(subject, sender)` | sí | Agrega `" — {escuela}"` si el asunto no lo trae ya (AC3) |
| `schoolFooterHtml(sender, { promocional })` | sí | "Enviado por X mediante Gestor de Autoescuelas", teléfono, correo de respuesta. Sin respuesta configurada, no invita a responder (AC-E1). Con `promocional`, pie de baja con el correo de la escuela |
| `domainLineHtml(sender)` | sí | AC8 |
| `loadSchoolSender(service, branchId)` | no | Select a `branches` + `resolveSender` |
| `createSmtpTransport()` / `sendSchoolMail(...)` | no | Centraliza `SMTP_*` |

### Comunicados (D2)

```
materializeRecipients
  enrollments (segmento) → pares únicos (user_id, branch_id)
    branch del comunicado ≠ null → solo esa escuela
    branch null (admin)          → todas, un par por escuela donde cumple el segmento (AC-E5)
  promocional → filterByPromotionalConsent(service, userIds, branchId) por cada escuela
              (último consentimiento ANTE ESA ESCUELA, AC10)
  upsert onConflict (announcement_id, user_id, branch_id)
processRecipients
  sender = loadSchoolSender(recipient.branch_id)  (cache por lote)
  {{sede}} = nombre de la escuela que envía (antes: la del destinatario)
```

### Recuperar contraseña (D4)

```
login "¿Olvidaste…?" / admin → resetPasswordForEmail
  └─ Supabase Auth → Send Email Hook (HTTPS, firmado) → send-auth-email
        verifica la firma (SEND_EMAIL_HOOK_SECRET, standardwebhooks)
        link = {SUPABASE_URL}/auth/v1/verify?token={token_hash}&type={action}&redirect_to={redirect_to}
        recovery → texto neutro; otro tipo → genérico neutro
        from = "Gestor de Autoescuelas" <SMTP_FROM>   (AC7)
```

### Admin (AC11, AC12)

```
ajustes-drawer (isAdmin) → layoutDrawer.push(CorreoEscuelasDrawerComponent)
  └─ inject(BranchEmailFacade)       (Smart en features/admin)
        load() → branches (select columnas de correo)
        save(branchId, form) → validación pura (AC-E6) → update branches
        enviarPrueba(branchId) → functions.invoke('send-branch-test-email')
                                → toast con el resultado o el error del servidor
```

### Capas tocadas

- **Smart:** `features/admin/configuracion-correo/correo-escuelas-drawer.component.ts`.
- **Organismo:** `ajustes-drawer`, solo agrega una tarjeta y la lista de consentimientos.
- **Facade:** `branch-email.facade.ts` (nuevo); `announcements.facade.ts` y `consents.facade.ts`
  (ajustes).
- **Edge:** 9 funciones + 2 nuevas + 3 módulos `_shared` nuevos.
- **Migration:** 1.
- **Web pública (Astro):** `getSiteData.ts`.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade, OnPush, `input()`/`@if`; el drawer es Smart en `features/`
- [x] `facades.md` — `assertReadOk`/`assertWriteOk`; `BranchEmailFacade` no es branch-scoped (admin edita las dos escuelas)
- [x] `models.md` — DTO vs UI
- [x] `visual-system.md` — tokens, `app-drawer-form`, `loader-circle`
- [ ] `swr-pattern.md` — drawer de configuración: carga simple, sin SWR (como `PayrollConfigFacade`)
- [x] `notifications.md` — resultado de guardar y de la prueba vía `ToastService`
- [x] `testing-tdd.md` — tests primero para `school-email`, `auth-email`, `branch-email.utils` y el filtro por escuela
- [x] `ai-readability.md` — `data-llm-action` en Guardar, Enviar prueba y Revocar por escuela
- [x] `dates.md` — `chileYear()` ya usado en los pies; nada de fechas nuevas
- [x] `database.md` — migración idempotente + `indices/DATABASE.md`

---

## 7. Plan de testing

**Unitarios (Deno, `_shared/*.test.ts`):**
- `resolveSender`: escuela completa; sin dirección (AC-E2); sin respuesta (AC-E1); fila nula.
- `withSchool`: no duplica el nombre.
- `schoolFooterHtml`: con y sin respuesta; promocional; escapado de `<`, comillas y tildes.
- `filterByPromotionalConsent` por escuela: aceptó en A y revocó en B → solo A (AC10). Último
  registro por escuela, no global.
- Materialización: un alumno de las dos escuelas con comunicado `branch_id = null` → 2 filas; con
  `branch_id = 1` → 1 fila (AC5, AC-E5).
- `auth-email`: enlace con `token_hash`, `type` y `redirect_to` codificados; el texto no contiene
  el nombre de ninguna escuela (AC7).
- `student-invite-email`: marca de la escuela y escapado.

**Unitarios (Vitest):**
- `branch-email.utils.spec.ts`: AC-E6 (rechaza Gmail y acepta mayúsculas del dominio); la
  respuesta acepta cualquier dominio.
- `branch-email.facade.spec.ts`: load, save, error de escritura, `enviarPrueba` con error del
  servidor (DG de `functions.invoke`: un no-2xx no lanza).
- `consents.facade.spec.ts`: la consulta trae `branch_id`.
- `ajustes-drawer.component.spec.ts`: alumno con consentimientos en 2 escuelas → 2 bloques que se
  revocan por separado.
- `announcements.facade.spec.ts`: vista previa por escuela.
- `correo-escuelas-drawer.component.spec.ts`: secretaria no ve la tarjeta; validación de AC-E6.

**Verificación real (producción, con cuidado):**
- Alumno de prueba con un correo de Matías, con matrícula en cada escuela (también sirve para
  AC-E3). Contrato, certificado y Zoom de cada escuela → remitente y "Responder" (AC1, AC2, AC3,
  AC8).
- Comunicado promocional de cada escuela y uno "de todas", con consentimientos cruzados (AC5,
  AC10, AC-E5). Segmento acotado con `excludedUserIds` o filtro, **nunca a alumnos reales**.
- Activación por primera vez y matrícula online (AC6).
- Recuperar contraseña con ese alumno (AC7).
- Encabezados en Gmail: `spf`/`dkim`/`dmarc=pass` para un correo de escuela y uno de cuenta (AC9).
  Revisar también `X-MC-Relay`.
- Outlook: nombre con tilde (AC-E4).
- Correo de prueba del admin, con éxito y con error forzado (dirección inválida) (AC12).
- `/verify` del drawer y del portal del alumno.

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| El hook de Auth falla (firma, deploy) y **nadie recibe el correo de recuperar contraseña**. Supabase no vuelve a usar el SMTP cuando el hook está activo | Media | Activar el hook en el panel **solo después** de desplegar `send-auth-email` y probarla. Si falla, desactivar el hook en el panel = vuelta inmediata al SMTP con la plantilla corregida. Además, se deja neutra la plantilla Reset password del panel como respaldo |
| Envío real a alumnos durante la verificación (no hay BD de desarrollo) | Media | Solo alumnos de prueba con correo propio; comunicados con segmento acotado. `dryRun` para los envíos masivos |
| Cambiar la UNIQUE de `announcement_recipients` rompe un reintento de un comunicado en curso | Baja | No se ha enviado ninguno (spec §1). La tarea verifica que no haya `status = 'enviando'` antes de aplicar |
| Las Edge Functions quedan activas al desplegarlas con la CLI, pero la UI Angular (drawer, portal) llega a producción recién con "Publicar en producción" (GitHub Actions manual, `publicar-produccion.yml`) | Alta | Desplegar las funciones por bloque (§9). La UI se verifica en local con `/verify` y en producción después de publicar |
| `X-MC-Relay: Junk` de MailChannels baja la entrega | Media | Medir con correos reales en AC9. Si siguen marcados, consultar al soporte del hosting (fuera del código) |
| Duplicar `{{sede}}` y la marca rompe correos programados ya redactados | Baja | `{{sede}}` pasa a ser la escuela que envía, que es lo que la secretaria espera al redactar. Queda documentado en el changelog del modelo |
| `ARCH-24`: el drawer inyecta `BranchFacade` (transversal) | Media | Es Smart en `features/` (no aplica ARCH-24). Si se mueve a `shared/`, se expone la lista desde `BranchEmailFacade` |

---

## 9. Orden de implementación

1. **Datos:** consulta de solo lectura de los valores actuales → migración → **Matías la aplica**
   → `indices/DATABASE.md`.
2. **Núcleo:** tests y luego `school-email.ts`, `auth-email.ts` y `student-invite-email.ts`.
3. **Correos transaccionales:** contrato, certificado y Zoom → deploy → verificación AC1–AC3, AC8.
4. **Invitaciones:** `activate-student-account` + `public-enrollment` (AC6) y staff (instructor,
   secretaria).
5. **Comunicados:** `announcement-send.ts` + vista previa en `AnnouncementsFacade` (AC4, AC5, AC10,
   AC-E5).
6. **Portal del alumno:** consentimientos por escuela (AC10, parte UI).
7. **Admin:** util + Facade + drawer + `send-branch-test-email` (AC11, AC12, AC-E6).
8. **Contacto único (AC13):** sin código propio. Lo cubren la migración (paso 1) y
   `loadSchoolSender` (paso 2). Se verifica que ningún correo lea `website_config.contact.email`.
9. **Auth:** `send-auth-email` → deploy → probar → activar el hook en el panel (Matías) + plantilla
   del panel neutra como respaldo (AC7).
10. **Verificación de punta a punta:** AC9 con encabezados, Outlook, `/verify`, `npm run lint:arch`,
    `npm run test:ci`, tests Deno y `node scripts/test-tz.mjs` sobre lo tocado.
11. **Sincronizar índices, `DEPLOY.md` y DG-067** → `/spec-verify`.

Cada bloque de 3–8 se puede desplegar por separado: el módulo compartido convive con las funciones
que todavía no lo usan.

---

## 10. Estimación

L: 4–5 días de trabajo efectivo. Lo más incierto es el hook de Auth (paso 9) y la verificación real
sin BD de desarrollo.

---

## Changelog

- 2026-11-12 — plan inicial (Matías). Talla L y decisiones D1–D4 confirmadas.
- 2026-11-12 — transporte SMTP en `_shared/school-mailer.ts`, aparte de `school-email.ts` (puro y testeable).
- 2026-11-12 — `_shared/instructor-invite-email.ts`: une las 2 copias del correo del instructor.
- 2026-11-12 — `_shared/announcement-email.ts`: parte pura de los comunicados, testeable en local.
- 2026-11-12 — D3 y AC13 reducidos: fuera Configuración web y `webs/` (la web pública no es nuestra).
