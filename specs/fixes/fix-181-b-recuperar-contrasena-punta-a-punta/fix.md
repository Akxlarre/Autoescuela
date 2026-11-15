# Fix: Recuperar contraseña no permite fijar una clave nueva
> id: fix-181-b-recuperar-contrasena-punta-a-punta
> refs: ASG-i-044 (parte 2 de 2: recuperar contraseña. La parte 1 fue fix-180-b-usuarios-desactivados-siguen-entrando)
> status: done
> closed: 2026-11-15
> created: 2026-10-05

## Root Cause
[Heredado de ASG-i-044, confirmado leyendo el código el 2026-10-05.] El login ya tiene un modo
"recuperar" que llama `resetPasswordForEmail(email)`, pero el flujo se corta ahí:

1. **Sin `redirectTo`** (`supabase.service.ts`): el link del correo vuelve a la *Site URL* del
   proyecto, no a una pantalla de la app.
2. **Nadie escucha `PASSWORD_RECOVERY`** (`auth.facade.ts`): Supabase abre una sesión con el link y
   la app la trata como un login normal → el usuario entra **sin fijar una clave nueva**.
3. **`/recuperar-contrasena` es un stub** ("PLANO") y además tiene `guestGuard`, que manda a `/app` a
   cualquiera con sesión — justo lo que abre el link.

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-044). ACs propios:

- **F1 — Link con destino:** el correo de recuperación se pide con
  `redirectTo = <origen de la app>/recuperar-contrasena`.
- **F2 — Sesión de recuperación detectada:** cuando Supabase emite `PASSWORD_RECOVERY`, `AuthFacade`
  marca `passwordRecovery() = true` y navega a `/recuperar-contrasena`.
- **F3 — No se entra sin fijar clave:** mientras `passwordRecovery()` sea `true`, `authGuard` manda
  cualquier ruta de `/app` a `/recuperar-contrasena`.
- **F4 — Pantalla de nueva clave:** `/recuperar-contrasena` muestra el formulario de nueva contraseña
  (mismo componente que el primer login, con textos de recuperación). Guardar actualiza la clave,
  apaga `passwordRecovery()` y entra a `/app`.
- **F5 — Link vencido o acceso directo:** sin sesión de recuperación, `/recuperar-contrasena`
  redirige a `/login` (donde está el modo "recuperar" para pedir otro link).

## Cambio
- `core/services/infrastructure/supabase.service.ts` — `resetPasswordForEmail(email, redirectTo)`.
- `core/facades/auth.facade.ts` (+ spec) — signal `passwordRecovery`, manejo de
  `PASSWORD_RECOVERY`, `redirectTo`, `completePasswordRecovery()`.
- `core/guards/password-recovery.guard.ts` (+ spec) — F5. `core/guards/auth.guard.ts` (+ spec) — F3.
- `app.routes.ts` — `/recuperar-contrasena` carga `ForcePasswordChangeComponent` con
  `data: { mode: 'recovery' }` y `passwordRecoveryGuard` (sale `guestGuard`).
- `features/auth/force-password-change/force-password-change.component.ts` — modo `recovery`
  (textos + acción). Se elimina el stub `features/auth/recuperar-contrasena/`.
- **Config remota (owner):** agregar `<dominio de la app>/recuperar-contrasena` a *Auth → URL
  Configuration → Redirect URLs* en Supabase. Sin eso el link cae en la Site URL; F2 lo cubre igual
  (navega a la pantalla), pero conviene registrarla.

## Test de Regresión
- `npx vitest run src/app/core/facades/auth.facade.spec.ts src/app/core/guards` — F1, F2, F3, F5, F10.
- `npx vitest run src/app/core/utils/auth-link-error.utils.spec.ts src/app/core/guards/password-recovery.guard.spec.ts src/app/features/auth/login/login.component.spec.ts src/app/features/auth/force-password-change src/app/core/services/ui/toast.service.spec.ts`
  — F6, F7, F8, F9.
