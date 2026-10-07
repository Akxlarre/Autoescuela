# Fix: La clave inicial de una secretaria nueva es su RUT
> id: fix-182-b-secretaria-clave-inicial-rut
> refs: ASG-i-044 (punto 3: clave inicial = RUT. Puntos 1 y 2 en fix-180-b y fix-181-b)
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
[Heredado de ASG-i-044, confirmado leyendo el código el 2026-10-05.] `create-secretary` crea la
cuenta de Auth con `password = cuerpo del RUT` (sin puntos ni dígito verificador). El RUT no es un
secreto: lo conocen compañeros, alumnos y aparece en documentos. Cualquiera que lo sepa puede entrar
como esa secretaria antes de que ella cambie la clave, y el cambio obligatorio (`first_login`) solo
lo exige el front (`force-password-change`).

Instructores y alumnos ya no tienen este problema: se crean **sin contraseña** y reciben un link de
activación (`generateLink` / `inviteUserByEmail`). Solo las secretarias quedaron con el patrón viejo.

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-044). ACs propios:

- **F1 — Sin clave conocida:** `create-secretary` crea la cuenta de Auth sin contraseña
  (`generateLink({ type: 'invite' })`), igual que `create-instructor`. El RUT deja de usarse como clave.
- **F2 — Correo de activación:** se envía a la secretaria un correo propio (SMTP) con el link para
  crear su contraseña. Si el envío falla, la cuenta queda creada y puede activarla con "recuperar
  contraseña" (fix-181-b).
- **F3 — Mensaje al admin:** el toast de éxito dice que se le envió un correo para activar la cuenta.
- **F4 — Rollback intacto:** si falla el INSERT en `users`, se borra la cuenta de Auth (como hoy).

## Cambio
- `supabase/functions/_shared/staff-invite-email.ts` (+ `.test.ts`) — HTML del correo (función
  pura, testeable con `deno test`) y envío SMTP.
- `supabase/functions/create-secretary/index.ts` — `generateLink` + correo en vez de
  `createUser({ password: RUT })`.
- `src/app/core/facades/secretarias.facade.ts` (+ spec) — texto del toast (F3).
- `create-instructor` no se toca (ya invita por link); unificar su plantilla con la compartida queda
  como follow-up.

## Test de Regresión
- `deno test supabase/functions/_shared/staff-invite-email.test.ts` — el HTML incluye nombre, link y
  rol, y escapa el nombre (no inyecta HTML).
- `npx vitest run src/app/core/facades/secretarias.facade.spec.ts` — F3.
- Prueba manual tras desplegar: crear una secretaria de prueba con un correo real → llega el correo
  → el link lleva a crear la contraseña → entra con ella.

## Resultado (2026-10-05)
- `deno test` del correo compartido → 4 passed (nombre, rol, link, sin mención de RUT/clave
  temporal, nombre escapado, link no-https rechazado).
- `vitest secretarias.facade.spec` → 5 passed (los 2 casos nuevos fallaron antes de implementar).
- `ng build` OK. `lint:arch` exit 0. `deno lint` sin problemas nuevos (solo las categorías de estilo
  que ya tiene todo `supabase/functions`).

## Progreso
- [x] Código + tests + build
- [x] Desplegada `create-secretary` (visto bueno del owner, 2026-10-05). Smoke test: sin usuario → 401, la función arranca con el import de nodemailer
- [x] **Hallazgo de la 1ª prueba manual (2026-10-05):** el RUT usado (`20.179.020-4`) ya era de un
      instructor (`users.rut` UNIQUE) → 500 y "error inesperado" en pantalla. La invitación se generó
      bien y el rollback borró cada cuenta de Auth (sin basura, sin correos). Corregido:
      `create-secretary` responde 409 "Ese RUT ya está registrado como <rol>" antes de crear la
      cuenta, y el facade muestra ese mensaje (en producción tras el próximo release del front).
      Redesplegada `create-secretary`.
- [x] **2ª prueba (2026-10-05):** secretaria creada; el correo "Activa tu cuenta de secretaria" llegó
      con nombre y link correctos (cayó en spam: entregabilidad SMTP, SPF/DKIM del remitente —
      ajeno a este fix). El link redirige a `http://localhost:4200` porque en Supabase Auth la Site
      URL y la allowlist son localhost y no existe el secret `SITE_URL` (configuración de dominio
      diferida por el owner, `docs/DEPLOY.md`). Afecta igual a instructores y alumnos.
- [x] Prueba manual (owner, 2026-10-05): 2ª secretaria de prueba → llegó el correo → con la app en
      `localhost:4200` (destino actual del link) creó su contraseña y entró. ✅ Cerrado → llega el correo → crea su
      contraseña → entra. (La cuenta de prueba se puede desactivar después con fix-180-b.)

## Cuenta ya existente
Hay 1 secretaria con `first_login = true` y cuenta de Auth (su clave sigue siendo el RUT). Este fix no
la toca: el admin debe pedirle que entre y cambie la clave, o que use "recuperar contraseña".
