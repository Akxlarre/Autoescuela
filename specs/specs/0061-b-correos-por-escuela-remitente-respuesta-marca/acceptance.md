# Acceptance 0061-b — Correos por escuela: remitente, respuesta y marca

> **Spec:** [spec.md](./spec.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verificado:** 2026-11-12, con envíos reales a alias de prueba (`matiasjfr01+alumno0061`,
> `+admin0061`, `+secretaria0061`, `+instructor0061`) revisados por Matías en Gmail.
> **Resultado:** 13/13 AC y 6/6 casos borde cumplidos. Dos verificaciones quedan sin hacer por
> causas externas (ver §Sin verificar).

## Datos de prueba

- Alumno `matiasjfr01+alumno0061@gmail.com` (users 9333), matrícula `P0061-AC` (8784, Autoescuela
  Chillán) y `P0061-CC` (8785, Conductores Chillán), estado `withdrawn` para que ningún segmento real
  lo incluya. Promociones aceptadas ante Autoescuela y revocadas ante Conductores. Se deja a propósito.
- Secretaria (users 9334, Conductores) e instructor (users 9335 / instructors 239, Autoescuela) de
  prueba: creados para la invitación real y **desactivados** enseguida. Se dejan inactivos a propósito.
- Certificado (folio −61, que no mueve el máximo), ciclo y sesión de Zoom: creados solo para el envío
  y **borrados** después, junto con su registro en `certificate_issuance_log` y el PDF del bucket.

## Criterios

| AC | Resultado | Evidencia |
|---|---|---|
| **AC1** Remitente por escuela | ✅ | Gmail: contrato P0061-AC "Autoescuela Chillán" `<autoescuela-chillan@…>`; contrato P0061-CC, activación y certificado "Conductores Chillán" `<conductores-chillan@…>`; Zoom de Autoescuela con su remitente |
| **AC2** Las respuestas llegan a la escuela | ✅ | Encabezado `Reply-To: otecchillan@gmail.com` en el contrato de Autoescuela. "Responder" en el correo de prueba de cada escuela propone `otecchillan@gmail.com` y `conductorchillan@gmail.com` |
| **AC3** Asunto y pie con la escuela | ✅ | Asuntos "… — Autoescuela Chillán" / "… — Conductores Chillán". Pie "Enviado por [escuela] mediante Gestor de Autoescuelas" con teléfono y correo de respuesta, sin "Por favor no responder" (contrato, certificado, Zoom, activación, invitaciones, comunicados, correo de prueba). `grep`: ningún "Por favor no responder" en `supabase/functions` |
| **AC4** Regla de marca | ✅ | Contrato y certificado → escuela de la matrícula; Zoom → escuela del ciclo; comunicado → escuela que envía; invitación de secretaria e instructor → escuela de la persona; activación → escuela de la matrícula (P0061-CC, alumno registrado en Autoescuela → salió por Conductores) |
| **AC5** Comunicado a un alumno de las dos escuelas | ✅ | Comunicado de Autoescuela (#44, copia de la escuela 1): remitente, colores rojos, logo, pie y `{{sede}}` de Autoescuela. La marca usa el tema de la escuela que envía (`_shared/school-theme.ts`) |
| **AC6** Primera invitación del alumno por escuela | ✅ | "Activa tu cuenta — Conductores Chillán" desde `conductores-chillan@…` con la plantilla propia (no la de Supabase Auth). Ningún `inviteUserByEmail` en el código (`grep`) |
| **AC7** Correos de cuenta neutros | ✅ | "Restablece tu contraseña" desde "Gestor de Autoescuelas" `<cuentas@…>`, sin nombre de escuela, enlace a `https://app.gestordeautoescuelas.cl/recuperar-contrasena` (la pantalla abre) |
| **AC8** Línea que explica el dominio | ✅ | Activación y Zoom: "El portal de alumnos de [escuela] funciona en app.gestordeautoescuelas.cl". Invitaciones de personal: "La plataforma de [escuela] funciona en…". El contrato y el certificado no llevan enlace a la app, así que no llevan la línea |
| **AC9** Autenticación del dominio | ✅ | Contrato P0061-AC: `spf=pass`, `dkim=pass header.i=@gestordeautoescuelas.cl`, `dmarc=pass`. Recuperar contraseña: SPF, DKIM y DMARC = PASS |
| **AC10** Consentimiento promocional por escuela | ✅ | Promocional de Autoescuela: 1 destinatario (llegó). Promocional de Conductores: 0 (revocó ante esa escuela; no llegó). Promocional de todas las escuelas: 1, solo por Autoescuela. Portal: `ajustes-drawer.component.spec.ts` (2 escuelas → 2 bloques, revocar cada uno por separado) |
| **AC11** El admin configura el correo | ✅ | Drawer "Correo de las Escuelas" (`/verify` claro, oscuro y angosto). Cambio del nombre visible a "Autoescuela Chillán (AC11 prueba)" → el correo siguiente lo usó sin redesplegar (restaurado después). La secretaria no ve la tarjeta (`isAdmin()`) y la RLS `update_branches` es solo admin |
| **AC12** Correo de prueba | ✅ | Prueba de cada escuela recibida en `+admin0061` con su remitente, respuesta y pie. Escuela inexistente → 404 legible; error del servidor de correo → 422 mostrado en pantalla (`branch-email.facade.spec.ts`) |
| **AC13** Un solo correo de contacto | ✅ | Respuesta, pie y pie de baja usan `branches.email` (`_shared/school-email.ts`). Ningún correo lee `website_config.contact.email` (`grep`). El nombre de la escuela en cuerpo y asunto también sale de `branches.name`: antes el contrato decía "AutoEscuela" (de la web) y el pie "Autoescuela" |
| **AC-E1** Escuela sin correo de respuesta | ✅ | `school-email.test.ts`: sin `Reply-To` y el pie no invita a responder |
| **AC-E2** Escuela sin dirección de envío | ✅ | `school-email.test.ts`: sale desde la dirección neutra con el nombre de la escuela; `loadSchoolSender` nunca lanza |
| **AC-E3** Alumno de las dos escuelas, matrícula | ✅ | Contrato P0061-AC (rojo, Autoescuela) y P0061-CC (azul, Conductores), cada uno con sus datos, sin mezclar |
| **AC-E4** Nombres con tildes y signos | ✅ (Gmail) | "Autoescuela Chillán" y "Conductores Chillán" correctos en Gmail (`From: =?UTF-8?Q?Autoescuela_Chill=C3=A1n?=`). Outlook: ver §Sin verificar |
| **AC-E5** Comunicado de todas las escuelas | ✅ | Operativo de todas: 2 copias (#44: `branch_id` 1 y 2, las dos `email_sent_ok`), cada una con el remitente y los colores de su escuela |
| **AC-E6** Dirección fuera del dominio | ✅ | Una dirección de Gmail muestra el error y desactiva Guardar (`/verify`, `branch-email.utils.spec.ts`); CHECK `branches_email_sender_domain_chk` en la BD |

## Hallazgos de la revisión en Gmail (corregidos en esta spec)

- El logo de iniciales salía descentrado: Gmail ignora `display: inline-flex`. Ahora se centra con
  `line-height` en los 5 correos que lo tienen.
- El comunicado y las invitaciones de personal salían siempre en azul. Ahora usan el tema de la escuela.
- Las invitaciones de personal decían "portal de alumnos".
- `send-certificate-email` ahora devuelve la respuesta del servidor de correo, como el contrato
  (DG-126: un PDF de prueba inválido hacía que Gmail descartara el correo).

## Validación

- `npm run test:ci`: 336 archivos pasan, 0 fallas. `node scripts/test-tz.mjs` sobre los 9 specs
  tocados: verde en UTC, Asia/Tokyo y America/Santiago.
- `deno test` de los módulos de correo de `_shared/`: 78/78.
- `npm run lint:arch`: 0 errores.

## Sin verificar (causa externa)

- **Portal del alumno en el navegador (AC10, segunda parte)**: el portal está deshabilitado por el
  piloto. Lo cubren los tests del componente.
- **Outlook (AC-E4)**: caída global de Outlook el 2026-11-12. Gmail correcto.
- **Matrícula online con envío real (AC6)**: no se recorrió el formulario público completo. Usa el
  mismo `student-invite-email` + `sendSchoolMail` que la activación, verificada en Gmail.

## Para operar

- `X-MC-Relay: Junk` en los encabezados: el relé de MailChannels marca los correos del hosting. Gmail
  los entrega, pero una activación llegó 9 minutos tarde. Consultar al hosting.
- El DMARC puede subir a `p=quarantine`: los correos de escuela y los de cuenta pasan DKIM y DMARC.