- Build (`ng build`) para el componente y la ruta (F4); verificación visual con `/verify` si hay
  servidor disponible.

## Resultado (2026-10-05)

- **Tests:** `vitest` auth.facade + guards + auth-errors → 41 passed (TDD: los 7 casos nuevos
  fallaron antes de implementar). F1 `redirectTo`, F2 `PASSWORD_RECOVERY`, F3 `authGuard`, F5
  `passwordRecoveryGuard`, más `completePasswordRecovery` con éxito/error y `SIGNED_OUT`.
- **Build:** `ng build` OK. **`lint:arch`:** exit 0.
- **F4 (pantalla):** el componente reutiliza el formulario y estilos del primer login; solo cambian
  textos, ícono (`shield-check`, ya registrado) y la acción. No se verificó en navegador: la ruta
  exige una sesión de recuperación real (link de correo). Queda para la prueba manual de abajo.

## Progreso
- [x] Código + tests + build
- [x] **Owner:** confirmar en Supabase → Auth → URL Configuration: *Site URL* =
      `https://app.gestordeautoescuelas.cl` y *Redirect URLs* con
      `https://app.gestordeautoescuelas.cl/recuperar-contrasena` (manteniendo
      `http://localhost:4200/**` para los tests). El dominio definitivo existe desde 2026-11-06
      (hotfix-173-b): el bloqueo de abajo ya no aplica. Probado por la prueba del 2026-11-14: el
      enlace volvió al dominio nuevo.
- [x] Prueba manual en producción: pedir "recuperar contraseña" con una cuenta de prueba con correo
      real → abrir el link → fijar clave → entrar con la clave nueva. ✅ 2026-11-14, más D08.
- [x] F6, F7, F8: código + tests + build (2026-11-14).
- [x] F9: código + tests + build (2026-11-14).
- [x] Release con F6–F9. Tercera prueba del owner (2026-11-15): D07 sin y con sesión ✅, L05 ✅
      (ver abajo).
