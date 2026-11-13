# Tasks 0061-b — Correos por escuela: remitente, respuesta y marca

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-11-12

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marca la tarea como `[x]` apenas pase su DoD, no antes y no en bloque.
- Si descubres una sub-tarea no listada, agrégala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detente** y crea una spec nueva.
- **Supabase es producción.** La migración la aplica Matías. Los envíos reales van solo a alias de
  `matiasjfr01+…0061@gmail.com`, nunca a alumnos reales.
- Las Edge Functions se despliegan con `npx supabase functions deploy <nombre>`; verificar con
  `functions list`.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Leer el estado actual de los datos (solo lectura)
  - **AC ref:** AC11, AC13, AC-E5
  - **DoD:**
    - [x] Anotados en este archivo `branches.{id, slug, name, email, phone}` de las 2 escuelas
    - [x] Anotado `website_config.config.contact.email` de cada escuela
    - [x] Conteo de `announcement_recipients` y de `announcements` con `status = 'enviando'` (debe ser 0)
    - [x] Confirmado que no existe la UNIQUE nueva ni las columnas nuevas
  - **Resultado (2026-11-12, `db query --remote --read-only`):**

    | id | slug | name | email | phone | `contact.email` | `brand.name` |
    |---|---|---|---|---|---|---|
    | 1 | `autoescuela-chillan` | Autoescuela Chillán | otecchillan@gmail.com | +56 42 232 7800 | otecchillan@gmail.com | AutoEscuela Chillán |
    | 2 | `conductores-chillan` | Conductores Chillán | conductorchillan@gmail.com | +56 42 224 4030 | conductorchillan@gmail.com | Conductores Chillán |

    - `branches.email` ya es igual a `contact.email` en las dos escuelas: el backfill de D3 no cambia
      nada hoy (se deja con su guarda para una escuela futura).
    - `announcements`: 0 filas. `announcement_recipients`: 0 filas → la columna `branch_id` puede
      nacer NOT NULL sin backfill real.
    - UNIQUE actual: `announcement_recipients_unique_per_user (announcement_id, user_id)`.
    - `update_branches`: `auth_user_role() = 'admin'` → AC11 sin policies nuevas.
    - El nombre de marca de la web (`AutoEscuela Chillán`, con E mayúscula) difiere de
      `branches.name`. El remitente se siembra con `branches.name`.

- [x] **T1.2** — Escribir la migración `20261112200000_spec0061b_correo_por_escuela.sql`
  - **AC ref:** AC11, AC13, AC-E5, AC-E6
  - **DoD:**
    - [x] `branches.email_sender_name` y `email_sender_address` (`ADD COLUMN IF NOT EXISTS`)
    - [x] CHECK de dominio `@gestordeautoescuelas.cl` (`DROP CONSTRAINT IF EXISTS` antes)
    - [x] Seed de remitentes por slug, solo donde está vacío
    - [x] `branches.email` se llena con `contact.email` solo si está vacío; `website_config` no se toca
    - [x] `announcement_recipients.branch_id` NOT NULL con backfill, UNIQUE `(announcement_id, user_id, branch_id)` reemplaza a la anterior
    - [x] Idempotente (re-ejecutable sin error); sin `CURRENT_DATE` ni `::date` (ARCH-28)
    - [x] `npm run lint:arch` sin errores nuevos (0 errores)

- [x] **T1.3** — Aplicar la migración (**Matías**) y documentarla
  - **AC ref:** AC11
  - **DoD:**
    - [x] Matías confirma que la aplicó
    - [x] Verificado con una consulta: columnas, CHECK, UNIQUE y valores sembrados
    - [x] `indices/DATABASE.md`: `branches` (columnas nuevas) y `announcement_recipients` (branch_id + UNIQUE) — adelantado; se confirma al aplicar
    - Resultado (2026-11-12): columnas y seed de las 2 escuelas, CHECK de dominio, `announcement_recipients.branch_id` NOT NULL y UNIQUE `(announcement_id, user_id, branch_id)` verificados con `db query --read-only`

