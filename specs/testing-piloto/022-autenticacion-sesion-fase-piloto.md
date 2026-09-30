# Testing — Autenticación, sesión, roles y bloqueo de fase piloto

> **Asignación:** `ASG-i-022` · **Tanda:** testing profundo del piloto (2026-09-29) · **Estado:** borrador
> **Rutas:** `/login`, `/recuperar-contrasena`, `/force-password-change`, `/acceso-denegado`,
> `/modulo-no-disponible`, `/politica-privacidad/:branchSlug`, `/` y `/**` (404), `/app`
> (`roleRedirectGuard`), más **todas** las rutas bloqueadas por `pilotPhaseGuard` (se prueban solo
> por URL directa).
> **Incluye:** login, logout, sesión persistida y expirada, primer login, recuperar contraseña,
> guards (`authGuard`, `guestGuard`, `firstLoginGuard`, `hasRoleGuard`, `roleRedirectGuard`,
> `pilotPhaseGuard`, `professionalBranchGuard`, `enrollmentDraftGuard` solo como guard), menú
> lateral por rol, grant multi-sede en caliente (Realtime de `users`), 2 pestañas / 2 equipos.
> **No incluye:** los portales Instructor y Alumno por dentro (fuera del piloto; solo se prueba que
> estén bloqueados), el wizard de matrícula por dentro (ver `023-matricula-presencial.md`), el
> ABM de secretarias/instructores (ver `034-…`), salvo lo que afecta el login.
>
> **Código leído para armar esta lista:**
> `app.routes.ts`, `core/guards/*.ts` (los 8 guards), `core/config/pilot-phase.config.ts`,
> `core/facades/auth.facade.ts`, `core/facades/branch.facade.ts`,
> `core/services/infrastructure/{supabase,error-sanitizer}.service.ts`,
> `core/services/auth/menu-config.service.ts`, `core/utils/{auth-errors,professional-access,branch-scope}.utils.ts`,
> `features/auth/{login,force-password-change,recuperar-contrasena}/`,
> `shared/components/login-card/`, `shared/components/user-panel/`,
> `features/{acceso-denegado,modulo-no-disponible,not-found}/`, `features/legal/politica-privacidad/`,
> `layout/{app-shell,sidebar,topbar}.component.ts`,
> `features/{admin,secretaria}/alumnos-profesional/` + `shared/components/alumnos-profesional-list-content/`,
> `supabase/functions/{create-secretary,update-secretary}/`,
> `supabase/migrations/20260301000011_10_rls_policies.sql` (helpers RLS),
> `20260303000001_create_user_complete_first_login_rpc.sql`, `20260625120000_enable_realtime_users.sql`,
> `supabase/config.toml`, fixes `fix-255-m`, `fix-256-m`, `fix-260-m`, `fix-261-m`, `fix-041-i`,
> `hotfix-107-m`, `fix-171-b`, `docs/UAT-PLAN.md` Paquete 7.

## Cómo usar este documento

- Cada caso tiene una columna **Res.** para anotar ✅ / ❌ al ejecutarlo. Los ❌ se registran con
  evidencia (captura o descripción) en el `fix.md` del track de `ASG-i-022`, y **cada bug va a su
  propio fix/hotfix**.
- **Auto ✓** = candidato a automatizar con Playwright (`ASG-i-021`). La matriz de la sección G es
  la candidata número uno (parametrizada rol × ruta).
- Los casos marcados **(§4)** tienen pasos numerados en la sección 4; el resto se ejecuta con lo
  que dice la fila.
- Las **sospechas (S1…S19)** salen de leer el código, **no están confirmadas** en navegador.
  Confirmarlas o descartarlas es parte del trabajo.
- ⚠️ **Probar siempre sobre un build de producción** (`ng build` servido, o el ambiente del
  piloto), **nunca con `ng serve`**: en modo desarrollo `authGuard` deja pasar sin sesión (S14),
  así que varios resultados de esta lista salen distintos.
- **2 sesiones distintas = 2 navegadores o 2 perfiles**, nunca 2 pestañas del mismo: las pestañas
  comparten `localStorage` y por lo tanto la sesión (ver sección L).

---

## 1. Sospechas de bug encontradas en el código

