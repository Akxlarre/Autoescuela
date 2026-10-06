# Fix: Testing — autenticación, sesión, roles y bloqueo de fase piloto
> id: fix-183-b-testing-autenticacion-sesion
> refs: ASG-i-022
> status: in_progress
> created: 2026-10-05

## Root Cause
[Heredado de ASG-i-022.] Track de **testing**, no de un bug puntual: ejecutar el checklist
`specs/testing-piloto/022-autenticacion-sesion-fase-piloto.md` (login, sesión, primer login,
recuperar contraseña, logout, rutas por rol, matriz de fase piloto, menú, pantallas de aviso) y
dejar automatizado en Playwright todo lo marcado "Auto ✓".

Regla de la tanda: **cada bug encontrado va a su propio fix/hotfix**; acá solo se registra el
resultado de cada caso (✅ / ❌ + evidencia).

## ACs Afectados
Ninguno de una spec previa — track de testing (origen ASG-i-022). Criterios propios:

- **T1:** cada caso automatizable del checklist tiene un test en `e2e/auth-sesion.spec.ts`
  (o en un spec hermano) y su resultado queda anotado abajo.
- **T2:** la suite corre contra un **build de producción** servido en `localhost:4200` (en
  `ng serve`, `authGuard` deja pasar sin sesión — S14 — y varios casos saldrían distintos).
- **T3:** los casos manuales (red lenta, 2 equipos, correo real, cambios en caliente) quedan
  listados con su resultado o como pendientes con dueño.
- **T4:** cada ❌ tiene su propio track (fix/hotfix) o una decisión registrada.

## Cambio
- `e2e/auth-sesion.spec.ts` — tests nuevos (sin cambios de producción en este track).

## Test de Regresión
- `npx playwright test e2e/auth-sesion.spec.ts` contra el build de producción en `localhost:4200`.

## Resultados — automatizados (`e2e/auth-sesion.spec.ts`, build de producción, 2026-10-05)

**Corrida final:** 90/90 en verde en serie (8,7 min), incluidos los 2 `knownBug` (F07, J06) que fallan como se espera.

**Ambiente:** `ng build` (configuración production) servido en `localhost:4200` con fallback SPA,
contra la BD del piloto. Cuentas: admin = D1, secretariaA (sede 1, sin Profesional) = D2,
secretariaB (sede 2, con Profesional) = D3, secretariaMultisede = D4.

| Casos | Resultado |
|---|---|
| A01, A03, A04, A05, A08, A09, A17, O02 | ✅ (A03: el panel de credenciales ya no aparece en producción — **S3 descartada**, la corrigió `hotfix-007-i`) |
| B01, B09, B10, C10, C11 | ✅ |
| D01, D02, D09 | ✅ (D09: `/recuperar-contrasena` sin sesión de recuperación → `/login`; stub eliminado por `fix-181-b`) |
| E01–E04 | ✅ (modal, Cancelar, "Sí, salir" → `/login`, Atrás no vuelve) |
| F01–F06, F08 | ✅ comportamiento actual: rutas de otro rol → **su dashboard sin aviso** (S9 — queda como decisión, ver abajo) |
| F07 | ❌ conocido (`knownBug`): `/app/admin` y `/app/secretaria` sin sub-ruta → 404 (**S18 confirmada**) |
| G01–G18 (matriz completa de rutas bloqueadas, 3 perfiles de secretaria) | ✅ |
| G31, G32, G33 | ✅ (G32: `/inscripcion/retorno` no llama a `public-enrollment`) |
| H01–H03, I02, I03, I04 | ✅ (I04: cada ítem del menú de admin y secretaria abre su pantalla) |
| J01, J03, J07, J08 | ✅ |
| J06 | ❌ conocido (`knownBug`): `/acceso-denegado` sigue siendo un stub "PLANO" (**S9**) |

## Hallazgos de esta ejecución

| # | Hallazgo | Evidencia | Destino |
|---|---|---|---|
| H1 | **S17 confirmada (con carga):** con 4 navegadores en paralelo, usuarios con sesión válida terminaron en `/login` o la pantalla quedó esperando el guard > 10 s. Las mismas 7 pruebas pasan corriendo de a una → no es un error de permisos sino la carrera de 5 s de `whenReady` (`auth.facade.ts`). Con red lenta un usuario real puede rebotar al login | corrida paralela 2026-10-05: 7 fallas por `/login`/timeout; en serie 11/11 | track propio (pendiente de crear) |
| H2 | **S11 confirmada y peor:** el form de nueva clave acepta 6 caracteres (`Validators.minLength(6)`) pero Supabase exige **8** (`password_min_length = 8`). Con 6–7 el usuario recibe el genérico "Error de autenticación" porque `mapAuthError` solo reconoce "at least **6**" | `force-password-change.component.ts:141`, `auth-errors.utils.ts:48`, config Auth | hotfix propio |
| H3 | **S19 confirmada:** `disable_signup = false` en el proyecto. Ningún código de la app llama `signUp` (solo está definido en `AuthFacade`/`SupabaseService`) → cualquiera con la anon key crea cuentas de Auth (sin fila en `users`, no leen datos) | Management API `config/auth` | **decisión del owner** (cambio de configuración) |
| H4 | **E11 — el cierre de sesión es global:** `signOut()` sin `scope` revoca **todas** las sesiones de la cuenta (otros equipos y pestañas). Visto al correr la suite: el logout de un test cerró la sesión que usaban otros tests de la misma cuenta | corrida paralela | **decisión** (¿`scope: 'local'`?) |
| H5 | **N05 — config Auth del piloto:** Site URL y allowlist = `http://localhost:4200` (pendiente de dominio, ya en `docs/DEPLOY.md`); `jwt_exp = 3600`; rotación de refresh token activa; `rate_limit_email_sent = 30/h`; `password_min_length = 8` | Management API | registrado |

## Casos manuales (no automatizables o que necesitan 2 equipos / correo / red)

| Casos | Estado |
|---|---|
| K01–K04 (usuario desactivado) | ✅ verificados por el owner el 2026-10-05 tras `fix-180-b` (no entra; sesión abierta pierde los datos) |
| C01, C14, C15 (primer login con clave = RUT) | **Obsoletos:** desde `fix-182-b` las secretarias se crean sin clave y activan por correo (verificado de punta a punta el 2026-10-05) |
| D03–D08, D10 (correo de recuperación) | Pendiente tras el release de `fix-181-b`; mientras la Site URL sea localhost, probar con la app local (ver `fix-181-b`) |
| A10–A16, A18, A19, B03–B08, C02–C09, C12, C13, E05–E11, F09, F10, G19–G30, G34, H04–H10, I01, I05–I08, J02, J04, J05, J09–J12, K05–K10, L01–L05, M01–M08, N01–N04, O01, O03–O06 | **Pendientes** — siguiente sesión (varios se pueden sumar a la suite: E05/E06, G19, M01–M05) |

## Sospechas ya resueltas antes de este track (2026-10-01 → 05)
| Sospecha | Resultado |
|---|---|
| S1 — recuperar contraseña no pide clave nueva | Confirmada → `fix-181-b` (PR #183, pendiente de release) |
| S2 — usuario desactivado sigue entrando | Confirmada en vivo → `fix-180-b`, en producción; bloqueo verificado por el owner |
| S5 — clave inicial = RUT | Confirmada → `fix-182-b`, en producción; prueba de punta a punta OK |