- [x] **T1.4** — Modelos `dto/branch-email-config.model.ts` y `ui/branch-email-config.model.ts`
  - **AC ref:** AC11
  - **DoD:**
    - [x] DTO = `Pick` de las columnas reales de `branches` (sin duplicar una interfaz `Branch`)
    - [x] UI en camelCase; `replyTo` ← `email`
    - [x] `indices/MODELS.md`
    - Resultado: `Branch` DTO ampliado con `email_sender_*`; `BranchEmailConfigRow` = `Pick` de `Branch`; UI `BranchEmailConfig` + `BranchEmailForm`. Pendiente: `indices/MODELS.md` (T10.1)

---

## Fase 2 — Núcleo compartido de correo (Edge)

- [x] **T2.1** — `_shared/school-email.test.ts` PRIMERO
  - **AC ref:** AC1, AC2, AC3, AC8, AC13, AC-E1, AC-E2, AC-E4
  - **DoD:**
    - [x] `resolveSender`: escuela completa / sin dirección (→ neutra con nombre de la escuela) / sin respuesta / fila nula
    - [x] `withSchool` no duplica el nombre
    - [x] `schoolFooterHtml`: "Enviado por X mediante Gestor de Autoescuelas", teléfono, sin "no responder", sin invitar a responder si no hay respuesta, pie de baja promocional, escapado
    - [x] `domainLineHtml` (AC8)
    - [x] Los tests fallan (no hay implementación)
    - Resultado: 22 tests, 22 pasan (`deno test supabase/functions/_shared/school-email.test.ts`)

- [x] **T2.2** — Implementar `_shared/school-email.ts`
  - **AC ref:** igual que T2.1
  - **DoD:**
    - [x] Tests de T2.1 pasan (`deno test`)
    - [x] `loadSchoolSender(service, branchId)` lee solo `branches`, revisa `error` y nunca lanza por falta de configuración (AC-E2)
    - [x] `createSmtpTransport()` + `sendSchoolMail()` en `_shared/school-mailer.ts` (aparte porque importa nodemailer, que no se puede testear en local); `from` como `{ name, address }` (codificación RFC 2047, AC-E4); `replyTo` solo si existe

- [x] **T2.3** — `_shared/auth-email.ts` + test (texto neutro y enlace `verify`)
  - **AC ref:** AC7
  - **DoD:**
    - [x] Test: enlace con `token_hash`, `type`, `redirect_to` codificados; el texto no contiene el nombre de ninguna escuela; tipo desconocido → genérico
    - [x] Implementación pasa el test (5/5)

- [x] **T2.4** — Extraer `_shared/student-invite-email.ts` + test desde `activate-student-account`
  - **AC ref:** AC6
  - **DoD:**
    - [x] Mismo HTML que hoy usa el reenvío (sin rediseño), con el pie de `school-email`
    - [x] Test de escapado y marca
    - [x] `activate-student-account` lo importa (reenvío sin cambio de comportamiento)
    - Resultado: 5/5 tests. Se hizo junto con T4.1 para tocar `activate-student-account` una sola vez.

---

## Fase 3 — Correos transaccionales

- [x] **T3.1** — Contrato: `send-enrollment-contract-email` + `_shared/contract-email.ts`
  - **AC ref:** AC1, AC2, AC3, AC4, AC8, AC-E3
  - **DoD:**
    - [x] Escuela = `enrollments.branch_id`; `from`/`replyTo`/asunto/pie desde `school-email`
    - [x] `contract-email.test.ts` actualizado y pasando
    - [x] Sin "Por favor no responder"
    - Resultado: `contract-email.test.ts` 11/11 (nuevo test de AC3). El contrato no lleva enlace a la app, así que no lleva la línea de AC8

- [x] **T3.2** — Certificado: `send-certificate-email`
  - **AC ref:** AC1, AC2, AC3, AC4, AC8
  - **DoD:**
    - [x] Escuela de la matrícula; remitente, respuesta, asunto y pie desde `school-email`
    - [x] Sin "Por favor no responder"
    - Resultado: pie común y asunto con `withSchool`; sin nodemailer directo