| # | Gravedad | Sospecha | Evidencia |
|---|---|---|---|
| S1 | 🔴 Alta | **Recuperar contraseña no funciona de punta a punta.** El correo se pide sin `redirectTo` (usa el Site URL del proyecto) y la app no maneja el evento `PASSWORD_RECOVERY`: al abrir el enlace, `detectSessionInUrl` crea una sesión, el usuario cae logueado en su dashboard y **nunca se le pide la nueva contraseña**. Además `/recuperar-contrasena` es un stub "PLANO / Pendiente calcar desde mockup". | `supabase.service.ts:21,72-74`; `auth.facade.ts:47-64`; `recuperar-contrasena.component.ts:8-25` |
| S2 | 🔴 Alta | **Un usuario desactivado sigue entrando y operando.** Desactivar una secretaria solo cambia `users.active`; no se banea en Auth. La app mapea `isActive` pero ningún guard ni el login lo revisan, y los helpers de RLS (`auth_user_role`, `auth_user_branch_id`) tampoco miran `active`. | `update-secretary/index.ts:148-155`; `auth.facade.ts:145`; migración `20260301000011…:28-38`; `isActive` solo se usa en `ajustes-drawer.component.ts:143` |
| S3 | 🔴 Alta | **La pantalla de login muestra credenciales de prueba** (admin@test.com … / `Test123456`) sin ningún `isDevMode()`. El propio comentario dice "Eliminar antes de producción". Si esas cuentas existen en el ambiente del piloto, cualquiera entra como admin. | `login.component.ts:28-29,64-85` |
| S4 | 🟠 Media | **Pre-inscritos (módulo bloqueado) se abre igual desde Base Alumnos Prof.** El botón "Pre-inscritos" del hero está siempre visible y embebe el componente sin navegar, así que `pilotPhaseGuard` nunca corre. Afecta admin y secretaria. | `alumnos-profesional-list-content.component.ts:445-451`; `admin-alumnos-profesional.component.ts:31-32`; `secretaria-alumnos-profesional.component.ts:30-35` |
| S5 | 🟠 Media | **Contraseña inicial = cuerpo del RUT** y el "primer login" solo se exige en el cliente. Quien conozca el correo y el RUT de una secretaria recién creada (y que aún no entra) puede iniciar sesión y fijar él la contraseña. Con la sesión de `first_login = true` la API (RLS) responde igual que a una cuenta normal. | `create-secretary/index.ts:118-128,156`; `role.guard.ts:27-29`; helpers RLS sin `first_login` |
| S6 | 🟠 Media | **Si el perfil no carga, el login rebota en silencio.** Si la consulta a `users` falla (red, RLS) o no hay fila, el rol queda `unknown`; el login navega a `/app`, `roleRedirectGuard` cierra la sesión y vuelve a `/login` **sin ningún mensaje**. | `auth.facade.ts:112-121`; `login.component.ts:150-151`; `role-redirect.guard.ts:31-34` |
| S7 | 🟠 Media | **Cerrar sesión (o que expire) con un borrador de matrícula abierto.** `logout()` cierra la sesión **antes** de navegar; la navegación dispara `enrollmentDraftGuard` ("¿Deseas salir?"). Si se elige "Quedarse", la pantalla queda en la matrícula **sin sesión**. Lo mismo al expirar, porque el shell navega a `/login`. | `auth.facade.ts:240-253`; `enrollment-draft.guard.ts:15-35`; `app-shell.component.ts:305-310`; `app.routes.ts:181,442` |
| S8 | 🟠 Media | **2 pestañas: iniciar sesión con otra cuenta en la pestaña B cambia el usuario de la pestaña A sin navegar** (probable: `SIGNED_IN` de otra pestaña con otro id recarga el perfil). La pestaña A sigue mostrando la pantalla y los datos del usuario anterior con el menú del nuevo. | `auth.facade.ts:58-59,72-74` |
| S9 | 🟡 Baja-Media | **Redirecciones silenciosas y `/acceso-denegado` muerto.** Una secretaria que abre `/app/admin/**`, o un admin que abre `/app/instructor/**`, termina en **su propio dashboard** sin aviso (no en "acceso denegado" ni en "módulo no disponible"). `/acceso-denegado` es un stub que ningún código usa. | `role.guard.ts:35-36`; `app.routes.ts:615,706`; `acceso-denegado.component.ts:8-23` |
| S10 | 🟡 Baja | **"Mantener sesión iniciada" no hace nada.** El checkbox se emite pero nadie lo usa; la sesión siempre persiste en `localStorage`. | `login-card.component.ts:180-197,271`; `login.component.ts:147`; `supabase.service.ts:20` |
| S11 | 🟡 Baja | **Pantalla de cambio obligatorio:** el placeholder dice "Mínimo 8 caracteres" pero valida 6; no hay campo de confirmación; no hay forma de cerrar sesión desde ahí (ir a `/login` rebota de vuelta). Si el RPC falla después de cambiar la clave, la contraseña queda cambiada pero `first_login` sigue en `true`. | `force-password-change.component.ts:78,121`; `guest.guard.ts:15-16`; `auth.facade.ts:260-275` |
| S12 | 🟡 Baja | **Cambios al usuario en caliente:** el Realtime de `users` recarga el perfil, pero solo actúa si se **revoca** el grant. Cambiar rol, sede o desactivar a un usuario conectado no lo saca de la pantalla actual ni recarga datos. | `auth.facade.ts:186-195` |
| S13 | 🟡 Baja | **Límite de envíos de correo mal traducido** (probable): solo se reconoce `'Rate limit exceeded'` con mayúscula; GoTrue responde "email rate limit exceeded" o "For security purposes, you can only request this after N seconds" → cae al genérico "Error de autenticación. Por favor, verifica tus datos". | `auth-errors.utils.ts:47-49,68` |
| S14 | 🟡 Baja | **`authGuard` se desactiva en modo desarrollo.** Los guards hijos cubren casi todo, pero el shell se monta sin sesión. No es un bug del piloto si se despliega con build de producción — confirmar cómo se despliega. | `auth.guard.ts:8` |
| S15 | 🟡 Baja | **Datos residuales entre usuarios:** `logout()` solo resetea la sede; los facades singleton (con caché SWR) conservan los datos del usuario anterior. Se mitiga porque la mayoría compara la sede antes de reusar la caché, pero si la sede coincide se muestran datos cacheados del otro usuario hasta el refresco. | `auth.facade.ts:240-254`; p. ej. `admin-alumnos.facade.ts:164` |
| S16 | 🟡 Baja | **Botón de "Módulo no disponible" parpadea al recargar:** mientras la sesión se restaura, un admin ve "Volver al inicio de sesión" (el `computed` no espera `whenReady`, el clic sí). | `modulo-no-disponible.component.ts:52,62-64,72-73` |
| S17 | 🟡 Baja | **Carga de sesión con red lenta:** si restaurar la sesión tarda > 5 s, los guards siguen con usuario `null` y mandan a `/login` aunque la sesión sea válida. En el login, si el perfil tarda > 5 s, navega igual a `/app`. | `auth.facade.ts:44-45,204-210` |
| S18 | 🟡 Baja | **`/app/admin` y `/app/secretaria` (sin sub-ruta) dan 404**: los grupos no tienen hija vacía ni redirect. | `app.routes.ts:108-111,381-384,777-780` |
| S19 | 🟡 Baja | **Registro abierto:** `enable_signup = true` en la configuración local y `AuthFacade.signUp()` existe. Si el proyecto hospedado tiene lo mismo, cualquiera con la anon key crea una cuenta Auth (sin fila en `users`). Verificar en el panel de Supabase del piloto. | `supabase/config.toml:169`; `auth.facade.ts:215-233` |

---

## 2. Datos de prueba necesarios

Preparar antes de ejecutar. Anotar acá la cuenta real usada para cada uno. Las cuentas `@test.com`
existen en el seed (ver S3: si también existen en el ambiente del piloto, es un hallazgo en sí).

| Dato | Cómo debe estar | Para qué | Cuenta usada |
|---|---|---|---|
| D1 | Admin activo, `first_login = false` | Caso base admin | |
| D2 | Secretaria sin grant, sede **sin** Clase Profesional (hoy `secretaria@test.com`) | `professionalBranchGuard`, menú sin Academia Profesional | |
| D3 | Secretaria sin grant, sede **con** Clase Profesional (hoy `secretaria2@test.com`) | Rutas del recorte → "no disponible" | |
| D4 | Secretaria con `can_access_both_branches = true` | Selector de sede, rutas profesionales | |
| D5 | Secretaria con `branch_id = NULL` | Sede mal configurada | |
| D6 | Cuenta `instructor` | Portal bloqueado | |
| D7 | Cuenta `alumno` | Portal bloqueado | |
| D8 | Secretaria **recién creada** desde Secretarias → Nueva (`first_login = true`, clave = RUT sin DV) | Primer login | |
| D9 | Secretaria desactivada (`active = false`) desde la pantalla de Secretarias | S2 | |
| D10 | Usuario Auth **sin** fila en `users` (o con un rol no reconocido) | S6, rol `unknown` | |
| D11 | Cuenta cuyo correo **se pueda leer de verdad** | Recuperar contraseña (S1) | |
| D12 | Borrador de matrícula a medio llenar (paso 2 o más) | `enrollmentDraftGuard` (S7) | |
| D13 | Una notificación de tipo `preinscription` para admin y secretaria | Deep-link a módulo bloqueado | |
| D14 | Una matrícula de la sede B (conocer su id) | Acceso por URL a datos de otra sede | |

