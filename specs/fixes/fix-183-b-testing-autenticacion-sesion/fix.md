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
| H1 | **S17 confirmada (con carga):** con 4 navegadores en paralelo, usuarios con sesión válida terminaron en `/login` o la pantalla quedó esperando el guard > 10 s. Las mismas 7 pruebas pasan corriendo de a una → no es un error de permisos sino la carrera de 5 s de `whenReady` (`auth.facade.ts`). Con red lenta un usuario real puede rebotar al login | corrida paralela 2026-10-05: 7 fallas por `/login`/timeout; en serie 11/11 | `fix-185-b` (whenReady espera al perfil, login espera al perfil, reintento ante cortes de red sin cerrar la sesión) |
| H2 | **S11 confirmada y peor:** el form de nueva clave acepta 6 caracteres (`Validators.minLength(6)`) pero Supabase exige **8** (`password_min_length = 8`). Con 6–7 el usuario recibe el genérico "Error de autenticación" porque `mapAuthError` solo reconoce "at least **6**" | `force-password-change.component.ts:141`, `auth-errors.utils.ts:48`, config Auth | ✅ corregido en `hotfix-059-b` (PR #188) |
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

## Segunda tanda (2026-10-16)

`e2e/auth-sesion.spec.ts` + `e2e/auth-sesion-2.spec.ts` contra `ng serve`: **101/102** — la única
falla es A03, que exige el build de producción (en `ng serve` el panel de credenciales aparece a
propósito). Ya no quedan `knownBug`: F07 y J06 los cerró `fix-184-b`. I02 se actualizó: desde la
spec `0051-b` la secretaria **sí** ve Flota (decisión 9 de ASG-i-032).

| Casos | Resultado |
|---|---|
| A10 | ✅ correo en mayúsculas y con espacios entra |
| A11 | ✅ Enter envía |
| **A12** | ❌ → `hotfix-090-b` (#300): un doble clic mandaba dos logins |
| A13 | ✅ sin red: mensaje de conexión y el botón vuelve |
| A14 | ✅ ojo de la contraseña con su `aria-label` |
| **A15 / S13** | ❌ → `hotfix-089-b` (#299): "Request rate limit reached" y "email rate limit exceeded" caían en el genérico |
| B08 | ✅ borrar el almacenamiento → `/login` |
| E05, E07 | ✅ la sede del admin no la hereda la secretaria; el admin vuelve a ver su selector |
| G19 | ✅ por diseño: Pre-inscritos se muestra dentro de Base Alumnos Prof., sin navegar al módulo bloqueado |
| H10 | ✅ F5 en Base Alumnos Prof. (secretaria con Profesional) se queda ahí |
| I05 | ✅ solo el ítem actual resaltado |
| I08 | ✅ en 375 px el menú se abre y se cierra al navegar |
| K09 | ✅ nombre del panel = BD |
| L01 | ✅ cerrar sesión en una pestaña saca a la otra sin recargar |
| N03 / S19 | ✅ el registro público está cerrado (`disable_signup = true`; antes era decisión H3) |
| O03 | ✅ orden de Tab en el login y foco visible |

**Decisiones ya resueltas por otros tracks:** E11 (logout local) y S9 (aviso "No tienes acceso a esa
sección") en `fix-184-b`; H1 (rebote a /login con red lenta) en `fix-185-b`; H3 cerrado
(`disable_signup = true`).

**Bloqueados:** D03–D08, D10 (correo de recuperación) → `fix-181-b`, esperando el dominio
definitivo para la Site URL de Auth. G20–G30, H06/H07, J05 → necesitan cuentas de instructor,
alumno o secretaria sin sede (portal del instructor/alumno bloqueado en el piloto).

**Pendientes manuales:** A16, A18, A19, B03–B07, C02–C13 (primer login: desde `fix-182-b` las
secretarias activan por correo, revisar cuáles siguen aplicando), E06, E08–E10, F09, F10, G34,
H04, H05, H08, H09, I01, I06, I07, J02, J04, J09–J12, K05–K08, K10, L02–L05, M01–M08, N01, N02, N04,
O01, O04–O06.

## Tercera tanda (2026-10-19)

`e2e/auth-sesion-3.spec.ts`: **16/16 en verde** (sin escrituras: red lenta, 401 y errores simulados).

| Casos | Resultado |
|---|---|
| B03 / S17 | ✅ recargar con 3 s de demora en cada consulta termina en la pantalla correcta, sin rebotar a /login |
| **B07** | ❌ → `hotfix-093-b` (#309): sesión expirada al guardar decía "…procesando la solicitud (PGRST303)" |
| E06, E08 | ✅ al cambiar de usuario no queda la búsqueda del anterior; la API solo entrega notificaciones propias |
| **E10** | ❌ → `hotfix-091-b` (#307): "Sí, salir" sin red dejaba la sesión abierta en el equipo |
| F09 | ✅ la ficha de un alumno de la otra sede muestra un mensaje claro, no una ficha rota |
| F10 | ✅ Configuración web y Contabilidad › Cursos abren para la secretaria (son rutas suyas) |
| I01, I07 | ✅ grupos del menú del admin; `/app/admin/notificaciones` existe sin ítem de menú (anotado) |
| **J04 / S16** | ❌ → `hotfix-092-b` (#308): al recargar, "Volver al inicio de sesión" aparecía a un admin |
| J09, J12 | ✅ política en 375 px sin scroll horizontal; 404 legible en modo oscuro |
| L02 / S8 | ✅ la pestaña del admin no queda con la sesión de la secretaria que entró en otra |
| N01 | ✅ con sesión de la secretaria de la sede 1, la API no entrega matrículas de la sede 2 |
| O04, O06 | ✅ el error de login tiene `role="alert"` + `aria-live="assertive"`; un mensaje largo no ensancha la card |

**Siguen pendientes (manuales o bloqueados):** A16, A18, A19 (decisiones), B04–B06 (tiempo real:
token de 1 h, suspensión, sesión invalidada desde otro equipo), C02–C13 (primer login, revisar
vigencia tras `fix-182-b`), D03–D08, D10 (dominio), E09, G20–G30, G34, H04–H09, I06, J02, J05,
J10, J11, K05–K08, K10, L03–L05, M01–M08 (borrador de matrícula), N02, N04, O01, O05.

## Decisiones del owner (2026-10-19)

| Caso | Decisión | Track |
|---|---|---|
| A18 | Después del login se vuelve a la pantalla pedida (solo rutas internas `/app/...`) | `hotfix-096-b` (#315) |
| A19 | "Mantener sesión iniciada" se implementa: desmarcada, la sesión dura mientras el navegador esté abierto | `fix-229-b` (#317) |

## Cuarta tanda (2026-10-19)

`e2e/auth-sesion-4.spec.ts`: **12/12 en verde** (sin escrituras).

| Casos | Resultado |
|---|---|
| H04, H05 | ✅ secretaria con grant en "Todas": la página profesional salta a Conductores y deshabilita "Todas"; al salir, el selector vuelve a quedar libre |
| **H08, H09** | ❌ → `hotfix-098-b` (#320): "Conmutar Sede" a veces decía "No se encontró una sede profesional disponible" (3 de 6 intentos; la lista de sedes aún no cargaba). Tras el fix: 6/6 |
| J10, J11 | ✅ la política se ve igual con sesión (sin menú) y en vista de impresión |
| K10 | ✅ Ajustes muestra la cuenta "Activo" |
| L03 | ✅ cambiar la sede en una pestaña no cambia la otra hasta recargar; al recargar toma la última |
| M04 | ✅ salir del wizard recién abierto (sin borrador) no pide confirmación |
| O01 | ✅ login, Módulo no disponible y 404 legibles en modo oscuro |

**Quedan (manuales o bloqueados):** A16 (sin cuenta sin perfil), B04–B06 (tiempo real), C02–C13
(primer login, desde `fix-182-b` las secretarias activan por correo), D03–D08/D10 (dominio),
E09/M01–M03/M06–M08 (crean un borrador de matrícula real), G20–G30, H06/H07, I06, J02, J05
(cuentas de instructor/alumno/sin sede), G34, K08, L04, L05,
N02, N04, O05.

## Quinta tanda (2026-10-19)

`e2e/auth-sesion-5.spec.ts`: **2/2 en verde, 3 corridas seguidas**. Escribe en las cuentas de
prueba `secretaria@test.com` / `secretaria2@test.com` y deja los valores originales en `finally`
(verificado en la BD después de cada corrida).

| Casos | Resultado |
|---|---|
| K05 | ✅ el admin da el grant multisede → el selector de sede aparece sin recargar (canal Realtime `user-self`) |
| K06 | ✅ el admin lo quita → el selector desaparece y la marca queda en la sede propia |
| K07 | ✅ el admin cambia la sede → la marca del menú cambia sin recargar y se mantiene al recargar |

Nota: el cambio llega por Realtime cuando el canal ya está unido; el test espera 5 s después de
cargar para representar al admin actuando sobre una sesión asentada.