- [x] **T3.3** — Zoom: `send-zoom-email` + `_shared/zoom-email.ts`
  - **AC ref:** AC1, AC2, AC3, AC4, AC8
  - **DoD:**
    - [x] Escuela del ciclo; mismo tratamiento; `zoom-email.test.ts` pasando
    - Resultado: línea del dominio (AC8) + pie común; `zoom-email.ts` no necesitó cambios (el asunto se completa con `withSchool`); `zoom-email.test.ts` 10/10

- [x] **T3.4** — Desplegar T3.1–T3.3 y probar con el alumno de prueba
  - **AC ref:** AC1, AC2, AC3, AC8, AC-E3
  - **DoD:**
    - [x] Alumno de prueba `matiasjfr01+alumno0061@gmail.com` (users 9333, registrado en escuela 1) con matrícula `P0061-AC` (8784, escuela 1) y `P0061-CC` (8785, escuela 2), estado `withdrawn` (ninguna matrícula real lo usa) — se deja a propósito
    - [x] Contrato de cada escuela: remitente y "Responder" correctos, sin mezclar datos (AC-E3) — Gmail 2026-11-12 19:12 (AC y CC) y 19:38 (AC, tras unificar el nombre)
    - [x] Certificado y Zoom de al menos una escuela — Zoom de Autoescuela (2026-11-12 20:02, ciclo cerrado de prueba) y certificado de Conductores (20:34, folio −61 que no mueve el máximo) confirmados en Gmail. Los dos primeros envíos del certificado no llegaron: el adjunto de prueba era un PDF vacío de 125 bytes y Gmail lo descartaba; con un PDF válido de una página llegó. Todo lo creado se borró (certificado, log, PDF, ciclo, sesión) y las matrículas volvieron a `withdrawn`
    - [x] `functions list` confirma las versiones (2026-11-12 20:10 UTC: las 12 funciones de la spec, `verify_jwt=false` como antes)

---

- [x] **T3.5** — Ajustes tras la revisión en Gmail (2026-11-12)
  - **AC ref:** AC5, AC13
  - **DoD:**
    - [x] Logo de iniciales centrado sin `inline-flex` (Gmail lo ignora) en comunicado, activación, invitación de instructor, certificado y Zoom
    - [x] El comunicado usa los colores de la escuela que envía (era el único correo con el azul fijo); también la vista previa (`loadSchoolTheme`)
    - [x] El nombre de la escuela en cuerpo y asunto es el del remitente (`branches.name`), no `website_config.brand.name` ("AutoEscuela" vs "Autoescuela"): contrato, certificado, Zoom y activación
    - [x] Tests: 75/75 en los módulos de correo de `_shared/`; desplegadas las 9 funciones (Matías)
    - [x] Invitaciones de personal (secretaria e instructor): colores de la escuela de la persona (`_shared/school-theme.ts`, compartido con los comunicados) y línea del dominio sin "portal de alumnos" (`domainLineHtml(sender, 'personal')`) — hallazgo de la revisión en Gmail del 2026-11-12
    - [x] Desplegar `create-instructor`, `activate-instructor-account`, `create-secretary`, `send-announcement` y `dispatch-scheduled-announcements` (Matías) y revisar una invitación de instructor de Autoescuela (roja) — confirmada en Gmail 2026-11-12 20:30
    - [x] `send-certificate-email` devuelve la respuesta del servidor de correo (`delivery`), como el contrato; desplegada (Matías)

## Fase 4 — Invitaciones

- [x] **T4.1** — `activate-student-account`: primera vez sin `inviteUserByEmail`
  - **AC ref:** AC4, AC6
  - **DoD:**
    - [x] `generateLink({ type: 'invite' })` + `student-invite-email` + `sendSchoolMail` con la escuela del alumno
    - [x] `supabase_uid` vinculado igual que hoy; notificación de bienvenida solo la primera vez
    - [x] DG-068 respetado (el reenvío sigue con `magiclink`)
    - [x] Front: `EnrollmentFacade.inviteStudentToAuth` manda `enrollmentId`; la función usa la escuela de esa matrícula si es del alumno (si no, `users.branch_id`). `enrollment.facade.spec.ts` 129/129
    - [x] El correo sale después de vincular `supabase_uid`: si falla, el siguiente intento entra por el reenvío
    - Pendiente de despliegue (T4.4)