**Equipos:** 2 navegadores distintos (o perfiles), idealmente un tercero en modo incógnito.
**Ambiente:** build de producción (ver "Cómo usar").

---

## 3. Casos

### A. Pantalla de login

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| A01 | Abrir `/` sin sesión | Redirige a `/login` | ✓ | |
| A02 | Abrir `/login` | Card con correo, contraseña, "Mantener sesión iniciada", "¿Olvidaste tu contraseña?". Animación de entrada sin saltos | ✓ | |
| A03 | Panel "Credenciales de prueba" bajo la card **(§4)** | **No debe verse en el piloto** (S3) | ✓ | |
| A04 | Botón "Iniciar Sesión" con campos vacíos | Deshabilitado | ✓ | |
| A05 | Correo con formato inválido (`hola@`, `hola`) | Botón deshabilitado | ✓ | |
| A06 | Login admin (D1) | Spinner en el botón → `/app/admin/dashboard` | ✓ | |
| A07 | Login secretaria (D2) | `/app/secretaria/dashboard` | ✓ | |
| A08 | Contraseña incorrecta | "Correo o contraseña incorrectos.", sin navegar, el formulario sigue usable | ✓ | |
| A09 | Correo que no existe | Mismo mensaje que A08 (no revela si el correo existe) | ✓ | |
| A10 | Correo en MAYÚSCULAS / con espacios al inicio o final | Entra (o mensaje claro). Anotar el comportamiento | — | |
| A11 | Enter en el campo contraseña | Envía el formulario | ✓ | |
| A12 | Doble clic rápido en "Iniciar Sesión" | Una sola petición de login (el botón se deshabilita) | — | |
| A13 | Sin red (DevTools → Offline) | "Sin conexión a internet. Verifica tu red e intenta de nuevo." y el botón vuelve a la normalidad | — | |
| A14 | Ojo de mostrar/ocultar contraseña | Alterna el tipo del campo; `aria-label` cambia | — | |
| A15 | Muchos intentos fallidos seguidos (10+) | Mensaje de "demasiados intentos" claro, no un genérico (S13) | — | |
| A16 | Usuario sin perfil en `users` (D10) **(§4)** | Mensaje claro; hoy vuelve a `/login` sin decir nada (S6) | — | |
| A17 | Entrar a `/login` ya logueado | Redirige a `/app` → su dashboard | ✓ | |
| A18 | Sin sesión, abrir un marcador a `/app/admin/pagos` y loguearse | ¿Vuelve a esa URL o al dashboard? Hoy va al dashboard — **decisión** | — | |
| A19 | "Mantener sesión iniciada" desmarcado → cerrar el navegador → abrir | Hoy la sesión sigue igual (S10) — **decisión**: quitar el checkbox o implementarlo | — | |

### B. Sesión persistida, recarga y expiración

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| B01 | Logueado, recargar (F5) en cualquier pantalla | Sigue en la misma pantalla, sin pasar por el login | ✓ | |
| B02 | Cerrar la pestaña y abrir la app de nuevo | Sigue logueado | ✓ | |
| B03 | Recargar con red lenta (Slow 3G) **(§4)** | Termina en la pantalla correcta, sin rebotar a `/login` (S17) | — | |
| B04 | Dejar la app abierta > 1 hora (token de 3600 s) y luego usarla | El token se renueva solo; las acciones funcionan | — | |
| B05 | Suspender el equipo 2+ horas con la app abierta y volver | Renueva la sesión o vuelve a `/login`, sin pantallas a medio cargar | — | |
| B06 | Sesión invalidada desde otro lado **(§4)** | La app detecta el cierre y vuelve a `/login` sin errores en cadena | — | |
| B07 | Sesión expirada a mitad de guardar algo (p. ej. un pago) | Mensaje claro; no queda un spinner colgado ni un guardado a medias | — | |
| B08 | Borrar a mano `localStorage` (DevTools) y navegar por el menú | Vuelve a `/login` | ✓ | |
| B09 | Sin sesión, abrir `/app/admin/dashboard` directo | Redirige a `/login` | ✓ | |
| B10 | Sin sesión, abrir `/app` | Redirige a `/login` | ✓ | |

### C. Primer login (`first_login`)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| C01 | Login de D8 con la clave inicial (RUT sin puntos ni DV) **(§4)** | Llega a `/force-password-change` | ✓ | |
| C02 | Desde esa pantalla, escribir a mano `/app/secretaria/dashboard`, `/app`, `/app/admin/dashboard` | Siempre vuelve a `/force-password-change` | ✓ | |
| C03 | Escribir `/login` estando en primer login | Rebota a `/force-password-change`. No hay forma de cerrar sesión (S11) — **decisión** | — | |
| C04 | Clave de 5 caracteres | Botón deshabilitado | ✓ | |
| C05 | Clave de 6 o 7 caracteres | Hoy la acepta aunque el placeholder dice "Mínimo 8" (S11) — **decisión** del mínimo | — | |
| C06 | Nueva clave igual a la inicial | "La nueva contraseña debe ser diferente a la anterior." | ✓ | |
| C07 | Clave válida → "Actualizar y Continuar" | Spinner → dashboard del rol | ✓ | |
| C08 | Cerrar sesión y entrar con la clave nueva | Entra directo al dashboard, sin pasar por el cambio | ✓ | |
| C09 | Entrar con la clave inicial después del cambio | "Correo o contraseña incorrectos." | ✓ | |
| C10 | Abrir `/force-password-change` con un usuario que ya cambió su clave | Redirige a `/app` → dashboard | ✓ | |
| C11 | Abrir `/force-password-change` sin sesión | Redirige a `/login` | ✓ | |
| C12 | Doble clic en "Actualizar y Continuar" | Una sola actualización | — | |
| C13 | Sin red al actualizar | Mensaje de error claro; se puede reintentar | — | |
| C14 | **Seguridad (S5)** **(§4)** | Alguien que sabe correo + RUT de una secretaria nueva no debería poder tomar la cuenta — confirmar el riesgo y decidir | — | |
| C15 | RUT ingresado sin guion al crear la secretaria (p. ej. `152062313`) | ¿Cuál queda como clave inicial? Anotar (el código corta en el guion) | — | |