- [x] F10: código + tests + build (2026-11-15). PR #414.
- [x] Release con F10.
- [x] **Owner**, en producción después del release: F10 y D10 pasan (2026-11-15, ver "Cuarta
      prueba").

## Estado al retomar (2026-11-14)

- **El correo ya no lo manda Supabase:** desde la spec `0061-b` (2026-11-12) lo arma el Send Email
  Hook `send-auth-email`, desde `cuentas@gestordeautoescuelas.cl` con remitente "Gestor de
  Autoescuelas" y texto neutro. El enlace es el estándar de Supabase
  (`<SUPABASE_URL>/auth/v1/verify?token=…&type=recovery&redirect_to=…`, en
  `_shared/auth-email.ts`), con el `redirect_to` que pide la app (F1). La app no cambió: cliente con
  flujo implícito y `detectSessionInUrl`, así que el evento `PASSWORD_RECOVERY` (F2) llega igual.
- **D05 cumplido** por la AC7/AC9 de `0061-b`: "Restablece tu contraseña" en español, remitente
  reconocible, enlace a `https://app.gestordeautoescuelas.cl/recuperar-contrasena`, SPF, DKIM y
  DMARC en PASS.
- **Producción (`auth.users`, 2026-11-12):** dos cuentas pidieron el correo, abrieron el enlace y
  quedaron con sesión (el token se consumió y `last_sign_in_at` es posterior al envío). Una tercera
  dejó el enlace sin usar. La base no distingue si después se fijó la clave nueva: eso queda para
  la prueba manual.

## Prueba manual en producción (owner, 2026-11-14)

- ✅ Pedir el correo, abrir el enlace, fijar la clave y entrar con ella (F1–F4): el correo llegó
  desde `cuentas@` al instante, el enlace abrió "Crea una contraseña nueva" en
  `app.gestordeautoescuelas.cl/recuperar-contrasena`, la clave cambió y la sesión entró. Con eso
  queda probado también que la Redirect URL del dominio nuevo está permitida (si no, Supabase
  habría vuelto a la Site URL).
- ✅ **D08:** el segundo pedido seguido muestra "Demasiados intentos. Por favor, intenta de nuevo
  más tarde."
- ❌ **D07:** abrir de nuevo el enlace ya usado lleva al login **sin ningún aviso**. Causa:
  Supabase vuelve a la app con `#error=access_denied&error_code=otp_expired`, supabase-js no crea
  sesión (tampoco borra el error de la URL) y `passwordRecoveryGuard` manda a `/login` sin
  explicar por qué → **F6**.
- ❌ **Nuevo (visual):** en la pantalla de nueva clave el ícono del escudo y la marca del producto
  quedan en la misma línea y se pisan. `app-product-brand` es `inline-flex` (fix-242-b) y quedó
  al lado del cuadro del ícono, que también es `inline-flex` → **F8**.
- ⏳ **D10** y **L05:** no probados todavía. D10 falla por código: la pantalla no dice de qué
  cuenta es la clave → **F7**.

### ACs agregados tras la prueba

- **F6 — Enlace vencido o ya usado:** si `/recuperar-contrasena` llega sin sesión de recuperación
  y con un error de Supabase en la URL, el login abre en modo "recuperar" con el aviso "El enlace
  para restablecer tu contraseña venció o ya se usó. Pide uno nuevo con tu correo." (o "no es
  válido" para otro error). Sin error en la URL (acceso directo) sigue F5: login sin aviso.
- **F7 — Se ve de qué cuenta es:** la pantalla de nueva clave (recuperación y primer ingreso)
  muestra el correo de la cuenta con sesión, así quien abrió el enlace con otra cuenta lo nota y
  puede usar "Cerrar sesión".
- **F8 — Encabezado sin choques:** la marca va en su propia línea, arriba, como en el login; el
  cuadro del ícono y el título debajo. Igual en primer ingreso.

### Implementado (2026-11-14, rama `fix/181-b-recuperar-contrasena-cierre`)

- **F6:** `core/utils/auth-link-error.utils.ts` lee el error de la URL (`otp_expired` → `vencido`,
  cualquier otro → `invalido`); `passwordRecoveryGuard` manda a `/login?enlace=…`;
  `LoginComponent` abre en "recuperar" con el aviso. `app-login-card` colapsaba en
  `afterNextRender` cualquier mensaje inicial (su `effect` solo anima cambios): ahora un mensaje que
  ya viene puesto se deja visible.
- **F7:** `ForcePasswordChangeComponent.accountEmail` (`computed` sobre `currentUser().email`) y
  la línea "Cuenta: …" bajo el subtítulo, en los dos modos.
- **F8:** la marca va en un bloque propio arriba del ícono, tamaño del login.
- Tests: `auth-link-error.utils.spec.ts` (7), `password-recovery.guard.spec.ts` (5),
  `login.component.spec.ts` (+4), `force-password-change.component.spec.ts` (4, nuevo).
- Falta para cerrar: release y que el owner repita en producción D07 (abrir el enlace ya usado),
  D10 (abrir el enlace con otra cuenta logueada) y L05.

### Segunda prueba en producción (owner, 2026-11-14, con el código de `v0.2.x`, sin F6–F8)

Reportado: "la segunda vez que apreté el enlace me llevó al módulo no disponible" y "con otra
cuenta que estaba abierta, entró a esa cuenta, a su inicio". Los logs de Auth (hora Chile) muestran
que las dos fueron **el mismo enlace ya usado, con una sesión abierta**:

| Hora | Evento |
|---|---|
| 22:02:51 | `/recover` de la cuenta de prueba (rol alumno) |
| 22:03:12 | `/verify` OK → sesión de recuperación |
| 22:03:46 | `PUT /user` → clave nueva guardada |
| 22:03:54 y 22:04:02 | `/verify` → 403 "One-time token not found" (mismo enlace) |
| 22:04:06 | logout del alumno |
| 22:05:14 | login con contraseña de `admin@test.com` |
| 22:05:25 | `/verify` → 403 otra vez (mismo enlace, con el admin adentro) |

Causa: cuando el enlace falla, supabase-js **conserva la sesión que había**
(`GoTrueClient._initialize`: "A failed attempt shouldn't invalidate a valid session"). El guard
mandaba a `/login`, `guestGuard` veía esa sesión y la rebotaba a `/app`: el alumno caía en
"Módulo no disponible" (su portal está cerrado en el piloto, `pilotPhaseGuard('alumno')`) y el
admin en su dashboard, sin saber que el enlace no sirvió. F6 tal como estaba no lo cubría: el
`?enlace=vencido` se perdía en el mismo rebote.

D10 de verdad (enlace **nuevo** con otra cuenta abierta) no se probó. Por el código, Supabase
reemplaza la sesión por la de la cuenta del enlace y la pantalla muestra "Cuenta: …" (F7).

- **F9 — Enlace vencido o usado con una sesión abierta:** el guard lleva a `/app` (el inicio de
  esa cuenta) con un toast de 9 s: "El enlace venció o ya se usó" / "No se cambió ninguna
  contraseña. Sigues con la sesión de *correo*; para cambiar la de otra cuenta, cierra sesión y
  pide un enlace nuevo." La condición "hay sesión que entra a /app" es la misma de `guestGuard`
  (`landsInApp`, exportada de `guest.guard.ts`), así que nunca se manda a `/login` un aviso que
  ese guard va a rebotar.
  - Implementado: `authLinkErrorSessionNotice` (util), `ToastService.warning(…, life)`,
    `passwordRecoveryGuard`. Tests: util (+3), guard (+3), toast (+1). Salió en PR #413.

### Tercera prueba en producción (owner, 2026-11-15, con F6–F9 publicados)

Logs de Auth (UTC; hora Chile = UTC − 3) y `auth.sessions` de la cuenta de prueba:

| UTC | Evento |
|---|---|
| 03:51:19 → 03:51:34 | enlace nuevo, `/verify` OK → sesión de recuperación |
| 03:52:59 | logout **sin** `PUT /user`: cambió la URL a mano, entró al inicio y cerró sesión |
| 03:53:03 | mismo enlace sin sesión → 403 (D07 sin sesión) |
| 03:53:11 → 03:53:38 | login `admin@test.com` + mismo enlace dos veces → 403 (D07 con sesión) |
| 03:54:19 → 03:54:26 | login de la cuenta de prueba + mismo enlace → 403 (D07 con sesión, alumno) |
| 03:55:43 → 03:56:03 | login de la cuenta de prueba + enlace nuevo → OK (enlace con la misma cuenta abierta) |
| 03:57:55 | login de la cuenta de prueba en el teléfono |
| 03:58:25 → 03:58:55 | enlace nuevo en el laptop, `PUT /user` → clave cambiada |
| 04:00:30 | `POST /logout` → 403 `session_not_found`: la sesión del teléfono ya no existía |

- ✅ **D07 sin sesión:** aviso en el login (F6).
- ✅ **D07 con sesión:** inicio de la cuenta + toast que la nombra (F9), con admin y con alumno
  (este cae en "Módulo no disponible" por el piloto, con el toast encima).
- ✅ **Enlace nuevo con la misma cuenta abierta:** abre la pantalla de nueva clave. Las otras
  pestañas del mismo navegador también saltan a ella: supabase-js reparte `PASSWORD_RECOVERY`
  entre pestañas y todas comparten la sesión del enlace. Es lo correcto.
- ✅ **L05:** al cambiar la clave, Supabase borra las demás sesiones de la cuenta (en
  `auth.sessions` queda solo la del enlace). El teléfono **no lo nota en el momento**: su token de
  acceso sigue valiendo hasta que vence (1 h salvo que se haya cambiado en Supabase) o hasta que habla con Auth (el logout de
  las 04:00:30 respondió `session_not_found`). Al intentar renovarlo, supabase-js cierra la sesión.
- ❌ **Nuevo — F10:** en la pantalla de nueva clave, escribir otra URL (o recargar) dejaba entrar
  sin fijar la clave. `passwordRecovery()` era un signal en memoria: la recarga lo devolvía a
  `false` y la sesión del enlace, guardada por supabase-js, era una sesión normal. F3 solo valía
  mientras no se recargara la página.

- **F10 — La recuperación sobrevive a recargar:** mientras no se fije la clave, recargar o
  escribir cualquier URL de `/app` vuelve a `/recuperar-contrasena`. Se guarda el id de Auth de la
  cuenta en `localStorage` (`PASSWORD_RECOVERY_MARK_KEY`, donde vive la sesión) al recibir
  `PASSWORD_RECOVERY`; en `INITIAL_SESSION` se retoma solo si coincide con la cuenta con sesión
  (si no, o sin sesión, se borra); se borra al fijar la clave y en `SIGNED_OUT`.
  - Implementado: `AuthFacade` (`restorePasswordRecovery`, `readRecoveryMark`,
    `writeRecoveryMark`). Tests: `auth.facade.spec.ts` (+7; 5 fallaban antes de implementar).
    Salió en PR #414.

### Cuarta prueba en producción (owner, 2026-11-15, con F10 publicado)

El owner reporta que todo pasa. Los logs de Auth coinciden (UTC):

| UTC | Evento |
|---|---|
| 04:17:09 | login de `admin@test.com` |
| 04:32:19 → 04:32:29 | enlace nuevo de la cuenta de prueba, `/verify` OK con el admin logueado |
| 04:33:00 | logout de la cuenta de prueba **sin** `PUT /user`: no se fijó clave y no entró a la app |
| 04:33:25 → 04:34:03 | otro enlace nuevo, `/verify` OK, `PUT /user` → clave cambiada |
| 04:34:09 | `POST /logout` → 403 `session_not_found` de otra sesión de la cuenta (L05 otra vez) |

- ✅ **F10:** con la sesión del enlace, cambiar la URL o recargar se queda en la pantalla de nueva
  clave.
- ✅ **D10:** el enlace abierto con otra cuenta logueada muestra "Cuenta: …" con la cuenta del
  enlace (F7).

Con esto quedan cumplidos F1–F10 y los casos heredados D05, D07, D08, D10 y L05.

## Bloqueo (2026-10-16) — superado el 2026-11-06 con el dominio definitivo
Revisado: el código salió en los releases (producción en `v0.2.1`, `/recuperar-contrasena` responde)
y `disable_signup = true`. Pero Supabase Auth sigue con **Site URL = `http://localhost:4200`** y
redirects solo a localhost → en producción el link del correo abre localhost. **Decisión del owner:
no cambiarlo hasta tener el dominio definitivo** (`app.autoescuelachillan.cl` es provisional).
Al tenerlo: Site URL = `https://<dominio>`, redirects `https://<dominio>/**` (manteniendo
`http://localhost:4200/**` para los tests), y la prueba manual de punta a punta de arriba.

## Casos heredados de `fix-183-b` (2026-10-29)

Del checklist `specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md`, a probar en la misma
pasada manual de punta a punta, cuando exista el dominio:
- **D05** el correo llega en español, con remitente reconocible y enlace al dominio (no a localhost).
  ✅ Cumplido por `0061-b` (ver "Estado al retomar").
- **D07** abrir el enlace dos veces o uno viejo → "enlace vencido o usado", no pantalla en blanco.
- **D08** pedir dos correos seguidos → aviso claro de esperar.
- **D10** abrir el enlace con otra cuenta logueada en ese navegador → queda claro con qué cuenta se está.
- **L05** recuperar la clave en un equipo con la sesión abierta en otro → anotar si la otra se cierra.