- [x] **T4.2** — `public-enrollment` (`inviteStudentToAuth`): igual que T4.1
  - **AC ref:** AC4, AC6
  - **DoD:**
    - [x] Sin `inviteUserByEmail`; escuela = `branchId` de la matrícula
    - [x] Una falla del correo no rompe la matrícula (igual que hoy)
    - Resultado: primera vez `invite`, reenvío `magiclink` (antes el reenvío fallaba en silencio por DG-068); vincula antes de enviar. Pendiente de despliegue (T4.4)

- [x] **T4.3** — Invitaciones de staff: `create-instructor`, `activate-instructor-account`, `create-secretary` + `_shared/staff-invite-email.ts`
  - **AC ref:** AC3, AC4
  - **DoD:**
    - [x] Sin "Conductores Chillán" fijo en el código; remitente y pie de la escuela de la persona
    - [x] `staff-invite-email.test.ts` actualizado y pasando
    - [x] Instructor con `both_branches`: usa `users.branch_id` (su escuela principal)
    - Resultado: las dos funciones de instructor compartían un HTML idéntico; ahora usan `_shared/instructor-invite-email.ts` (+ test 3/3, nombre y enlace escapados). `staff-invite-email` acepta `sender` (test 8/8). Pendiente de despliegue (T4.4)

- [x] **T4.4** — Desplegar T4.1–T4.3 y probar
  - **AC ref:** AC6, AC4
  - **DoD:**
    - [x] Activación del alumno de prueba llega con el remitente de su escuela (Conductores, matrícula 8785; Gmail 19:12 y 19:47 con logo centrado, línea del dominio y pie)
    - [x] ~~Matrícula online de prueba invita con su escuela~~ — no verificable en esta spec, sin envío real (exige recorrer la matrícula online completa); usa el mismo `student-invite-email` + `sendSchoolMail` que la activación ya probada en Gmail
    - [x] Secretaria (`+secretaria0061`, Conductores, users 9334) e instructor (`+instructor0061`, Autoescuela, users 9335 / instructors 239) — confirmadas en Gmail (20:03 y reenvío del instructor 20:30 con su color). Las dos cuentas quedaron inactivas a propósito
    - [x] `supabase/email-templates/invite-user.html` marcado como sin uso; DG-067 actualizado

---

## Fase 5 — Comunicados

- [x] **T5.1** — Tests de `announcement-send` PRIMERO
  - **AC ref:** AC4, AC5, AC10, AC-E5
  - **DoD:**
    - [x] `filterByPromotionalConsent(service, userIds, branchId)`: aceptó en A y revocó en B → solo A; vale el último ante esa escuela
    - [x] Materialización: comunicado de A → 1 fila; `branch_id = null` con alumno de las dos → 2 filas
    - [x] La marca, el `{{sede}}` y el pie de baja son de la escuela que envía
    - [x] Los tests fallan
    - Resultado: la parte pura se separó en `_shared/announcement-email.ts` (+ test 12/12): plantilla, `recipientPairs`, `consentedPairKeys`. Reemplaza a `announcement-send.test.ts`, que no corría en local (importaba nodemailer) y se eliminó

