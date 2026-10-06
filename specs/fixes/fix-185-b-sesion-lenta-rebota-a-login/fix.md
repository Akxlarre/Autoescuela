# Fix: Con red lenta, un usuario con sesión válida rebota a /login
> id: fix-185-b-sesion-lenta-rebota-a-login
> refs: ASG-i-022 (hallazgo H1 de fix-183-b — sospecha S17 del checklist 022)
> status: done
> created: 2026-10-06

## Root Cause
[Confirmado en fix-183-b: con 4 navegadores en paralelo, usuarios con sesión válida terminaron en
`/login` y el setup de la suite falló una vez con el login hecho en el servidor.] Dos relojes fijos
en `AuthFacade` deciden por el usuario cuando la red es lenta:

1. **`whenReady`** = `Promise.race([cargaInicial, timeout de 5 s])`. Si restaurar la sesión y
   leer el perfil tarda más de 5 s, los guards (`authGuard`, `hasRoleGuard`, `roleRedirectGuard`…)
   leen `currentUser() = null` y mandan a `/login`, aunque la sesión sea válida y el perfil llegue
   un instante después.
2. **`login()`** hace polling de `currentUser()` cada 100 ms durante 5 s y, si no llegó, devuelve
   éxito igual: el login navega a `/app` sin perfil → `roleRedirectGuard` cierra la sesión y vuelve
   a `/login` sin ningún mensaje.

3. **(Hallado al validar en paralelo)** un **corte de red** al leer el perfil no se distinguía de
   "usuario sin perfil": `buildUserFromDb` armaba el usuario con rol `'unknown'` y
   `roleRedirectGuard` **cerraba la sesión** (`logout`). Trace: `GET users` → status -1 a los 0,9 s
   → `POST /auth/v1/logout`. Un parpadeo de red echaba a un usuario con sesión válida.

## ACs Afectados
Ninguno de una spec previa — fix autónomo (origen ASG-i-022). ACs propios:

- **F1:** `whenReady` se resuelve cuando termina la carga inicial (sesión + perfil), aunque tarde
  más de 5 s. El timeout de seguridad sube a 15 s (solo para que la app no quede colgada si
  Supabase no responde).
- **F2:** `login()` espera la carga del perfil de la sesión que devuelve el login (no polling ni
  reloj). Si el perfil no se puede cargar, devuelve un error claro ("No se pudo cargar tu perfil…")
  y no navega.
- **F3:** cargas concurrentes del mismo usuario (evento `SIGNED_IN` + `login()`) comparten una sola
  consulta del perfil.
- **F4:** un error de red/servidor al leer el perfil se reintenta (esperas de 1 s y 2 s). Si sigue
  fallando, la carga **lanza** en vez de inventar un usuario con rol `'unknown'`: el usuario queda
  sin cargar y la sesión **no se cierra** (recargar basta). Sin fila en `users` (respuesta OK con
  `data = null`) sigue siendo rol `'unknown'`, sin reintento. `refreshProfile` (Realtime) conserva
  el perfil vigente si la relectura falla.

## Cambio
- `src/app/core/facades/auth.facade.ts` (+ spec) — F1, F2, F3, F4.
- `e2e/auth-sesion.spec.ts` — `E2E_PARALLEL=1` corre el archivo en paralelo (prueba de carga de
  S17); esperas de 20–30 s para la BD del piloto saturada por 4 navegadores.
- `src/app/core/services/infrastructure/supabase.service.ts` — sin cambios de firma (`signIn` ya
  devuelve `{ data, error }`).

## Test de Regresión
- `npx vitest run src/app/core/facades/auth.facade.spec.ts` (timers falsos: perfil que tarda 8 s).
- `e2e/auth-sesion.spec.ts` y su setup en **paralelo** (4 workers): antes daba 7 fallas por `/login`.

## Resultado (2026-10-06)
- Vitest: `auth.facade.spec.ts` 29/29 (8 nuevos: perfil que tarda 8 s, tope de 15 s, login que
  espera, login sin perfil, carga compartida, reintento tras corte de red, falla persistente sin
  cerrar la sesión, sin fila = sin reintento). `npm run test:ci` 3299/3299. `ng build` OK,
  `npm run lint:arch` exit 0.
- E2E en paralelo (`E2E_PARALLEL=1 … --workers=4`, build de producción):
  | Corrida | Resultado |
  |---|---|
  | Antes del fix (fix-183-b) | 7 fallas por `/login` / guard colgado |
  | F1–F3 | 86/88 — 0 rebotes a `/login`; 2 fallas de espera del test (sidebar a los 10 s) |
  | F1–F3 + esperas 20 s | 86/88 — 1 rebote: `GET users` falló (red) → rol `unknown` → `logout` → **origen de F4** |
  | F1–F4 | **87/88** — el único caso: el `GET users` quedó **sin respuesta > 15 s** (BD del piloto saturada por 4 navegadores, consultas de 30 s) y ganó el tope de seguridad → `/login`, **sin `logout`**: la sesión sigue viva y recargar basta |
- **Residual aceptado:** si leer el perfil tarda más de 15 s la app va a `/login` en vez de quedar
  colgada (decisión de diseño del tope). Ya no cierra la sesión.
