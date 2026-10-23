# fix-229-b — "Mantener sesión iniciada" no hacía nada

- **Autor:** b
- **Origen:** ASG-i-022 (checklist 022, A19 / S10). Decisión del owner (2026-10-19): implementarla.
- **Estado:** cerrado (2026-10-19)

## Bug

La casilla "Mantener sesión iniciada" del login (marcada por defecto) no tiene efecto: la sesión
siempre queda guardada en el navegador. En el PC compartido del mostrador, si alguien la desmarca y
cierra el navegador, la próxima persona abre la app con la sesión anterior.

## Criterios

- **R1** — Casilla marcada: como hoy (la sesión sobrevive a cerrar el navegador).
- **R2** — Casilla desmarcada: la sesión sirve en todas las pestañas mientras el navegador siga
  abierto; al cerrarlo y volver a abrir la app, pide iniciar sesión.
- **R3** — Recargar o abrir otra pestaña con la casilla desmarcada no cierra la sesión.
- **R4** — Cerrar sesión limpia la preferencia (el próximo login parte de cero).

## Cambio

- `core/utils/remember-session.utils.ts` (+ spec): `shouldDiscardStoredSession()`,
  `supabaseStorageKey()` y las claves.
- `core/services/infrastructure/supabase.service.ts` (+ spec): antes de crear el cliente descarta la
  sesión guardada si corresponde; `setRememberSession(remember)` guarda la preferencia
  (`localStorage`) y la marca de navegador abierto (cookie de sesión, sin vencimiento).
- `core/facades/auth.facade.ts` (+ spec): `login(email, password, rememberMe = true)`; `logout()`
  limpia la preferencia.
- `features/auth/login/login.component.ts`: pasa `rememberMe`.

No se guarda la sesión en una cookie: puede pasar los 4 KB. La cookie es solo una marca.

## Test de Regresión

- vitest del util, `SupabaseService`, `AuthFacade`.
- e2e: login con la casilla desmarcada → "cerrar el navegador" (contexto nuevo sin cookies de
  sesión, mismo `localStorage`) → pide login; con la casilla marcada → sigue adentro.

## Verificación

- [x] vitest: util 4/4, SupabaseService + AuthFacade + login 67/67.
- [x] e2e R1–R3 en verde (R2 falla sin el cambio) + login/salir sin regresión.