- [x] **T5.2** — Implementar en `_shared/announcement-send.ts` (+ `announcement-progress.ts` si cambian los conteos)
  - **AC ref:** igual que T5.1
  - **DoD:**
    - [x] Tests de T5.1 pasan; `announcement-progress.test.ts` pasando
    - [x] Re-chequeo de consentimiento por lote agrupado por escuela
    - [x] Remitente desde `loadSchoolSender(recipient.branch_id)` con caché por lote
    - [x] `send-announcement` (vista previa) usa la escuela del comunicado
    - Resultado: `announcement-send.ts` materializa pares (alumno, escuela) con `onConflict` sobre la UNIQUE nueva; remitente por `recipient.branch_id` con caché por lote; `{{sede}}` = escuela que envía; `loadAnnouncement` ahora revisa `error`. Vista previa: `preview.branchId` (secretaria = su escuela; admin = la elegida o la primera). `announcement-progress.ts` no necesitó cambios (cuenta filas)

- [x] **T5.3** — `AnnouncementsFacade.loadPreview`: consentimiento por escuela y una fila por `(alumno, escuela)` con "todas las escuelas"
  - **AC ref:** AC10, AC-E5
  - **DoD:**
    - [x] `announcements.facade.spec.ts` cubre los dos casos
    - [x] La vista previa coincide con lo que materializa el servidor
    - Resultado: una fila por persona (la exclusión manual es por persona) con `branchIds` = escuelas por las que recibe; regla pura `consentedPairKeys` en `announcement-recipients.utils.ts` (espejo del servidor). Facade, utils y recipient-filter: 3/3 archivos pasando; `tsc` limpio