### D. Recuperar contraseña

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| D01 | "¿Olvidaste tu contraseña?" | La card cambia a "Recuperar Contraseña", se oculta el campo contraseña, botón "Enviar Enlace" | ✓ | |
| D02 | "Volver a iniciar sesión" | Vuelve al modo login con la contraseña vacía | ✓ | |
| D03 | Enviar con un correo existente (D11) | "Se envió un enlace de recuperación a tu correo." | ✓ | |
| D04 | Enviar con un correo inexistente | El mismo mensaje (no revela si existe) | ✓ | |
| D05 | Llega el correo | Asunto y texto en español, remitente reconocible, enlace a la URL del piloto (no a `127.0.0.1:3000`) | — | |
| D06 | Flujo completo: correo → enlace → nueva clave → login **(§4)** | Se pide la nueva contraseña y se puede entrar con ella (S1: hoy probablemente entra directo sin pedirla) | — | |
| D07 | Abrir el enlace 2 veces / un enlace viejo | Mensaje "enlace vencido o usado", no una pantalla en blanco | — | |
| D08 | Pedir 2 correos seguidos en menos de 1 minuto | Mensaje claro de "espera antes de pedir otro" (S13) | — | |
| D09 | Abrir `/recuperar-contrasena` por URL | Hoy muestra un stub "PLANO / Pendiente calcar desde mockup" (S1) — no debe verse en el piloto | ✓ | |
| D10 | Abrir el enlace de recuperación estando logueado con **otra** cuenta en ese navegador | Queda claro con qué cuenta se está; no mezcla sesiones | — | |

### E. Cerrar sesión y datos residuales

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| E01 | Avatar → "Cerrar sesión" | Modal de confirmación "¿Estás seguro…?" | ✓ | |
| E02 | "Cancelar" en el modal | Sigue logueado, mismo lugar | ✓ | |
| E03 | "Sí, salir" | Vuelve a `/login` | ✓ | |
| E04 | Botón "Atrás" del navegador después de salir | No vuelve a ver la pantalla anterior; termina en `/login` | ✓ | |
| E05 | Salir como admin con sede B elegida → entrar como secretaria de sede A (mismo navegador) **(§4)** | La secretaria ve solo lo suyo; la sede del admin no se hereda (regresión `fix-171-b`) | ✓ | |
| E06 | Admin con sede A → salir → secretaria de sede A **(§4)** | Ningún dato del admin (búsquedas, filtros, Papelera, notificaciones) queda visible (S15) | — | |
| E07 | Secretaria → salir → admin | El admin ve el selector de sede y "Todas las escuelas" correcto | ✓ | |
| E08 | Campana de notificaciones tras cambiar de usuario | Solo las notificaciones del usuario nuevo | ✓ | |
| E09 | Salir estando en la matrícula con borrador (D12) **(§4)** | Flujo coherente: o avisa antes de cerrar la sesión, o sale sin quedar en una pantalla sin sesión (S7) | — | |
| E10 | Salir sin red | Termina en `/login` igual; al volver la red no queda una sesión "fantasma" | — | |
| E11 | Salir en el equipo 1 con la misma cuenta abierta en el equipo 2 | ¿Se cierra también la del equipo 2? (el cierre por defecto de Supabase es global) — **decisión** | — | |

### F. Rutas de otro rol (URL directa)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| F01 | Secretaria (D2) abre cada ruta **exclusiva** de admin: `/app/admin/dashboard`, `/app/admin/usuarios`, `/app/admin/secretarias`, `/app/admin/auditoria`, `/app/admin/flota`, `/app/admin/contabilidad/anticipos`, `/app/admin/tareas`, `/app/admin/notificaciones` | No ve ninguna. Hoy termina en **su** dashboard sin aviso (S9) — **decisión**: ¿mensaje o `/acceso-denegado`? | ✓ | |
| F02 | Secretaria abre rutas de admin que tienen equivalente propio (`/app/admin/alumnos`, `/app/admin/pagos`, `/app/admin/matricula`) | Igual que F01 | ✓ | |
| F03 | Admin abre `/app/secretaria/dashboard` y `/app/secretaria/observaciones` | Termina en el dashboard de admin | ✓ | |
| F04 | Admin abre `/app/instructor/dashboard` y `/app/alumno/dashboard` | Hoy: dashboard de admin (el guard de rol gana al de fase). Confirmar que es lo deseado | ✓ | |
| F05 | Secretaria abre `/app/instructor/horario` y `/app/alumno/pagos` | Su dashboard | ✓ | |
| F06 | Ruta inexistente dentro del rol: `/app/admin/xyz`, `/app/secretaria/usuarios`, `/app/secretaria/contabilidad/anticipos` | 404 "Página no encontrada" | ✓ | |
| F07 | `/app/admin` y `/app/secretaria` sin sub-ruta | Hoy 404 (S18). Esperado: su dashboard | ✓ | |
| F08 | Ruta inexistente fuera de `/app` (`/hola`) | 404 → "Volver al inicio" lleva al dashboard (o a `/login` sin sesión) | ✓ | |
| F09 | Secretaria de sede A abre `/app/secretaria/alumnos/<id de sede B>` (D14) | No ve datos de la sede B (RLS). Mensaje claro, no una ficha vacía rota | — | |
| F10 | Acceso por URL a `/app/secretaria/configuracion-web` y `/app/secretaria/contabilidad/cursos` | Entran (son rutas de secretaria). Confirmar que es lo deseado | — | |

### G. Fase piloto — matriz de rutas bloqueadas (URL directa)

Leyenda: **MND** = `/modulo-no-disponible` · **Dash** = dashboard propio. La columna "Esperado" es
lo que hace el código hoy; si difiere de lo que pide la asignación (MND para todos), queda como
decisión en §5.

**G1. Recorte de Clase Profesional — admin (7 rutas)**

| ID | Ruta | Esperado admin (D1) | Auto | Res. |
|---|---|---|---|---|
| G01 | `/app/admin/clase-profesional/pre-inscritos` | MND | ✓ | |
| G02 | `/app/admin/clase-profesional/relatores` | MND | ✓ | |
| G03 | `/app/admin/clase-profesional/asistencia` | MND | ✓ | |
| G04 | `/app/admin/clase-profesional/certificados` | MND | ✓ | |
| G05 | `/app/admin/clase-profesional/evaluaciones` | MND | ✓ | |
| G06 | `/app/admin/clase-profesional/archivo` | MND | ✓ | |
| G07 | `/app/admin/ex-alumnos-profesional` | MND | ✓ | |

**G2. Recorte de Clase Profesional — secretaria (7 rutas × 3 perfiles)** **(§4)**

| ID | Ruta | D2 (sin Prof.) | D3 (con Prof.) | D4 (grant) | Auto | Res. |
|---|---|---|---|---|---|---|
| G08 | `/app/secretaria/profesional/pre-inscritos` | Dash | MND | MND | ✓ | |
| G09 | `/app/secretaria/profesional/relatores` | Dash | MND | MND | ✓ | |
| G10 | `/app/secretaria/profesional/asistencia` | Dash | MND | MND | ✓ | |
| G11 | `/app/secretaria/profesional/evaluaciones` | Dash | MND | MND | ✓ | |
| G12 | `/app/secretaria/profesional/certificados` | Dash | MND | MND | ✓ | |
| G13 | `/app/secretaria/profesional/archivo` | Dash | MND | MND | ✓ | |
| G14 | `/app/secretaria/ex-alumnos-profesional` | Dash | MND | MND | ✓ | |

**G3. Lo que del mundo Profesional SÍ queda visible (regresión `fix-257-m`/`fix-260-m`)**

| ID | Ruta | Esperado | Auto | Res. |
|---|---|---|---|---|
| G15 | `/app/admin/clase-profesional/alumnos` | Renderiza | ✓ | |
| G16 | `/app/admin/clase-profesional/promociones` | Renderiza | ✓ | |
| G17 | `/app/admin/libro-de-clases` | Renderiza | ✓ | |
| G18 | `/app/secretaria/profesional/alumnos`, `/profesional/promociones`, `/libro-de-clases` | D3 y D4: renderizan · D2: Dash | ✓ | |
| G19 | Botón "Pre-inscritos" dentro de Base Alumnos Prof. (admin y secretaria) **(§4)** | No debería abrir el módulo bloqueado (S4) | ✓ | |
| G20 | Clic en una notificación de pre-inscripción (D13) en la campana | Termina en MND con botón "Volver al inicio" (no cierra sesión) | — | |

**G4. Portal Instructor (todas las rutas)**

| ID | Ruta | Esperado cuenta instructor (D6) | Auto | Res. |
|---|---|---|---|---|
| G21 | `/app/instructor/dashboard` | MND | ✓ | |
| G22 | `/app/instructor/alumnos`, `/app/instructor/alumnos/1`, `/app/instructor/alumnos/1/ficha` | MND | ✓ | |
| G23 | `/app/instructor/clase/iniciar`, `/app/instructor/clase/1` | MND | ✓ | |
| G24 | `/app/instructor/ficha/1` (redirect viejo) | MND | ✓ | |
| G25 | `/app/instructor/horario`, `/liquidacion`, `/notificaciones`, `/tareas` | MND | ✓ | |
| G26 | Login con D6 **(§4)** | Cae directo en MND; sin menú; botón "Volver al inicio de sesión" cierra la sesión (`hotfix-107-m`) | ✓ | |

**G5. Portal Alumno (todas las rutas)**

| ID | Ruta | Esperado cuenta alumno (D7) | Auto | Res. |
|---|---|---|---|---|
| G27 | `/app/alumno/dashboard`, `/clases`, `/horario` | MND | ✓ | |
| G28 | `/app/alumno/pagos`, `/pagar`, `/pagar/retorno?token_ws=x` | MND (nunca inicia ni confirma un pago) | ✓ | |
| G29 | `/app/alumno/notificaciones`, `/pruebas-online`, `/ayuda` | MND | ✓ | |
| G30 | Login con D7 | Igual que G26 | ✓ | |

**G6. Matrícula pública**

| ID | Ruta | Esperado | Auto | Res. |
|---|---|---|---|---|
| G31 | `/inscripcion` sin sesión | MND, botón "Volver al inicio de sesión" → `/login` | ✓ | |
| G32 | `/inscripcion/retorno?token_ws=abc` sin sesión | MND; en Network no se llama a la edge function `public-enrollment` | ✓ | |
| G33 | `/inscripcion` logueado como admin y como secretaria | MND con botón "Volver al inicio" → su dashboard, sin perder la sesión (`fix-261-m`) | ✓ | |
| G34 | Enlaces viejos a `/inscripcion?…` (sitio web público, QR impresos) | MND. Anotar si el sitio web público todavía los ofrece | — | |

### H. Secretaria y sede sin Clase Profesional (`professionalBranchGuard`)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| H01 | D2 en el menú lateral | No aparece el grupo "Academia Profesional" | ✓ | |
| H02 | D2 abre `/app/secretaria/profesional/alumnos`, `/profesional/promociones`, `/libro-de-clases` | Redirige a su dashboard | ✓ | |
| H03 | D3 abre esas mismas rutas | Renderizan | ✓ | |
| H04 | D4 (grant) con sede sin Profesional elegida abre `/app/secretaria/profesional/alumnos` | Entra y el selector salta a una sede con Profesional; "Todas" queda deshabilitada | ✓ | |
| H05 | D4 sale de la página profesional | El selector vuelve a "Todas las escuelas" y se habilita | — | |
| H06 | D5 (sin sede) abre rutas profesionales | Redirige a su dashboard; nunca ve datos de todas las sedes | — | |
| H07 | D5: login y dashboard | ¿Qué ve? Anotar (debería ser un aviso de "cuenta sin sede", no datos vacíos o de todas) | — | |
| H08 | D4 en el menú: clic en un ítem profesional con candado (sede sin Profesional) | Modal "Conmutar Sede" → al aceptar cambia de sede y navega | — | |
| H09 | Admin en sede sin Profesional: ítems con candado | Igual que H08 | — | |
| H10 | Recargar (F5) estando en `/app/secretaria/profesional/alumnos` como D3 | Sigue ahí (el guard carga las sedes antes de decidir) | ✓ | |

### I. Menú lateral por rol

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| I01 | Admin: grupos e ítems | Operaciones Diarias (3), Academia Clase B (5), Academia Profesional (**solo** Base Alumnos Prof., Promociones, Libro de Clases), Finanzas y Caja (7), Recursos y Logística (6) | ✓ | |
| I02 | Secretaria D3: grupos e ítems | Igual que admin salvo: sin Anticipos, sin Secretarias, sin Auditoría, sin Flota | ✓ | |
| I03 | Ningún rol ve Relatores, Asistencia Prof., Evaluaciones, Certificados Prof., Archivo, Ex-Alumnos Prof. ni Pre-inscritos | Confirmado para admin, D2, D3, D4 | ✓ | |
| I04 | Clic en cada ítem visible (admin y secretaria) | Llega a la pantalla correcta; **ninguno** termina en MND ni 404 | ✓ | |
| I05 | Ítem activo resaltado | Solo el de la pantalla actual | — | |
| I06 | Instructor (D6) y alumno (D7) | Menú vacío | ✓ | |
| I07 | Admin sin "Usuarios" ni "Notificaciones" en el menú | Las rutas existen pero no tienen ítem — confirmar cómo se llega o si falta | — | |
| I08 | Menú en móvil (375 px) | Se abre/cierra; al navegar se cierra | — | |