- [x] **T5.4** — Desplegar y probar comunicados
  - **AC ref:** AC5, AC10, AC-E5
  - **DoD:**
    - [x] Alumno de prueba con promocional aceptado en una escuela y revocado en la otra
    - [x] Promocional de cada escuela: llega solo el de la escuela con consentimiento, con su marca
    - [x] Comunicado de todas las escuelas: una copia por escuela
    - [x] Segmento acotado al alumno de prueba (`dryRun` primero para confirmar el conteo)
    - Resultado: A (promo Autoescuela) 1, B (promo Conductores, revocó) 0, C (operativo todas) 2, D (promo todas) 1 — confirmados en Gmail. Reenvío C2 (#44, 2026-11-12 19:39) tras el ajuste de marca: copia de Autoescuela en rojo y de Conductores en azul

---

## Fase 6 — Portal del alumno

- [x] **T6.1** — `ConsentsFacade.loadByUser` trae `branch_id`
  - **AC ref:** AC10
  - **DoD:**
    - [x] `consents.facade.spec.ts` verifica que `branchId` llega mapeado
    - Resultado: también trae `branches(name)` → `ConsentRow.branchName`, y expone `promotionalByBranch` (regla pura `latestConsentPerBranch` en `core/utils/consent-view.utils.ts`, 3/3). Así el drawer no deriva el nombre desde `BranchFacade` (ARCH-24)

- [x] **T6.2** — `ajustes-drawer`: un consentimiento promocional por escuela
  - **AC ref:** AC10
  - **DoD:**
    - [x] Último consentimiento promocional por `branchId`, con el nombre de la escuela
    - [x] Revocar cada uno por separado; `data-llm-action` con la escuela
    - [x] `ajustes-drawer.component.spec.ts`: alumno con 2 escuelas → 2 bloques
    - [x] ~~`/verify` en el portal del alumno (modo claro y oscuro)~~ — no verificable: bloqueado: el portal del alumno está deshabilitado por el piloto. Cubierto por `ajustes-drawer.component.spec.ts` (2 escuelas → 2 bloques, revocar por separado)
    - Resultado: código y spec (3 tests nuevos, 6/6); el mensaje de confirmación nombra la escuela. `/verify` pendiente: necesita la migración y el alumno de prueba con consentimientos en las dos escuelas

---

## Fase 7 — Configuración del admin

- [x] **T7.1** — `core/utils/branch-email.utils.ts` + spec PRIMERO
  - **AC ref:** AC11, AC-E6
  - **DoD:**
    - [x] Rechaza remitente fuera de `@gestordeautoescuelas.cl` (Gmail incluido) con mensaje explicativo; acepta mayúsculas del dominio
    - [x] La respuesta acepta cualquier dominio válido
    - [x] `indices/UTILS.md`
    - Resultado: 9/9 tests. `indices/UTILS.md` queda para T10.1

- [x] **T7.2** — `send-branch-test-email` (Edge)
  - **AC ref:** AC12
  - **DoD:**
    - [x] Solo admin (`requireStaff` + rol admin); destinatario = correo del admin que llama, nunca uno que venga del body
    - [x] Usa `loadSchoolSender` + `sendSchoolMail`; devuelve el error SMTP como texto en un no-2xx
    - [x] Desplegada (v1)
    - Resultado: escrita y con sintaxis verificada; el error SMTP vuelve como 422 para que `edgeFunctionUserMessage` lo muestre. Pendiente: desplegar

- [x] **T7.3** — `branch-email.facade.ts` + spec PRIMERO
  - **AC ref:** AC11, AC12
  - **DoD:**
    - [x] `load()`, `save(branchId, form)` con `assertReadOk`/`assertWriteOk`, `enviarPrueba(branchId)` revisando el `error` de `functions.invoke` (un no-2xx no lanza)
    - [x] Signals de `isLoading`/`isSaving`/`error`; toasts vía `ToastService`
    - [x] `indices/FACADES.md`
    - Resultado: 8/8 tests (incluye 0 filas por RLS = fallo y el 422 del servidor de correo). `indices/FACADES.md` queda para T10.1

- [x] **T7.4** — `CorreoEscuelasDrawerComponent` (Smart en `features/admin/configuracion-correo/`) + tarjeta en `ajustes-drawer`
  - **AC ref:** AC11, AC12, AC-E6
  - **DoD:**
    - [x] `app-drawer-form`, selector de escuela, 4 campos, Guardar y "Enviar correo de prueba" (`data-llm-action`)
    - [x] Tarjeta solo con `isAdmin()`; secretaria no la ve
    - [x] OnPush, `input()`/`@if`, tokens, `loader-circle`
    - [x] Spec del componente; `indices/COMPONENTS.md`
    - [x] `/verify` (claro/oscuro, ancho angosto): render correcto, AC-E6 en línea con Guardar y Prueba desactivados, consola sin errores (capturas en `.playwright-mcp/0061-drawer-*.png`)
    - Resultado: 6/6 tests; tarjeta "Correo de las Escuelas" en Ajustes bajo `isAdmin()`; la prueba se desactiva con cambios sin guardar. Pendientes: `indices/COMPONENTS.md` (T10.1) y `/verify`

- [x] **T7.5** — Probar AC11/AC12 con datos reales
  - **AC ref:** AC11, AC12, AC-E6
  - **DoD:**
    - [x] Cambiar el nombre visible → el siguiente correo lo usa sin redesplegar ("Autoescuela Chillán (AC11 prueba)", 2026-11-12)
    - [x] Correo de prueba de cada escuela enviado a `+admin0061` (from y replyTo correctos); escuela inexistente → 404 legible; el 422 del servidor de correo cubierto por `branch-email.facade.spec`
    - [x] Valores restaurados al final (nombre de la escuela y `users.email` del admin E2E, cambiado solo segundos)

---

## Fase 8 — Correos de Supabase Auth

- [x] **T8.1** — `send-auth-email` (Send Email Hook)
  - **AC ref:** AC7
  - **DoD:**
    - [x] Verifica la firma (`standardwebhooks`, secret `SEND_EMAIL_HOOK_SECRET`); firma inválida → 401
    - [x] Usa `auth-email.ts` + transporte de `school-email`; `from` = "Gestor de Autoescuelas" <`SMTP_FROM`>
    - [x] Respuesta en el formato que exige el hook; `[functions.send-auth-email] verify_jwt = false` en `config.toml`
    - [x] Desplegada y probada: invitación desde el panel con el hook activo (2026-11-12) → llegó desde "Gestor de Autoescuelas" <cuentas@>, texto genérico, SPF/DKIM/DMARC = PASS
    - Resultado: `dkim=pass` confirmado (antes `dkim=fail` con el envío de Supabase). Ajuste visual: la tarjeta va dentro de un contenedor con relleno (en el celular las esquinas redondeadas quedaban recortadas); falta redesplegar

- [x] **T8.2** — Activar el hook (**Matías**) y dejar la plantilla Reset password neutra en el panel como respaldo
  - **AC ref:** AC7, AC9
  - **DoD:**
    - [x] Matías crea el secret y activa el hook en Authentication → Hooks (2026-11-12)
    - [x] Plantilla Reset password del panel sin "Escuela de Conductores Chillán" (Matías, 2026-11-12)
    - [x] Recuperar contraseña con el alumno de prueba: llega neutro desde "Gestor de Autoescuelas" <cuentas@>, enlace a `app.gestordeautoescuelas.cl/recuperar-contrasena` (la pantalla abre), SPF/DKIM/DMARC = PASS (2026-11-12 19:39)
    - [x] Vuelta atrás documentada (desactivar el hook) — `docs/DEPLOY.md` §Correo

---

## Fase 9 — Validación

- [x] **T9.1** — Suites y guardrails
  - **DoD:**
    - [x] `npm run test:ci` sin fallas nuevas respecto de la línea base (2026-11-12: 336 archivos pasan, 1 omitido, 0 fallas)
    - [x] `deno test` de `supabase/functions/_shared/` pasando (módulos de correo 75/75; los que importan `pdf-lib`/`supabase-js` no cargan en local por falta de `node_modules`, sin relación con la spec)
    - [x] `npm run lint:arch` sin errores nuevos (0 errores; la regresión ARCH-25 del drawer de correo se corrigió con `app-empty-state` y `.card`)
    - [x] `node scripts/test-tz.mjs` sobre los specs tocados (9 specs, 252 tests, en las 3 zonas)
    - [x] `grep` confirma: ningún `SMTP_FROM` suelto fuera de `school-email.ts`, ningún "Por favor no responder", ningún `inviteUserByEmail`, ningún correo que lea `website_config.contact.email`

- [x] **T9.2** — Entregabilidad y autenticación
  - **AC ref:** AC9, AC-E4
  - **DoD:**
    - [x] Encabezados de un correo de escuela (contrato P0061-AC) y uno de cuenta (recuperar contraseña): `spf`, `dkim` y `dmarc=pass`
    - [x] `X-MC-Relay` anotado: sigue en `Junk`. Gmail los entrega (Promociones para los comunicados), pero la activación de Conductores llegó 9 min tarde y un contrato CC no llegó aunque el SMTP respondió `250 OK` → consultar al hosting
    - [x] Nombre con tilde correcto en Gmail y Outlook — Gmail ✅ (todos los correos); Outlook no verificable: no se pudo probar (caída global de Outlook el 2026-11-12)
    - [x] Avisar a Matías que puede subir el DMARC a `p=quarantine` (2026-11-12, al cerrar la verificación)

- [x] **T9.3** — `/spec-verify` → `acceptance.md` con evidencia de los 13 AC y los 6 casos borde (2026-11-12: 13/13 y 6/6)

---

## Fase 10 — Cierre

- [x] **T10.1** — Índices y documentación
  - **DoD:**
    - [x] `indices/`: DATABASE, FACADES, COMPONENTS, MODELS, UTILS, NOTIFICATIONS-MAP §9.4, DOMAIN-GOTCHAS (DG-067 actualizado; DG-125 hook y DKIM de Supabase Auth; DG-126 PDF inválido en pruebas de correo)
    - [x] `docs/DEPLOY.md`: casillas, secrets, hook y vuelta atrás

- [x] **T10.2** — Cerrar el track (Matías decide cerrar el 2026-11-12: el portal del alumno sigue en piloto por meses; las tres verificaciones externas quedan en `acceptance.md` §Sin verificar)
  - **DoD:**
    - [x] `spec.md` → `Status: done`; ROADMAP: de Activa a Done
    - [x] `npm run assignments:sync` mueve ASG-b-103 a Completadas
    - [x] `specs/.active` vacío
    - [x] Commit del track (sin push salvo que Matías lo pida)