### J. Pantallas de aviso y públicas

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| J01 | `/modulo-no-disponible` como admin/secretaria | "Módulo no habilitado todavía", botón "Volver al inicio" → dashboard, sesión viva | ✓ | |
| J02 | Mismo, como instructor/alumno | Botón "Volver al inicio de sesión" → cierra sesión → `/login` (sin bucle) | ✓ | |
| J03 | Mismo, sin sesión | "Volver al inicio de sesión" → `/login`, sin llamar a logout | ✓ | |
| J04 | Recargar `/modulo-no-disponible` como admin **(§4)** | El botón no debería decir "inicio de sesión" ni un instante (S16); el clic lleva al dashboard | — | |
| J05 | Rol `unknown` (D10) en `/modulo-no-disponible` | Botón cierra la sesión | — | |
| J06 | `/acceso-denegado` | Hoy stub "PLANO" (S9) — no debe verse en el piloto | ✓ | |
| J07 | `/politica-privacidad/autoescuela-chillan` y `/conductores-chillan` | Política de la sociedad correcta (razón social, RUT, domicilio, correo de derechos), sin sesión | ✓ | |
| J08 | `/politica-privacidad/xyz` | "No encontramos esa política…" con botones a las 2 sedes | ✓ | |
| J09 | Política en 375 px | Las tablas scrollean dentro de su caja; la página no scrollea en horizontal | ✓ | |
| J10 | Política logueado | Se ve igual (sin shell) | — | |
| J11 | Imprimir la política (Ctrl+P) | Legible, sin cortes graves | — | |
| J12 | 404 en modo oscuro y claro | Legible | — | |

### K. Usuario desactivado, perfil y cambios en caliente

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| K01 | Desactivar a D9 desde Secretarias → login con D9 **(§4)** | No debe poder entrar; mensaje claro (S2) | ✓ | |
| K02 | D9 desactivada **mientras está conectada** **(§4)** | Debe salir o quedar bloqueada; hoy probablemente sigue operando (S2, S12) | — | |
| K03 | D9 con la sesión que ya tenía: consultar datos por API (Network → "Copy as fetch") | 0 filas / 401 (S2) | — | |
| K04 | Reactivar D9 | Vuelve a entrar normal | ✓ | |
| K05 | Otorgar el grant multi-sede a D3 conectada | Aparece el selector de sede sin recargar | — | |
| K06 | Revocar el grant a D4 conectada **(§4)** | El selector desaparece en vivo y vuelve a su sede (regresión UAT P7) | — | |
| K07 | Cambiar la sede (`branch_id`) de una secretaria conectada | ¿Se refleja sin recargar? Los datos en pantalla, ¿son de la sede nueva? (S12) | — | |
| K08 | Cambiar el correo de una secretaria (Secretarias → editar) | Entra con el correo nuevo; el viejo ya no sirve | — | |
| K09 | Nombre e iniciales en el avatar / panel de usuario | Coinciden con la BD ("Nombres ApellidoPaterno") | ✓ | |
| K10 | Ajustes → estado de la cuenta | "Activo" | — | |

### L. Dos pestañas y dos equipos

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| L01 | 2 pestañas del mismo usuario; cerrar sesión en la A | La B vuelve a `/login` sola (sin recargar) | ✓ | |
| L02 | Pestaña A admin en Pagos; en la pestaña B cerrar sesión y entrar como secretaria **(§4)** | La A no debería quedar con la pantalla del admin y el menú de la secretaria (S8) | — | |
| L03 | 2 pestañas del mismo admin, cambiar la sede en la A | La B no cambia hasta recargar; al recargar toma la última — confirmar que no confunde | — | |
| L04 | Mismo usuario en 2 equipos a la vez | Ambos funcionan | — | |
| L05 | Recuperar contraseña en un equipo con la sesión abierta en otro | ¿Se cierra la otra sesión? — anotar | — | |

### M. Borrador de matrícula (`enrollmentDraftGuard`, solo la parte de guard)

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| M01 | Con borrador (D12), clic en otro ítem del menú | Modal "¿Deseas salir?" (Quedarse / Sí, salir) | ✓ | |
| M02 | "Quedarse" | Sigue en el wizard, con lo avanzado | ✓ | |
| M03 | "Sí, salir" | Navega; el borrador queda recuperable desde la lista de borradores | ✓ | |
| M04 | Sin borrador (wizard recién abierto, paso 1 sin guardar) | Sale sin modal | ✓ | |
| M05 | Matrícula ya confirmada | Sale sin modal | ✓ | |
| M06 | "Atrás" del navegador con borrador | Mismo modal | — | |
| M07 | F5 / cerrar la pestaña con borrador | El guard no aplica (no hay aviso del navegador) — **decisión** | — | |
| M08 | Cerrar sesión o expirar con borrador (ver E09 §4) | Coherente (S7) | — | |

### N. Seguridad a nivel de API

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| N01 | Con sesión de secretaria A, pedir por consola datos de la sede B **(§4)** | 0 filas de la sede B | ✓ | |
| N02 | Con sesión de D8 **antes** de cambiar la clave, pedir datos por API | Decidir si debe estar bloqueado (S5) | — | |
| N03 | Crear una cuenta con `signup` usando la anon key **(§4)** | Falla, o la cuenta no puede leer nada (S19) | — | |
| N04 | Sesión de instructor (D6) pidiendo por API tablas de pagos/alumnos | Solo lo que su RLS permite; nada de pagos de la escuela | — | |
| N05 | En el panel de Supabase del piloto: Site URL, Redirect URLs, "Enable signup", límite de correos | Site URL = dominio del piloto; signup cerrado; anotar los valores | — | |

### O. Visual y accesibilidad

| ID | Caso | Resultado esperado | Auto | Res. |
|---|---|---|---|---|
| O01 | Login, cambio obligatorio, MND y 404 en modo oscuro y claro | Todo legible, incluidos los mensajes de error y éxito | ✓ | |
| O02 | Login a 375 / 768 / 1440 px | Sin scroll horizontal; la card no se corta | ✓ | |
| O03 | Solo teclado en el login | Tab recorre correo → contraseña → ojo → checkbox → botón → "¿Olvidaste…?"; el foco se ve | — | |
| O04 | Lector de pantalla: error de login | Se anuncia (`role="alert"`, `aria-live`) | — | |
| O05 | Autocompletar del navegador / gestor de contraseñas | Completa correo y contraseña y el botón se habilita | — | |
| O06 | Mensaje de error largo | No rompe la card | — | |

---

## 4. Casos con pasos numerados

### A03 — Credenciales de prueba en el login (S3)

**Precondición:** ambiente del piloto (no local), sin sesión.
1. Abrir `/login`.
2. Buscar bajo la card el recuadro "Credenciales de prueba".
3. Si aparece, intentar entrar con `admin@test.com` / `Test123456`.

**Esperado:** en el paso 2 el recuadro no existe. Si existe y el paso 3 entra, **P0 inmediato**
(acceso de admin público). **Evidencia:** captura de los pasos 2 y 3.

### A16 — Usuario sin perfil (S6)

**Precondición:** D10 (usuario Auth sin fila en `users`).
1. Abrir `/login` con DevTools → Network abierto.
2. Entrar con D10.
3. Anotar a dónde navega y qué mensaje aparece.
4. Repetir con D1, pero en DevTools → Network → Request blocking bloquear `*/rest/v1/users*`.

**Esperado:** en ambos casos un mensaje claro ("tu cuenta no tiene un perfil asignado" / "no se
pudo cargar tu perfil"). Hoy probablemente vuelve a `/login` sin decir nada. **Evidencia:** captura
+ lista de peticiones.

### B03 — Recarga con red lenta (S17)

**Precondición:** sesión admin en `/app/admin/pagos`.
1. DevTools → Network → "Slow 3G".
2. Recargar (F5) y esperar a que termine.
3. Repetir con un perfil de red personalizado de 5 s de latencia.

**Esperado:** termina en `/app/admin/pagos` las dos veces. Si en el paso 3 termina en `/login` (o
en el login estando logueado), S17 confirmada.

### B06 — Sesión invalidada desde otro lado

**Precondición:** D1 abierta en el navegador A; mismo usuario en el navegador B.
1. En B, cerrar sesión (el cierre por defecto es global, ver E11).
2. En A, sin recargar, usar la app cada 5 minutos y anotar cuándo se entera (el token dura hasta
   60 min).
3. Cuando ocurra, hacer clic en un ítem del menú e intentar guardar algo.

**Esperado:** A termina en `/login` con la sesión cerrada, sin toasts de error en cadena ni
pantallas a medio cargar. Anotar cuánto tardó.

### C01 — Primer login completo

**Precondición:** admin crea D8 (Secretarias → Nueva) con un RUT conocido, p. ej. `15.206.231-3`.
1. Cerrar sesión del admin.
2. Entrar con el correo de D8 y la clave `15206231`.
3. Verificar que llega a `/force-password-change` con el texto de "contraseña temporal".
4. Escribir `/app/secretaria/dashboard` en la barra → verificar que vuelve a la misma pantalla.
5. Escribir una clave nueva de 8+ caracteres → "Actualizar y Continuar".
6. Verificar que llega al dashboard de secretaria de la sede correcta.
7. Cerrar sesión y entrar con la clave nueva.

**Esperado:** el paso 7 entra directo al dashboard. **Evidencia:** captura de los pasos 3 y 6.

### C14 — Toma de cuenta con la clave inicial (S5)

**Precondición:** D8 recién creada, **sin** haber entrado nunca; conocer su correo y RUT.
1. En otro navegador, entrar con correo + RUT sin DV.
2. Fijar una contraseña nueva.
3. Intentar entrar como la secretaria real usando la clave inicial.

**Esperado del código:** el paso 1 funciona y la secretaria real queda fuera. No es un bug de
implementación sino de diseño: **anotar y llevar a §5** (¿invitación por correo o clave aleatoria
entregada en persona?).

### D06 — Recuperar contraseña de punta a punta (S1)

**Precondición:** D11 con correo que se pueda leer; sin sesión; conocer la clave actual.
1. `/login` → "¿Olvidaste tu contraseña?" → escribir el correo → "Enviar Enlace".
2. Verificar el mensaje de éxito.
3. Abrir el correo: anotar remitente, asunto, idioma y **a qué dominio apunta el enlace**.
4. Abrir el enlace en el mismo navegador.
5. Anotar a qué pantalla llega y si pide una contraseña nueva.
6. Si llega al dashboard sin pedir nada: cerrar sesión e intentar entrar con la clave **anterior**.
7. Si pidió la nueva: fijarla, cerrar sesión y entrar con ella.

**Esperado:** el paso 5 muestra un formulario de nueva contraseña; el paso 7 entra con la nueva. Si
en el paso 5 cae logueado en el dashboard sin pedir nada, **S1 confirmada** (el "olvidé mi
contraseña" no permite cambiarla; solo sirve para entrar una vez). **Evidencia:** captura del
correo y de los pasos 5–7.

### E05 — La sede del admin no se hereda (regresión `fix-171-b`)

**Precondición:** mismo navegador, D1 y una secretaria de la sede A.
1. Entrar como admin → elegir la sede B en el selector.
2. Cerrar sesión.
3. Entrar como secretaria de la sede A.
4. Abrir Base Alumnos B, Pagos y Comunicación → historial de comunicados.

**Esperado:** en el paso 4 solo aparecen datos de la sede A; no hay selector de sede; el historial
de comunicados no está vacío por un filtro heredado. En DevTools → Application → Local Storage no
existe `autoescuela:selectedBranchId`.

### E06 — Sin datos residuales con la misma sede (S15)

**Precondición:** admin y secretaria de la sede A.
1. Como admin con sede A: abrir Base Alumnos B, buscar un alumno, abrir la Papelera; abrir Pagos.
2. Cerrar sesión **sin recargar** la página.
3. Entrar como secretaria A.
4. Abrir Base Alumnos B y Pagos inmediatamente.

**Esperado:** no se ve la búsqueda, la Papelera ni ningún estado que haya dejado el admin; los
datos corresponden a lo que la secretaria puede ver. Anotar cualquier cosa "pegada".

### E09 — Cerrar sesión con un borrador de matrícula abierto (S7)

**Precondición:** secretaria en `/app/secretaria/matricula` con D12 (paso 2 o más).
1. Avatar → "Cerrar sesión" → "Sí, salir".
2. Observar si aparece el modal "¿Deseas salir?".
3. Elegir "Quedarse".
4. Intentar avanzar en el wizard.
5. Repetir desde el paso 1 eligiendo "Sí, salir".

**Esperado:** o un único aviso antes de cerrar la sesión, o salida limpia a `/login`. Si en los
pasos 3–4 queda en el wizard sin sesión (errores al guardar, datos que no cargan), S7 confirmada.
**Evidencia:** captura + consola.

### G2 — Matriz de secretaria (G08–G14)

**Precondición:** D2, D3 y D4 en 3 navegadores/perfiles.
1. Con D2, pegar cada una de las 7 URLs en la barra y anotar dónde termina.
2. Repetir con D3.
3. Repetir con D4 (con una sede con Profesional elegida y luego con "Todas").
4. En cada caso, revisar que la consola no tenga errores y que no se haya visto ni un instante el
   módulo bloqueado (grabar pantalla si hace falta).

**Esperado:** tabla G2 completa. Si algún caso termina en 404, en pantalla en blanco o renderiza el
módulo, es ❌.

### G19 — Pre-inscritos embebido (S4)

**Precondición:** admin con una sede con Profesional elegida; luego D3.
1. Menú → Base Alumnos Prof.
2. En el hero, buscar el botón "Pre-inscritos".
3. Clic.
4. Si se abre la lista: probar un filtro y abrir el drawer de un pre-inscrito.

**Esperado:** el botón no existe, o lleva a "módulo no disponible". Si en el paso 3 se abre la
lista de pre-inscritos, **S4 confirmada** (el recorte del piloto tiene una puerta abierta).

### G26 — Login de una cuenta de portal bloqueado

**Precondición:** D6.
1. Entrar con D6.
2. Verificar que termina en `/modulo-no-disponible` y que no hay sidebar ni topbar.
3. Escribir `/app/instructor/horario` → verificar MND.
4. Clic en "Volver al inicio de sesión".
5. Verificar que queda en `/login` y que al escribir `/app` vuelve a pedir login.

**Esperado:** como arriba, sin bucles entre `/login` y MND (`hotfix-107-m`).

### J04 — Recarga de "módulo no disponible" como admin (S16)

1. Como admin, abrir `/app/admin/clase-profesional/relatores` → termina en MND.
2. Con Slow 3G, recargar (F5) y mirar el texto del botón mientras carga.
3. Clic en el botón apenas aparezca.

**Esperado:** el texto es "Volver al inicio" desde el principio (o no aparece hasta saber el rol);
el clic lleva al dashboard **sin** cerrar la sesión.

### K01 — Login de un usuario desactivado (S2)

**Precondición:** D9 activa y con clave conocida.
1. Como admin: Secretarias → editar D9 → estado inactivo → guardar.
2. En otro navegador, entrar con D9.
3. Si entra: abrir Base Alumnos B y Pagos.

**Esperado:** en el paso 2, mensaje "tu cuenta está desactivada" y sin acceso. Si en el paso 3 ve
datos, **S2 confirmada → P0** (una ex-secretaria conserva acceso a datos personales y a caja).

### K02 — Desactivar a alguien conectado

**Precondición:** D9 activa y conectada en el navegador B, en Pagos.
1. En el navegador A, admin desactiva a D9.
2. En B, sin recargar, esperar 10 s y luego navegar por el menú y hacer alguna acción de escritura
   reversible.

**Esperado:** B queda fuera (a `/login` o con aviso). Anotar si pudo seguir operando.

### K06 — Revocar el grant en caliente (regresión UAT P7)

**Precondición:** D4 conectada en el navegador B con "Todas las escuelas" elegida, en Base Alumnos B.
1. En A, admin revoca el grant a D4.
2. Mirar B sin recargar.
3. En B, navegar a Pagos.

**Esperado:** en el paso 2 desaparece el selector; en el paso 3 solo ve su sede.

### L02 — Otro usuario en otra pestaña (S8)

**Precondición:** mismo navegador, 2 pestañas.
1. Pestaña A: admin en `/app/admin/pagos` con sede "Todas".
2. Pestaña B: cerrar sesión y entrar como secretaria de la sede A.
3. Volver a la pestaña A sin recargar.
4. Mirar topbar, menú y la tabla de pagos; hacer clic en un ítem del menú.

**Esperado:** la pestaña A vuelve a `/login` o se recarga como secretaria de forma coherente. Si
muestra pagos de todas las sedes con el menú de secretaria, S8 confirmada. **Evidencia:** captura
del paso 4.

### N01 — RLS por sede desde la consola

**Precondición:** sesión de secretaria A; id de un pago y de un alumno de la sede B.
1. En Pagos, copiar desde Network una petición a `/rest/v1/payments…` ("Copy as fetch").
2. En Console, pegarla cambiando el filtro para pedir el pago de la sede B (o quitando el filtro de
   sede).
3. Repetir con `/rest/v1/students` y `/rest/v1/users`.

**Esperado:** 0 filas de la sede B. Si aparecen, **P0 inmediato**.

### N03 — Registro abierto (S19)

**Precondición:** conocer la URL del proyecto y la anon key (están en el bundle público).
1. En la consola del navegador, sin sesión, hacer un `fetch` POST a `<url>/auth/v1/signup` con un
   correo nuevo y una clave.
2. Si responde con una sesión, usar ese token para pedir `/rest/v1/students?select=*`.
3. Intentar entrar a la app con esa cuenta.

**Esperado:** el paso 1 falla ("Signups not allowed"). Si no falla: el paso 2 debe devolver 0 filas
y el paso 3 no debe dejar pasar del login. Pedir al admin de Supabase que borre la cuenta creada.

---

## 5. Decisiones de negocio pendientes

No se pueden marcar ✅/❌ hasta que alguien defina la regla:

| Caso | Pregunta |
|---|---|
| A18 | Después de loguearse, ¿se vuelve a la URL que se intentó abrir o siempre al dashboard? |
| A19 | ¿Se implementa "Mantener sesión iniciada" (sesión que muere al cerrar el navegador) o se quita el checkbox? En el mostrador con PC compartida importa. |
| C03 | ¿La pantalla de cambio obligatorio debe tener "Cerrar sesión"? |
| C05 | ¿Mínimo de 6 u 8 caracteres? ¿Se exige confirmar la clave? |
| C14 / N02 | ¿La clave inicial sigue siendo el RUT? ¿El primer login debe bloquearse también en la BD? |
| D06 | ¿Pantalla propia de "nueva contraseña" tras el enlace, o se reutiliza `/force-password-change`? |
| E11 | ¿Cerrar sesión debe cerrar también las otras sesiones del mismo usuario (hoy es global)? |
| F01 / F04 / G2 | Cuando alguien abre una URL que no le corresponde: ¿redirigir en silencio a su dashboard (hoy), mostrar `/acceso-denegado` (hoy stub) o "módulo no disponible"? La asignación pide MND para todas las rutas ocultas; el código da Dash cuando el guard de rol o de sede corre primero. |
| F07 | ¿`/app/admin` y `/app/secretaria` deben ir al dashboard? |
| H07 | ¿Qué debe ver una secretaria sin sede asignada? |
| I07 | ¿"Usuarios" y "Notificaciones" del admin necesitan ítem de menú? |
| K02 / K07 | Al desactivar, cambiar rol o sede de alguien conectado: ¿se le expulsa en el momento? |
| M07 | ¿Aviso del navegador al cerrar la pestaña con un borrador de matrícula? |
