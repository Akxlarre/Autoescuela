# Fix: Guard de fase piloto — ocultar Instructor/Alumno y bloquear matrícula pública online

> id: fix-255-m
> refs: ASG-i-008, ASG-i-010, ASG-i-013
> status: done
> closed: 2026-09-19
> created: 2026-09-19

## Root Cause

[Heredado de ASG-i-008/ASG-i-010/ASG-i-013, a confirmar]: la primera entrega del piloto es
solo Admin + Secretaria (decisión de equipo, reunión 2026-09-15, documento "Piloto
Secretaría-Admin"). Hoy no existe ningún mecanismo que lo haga cumplir:

- `/app/instructor/**` y `/app/alumno/**` están protegidos únicamente por `hasRoleGuard`
  (rol correcto → entra). Cualquier cuenta `instructor`/`alumno` real sigue pudiendo entrar
  y el menú (`menu-config.service.ts`, casos `case 'instructor':`/`case 'alumno':`) sigue
  ofreciendo sus ítems.
- `/inscripcion` y `/inscripcion/retorno` (matrícula pública, `app.routes.ts`) están fuera
  del `AppShell`, sin ningún `canActivate` — no exigen ni siquiera estar autenticado. Como
  además procesan pagos reales por pasarela (`PublicEnrollmentFacade` + Edge Function
  `public-enrollment`), dejarlas alcanzables por URL directa es el escenario de mayor riesgo
  de los tres (dinero real, no solo UI expuesta).
- No existe la pantalla "módulo no habilitado todavía" (`ASG-i-010`) — hoy solo existe
  `acceso-denegado`, que es un stub sin terminar ("Pendiente calcar desde mockup") y
  semánticamente incorrecto para este caso: no es un problema de permisos, es una fase.

Se agrupan las 3 Asignaciones en un solo track (decisión tomada al reclamar, confirmada con
el usuario) porque `ASG-i-008` ya señala que conviene resolverlas juntas: las tres comparten
el mismo mecanismo de fase y el guard de `ASG-i-008` necesita la pantalla de `ASG-i-010`
como destino de redirect para poder existir. `ASG-i-009` (recorte de Clase Profesional)
queda fuera — es un recorte de menú/rutas dentro de un portal que sí se entrega (no un
bloqueo de portal completo) y tiene su propia nota de riesgo sobre datos de Promociones que
amerita su propio track.

## ACs Afectados

Ninguno — fix autónomo (originado de Asignaciones de equipo, sin spec previa).

- AC-1: Una cuenta con rol `instructor` o `alumno` que inicia sesión no puede navegar a
  ningún ítem de su portal — el menú lateral no ofrece esos grupos y la navegación directa
  por URL a `/app/instructor/**` o `/app/alumno/**` redirige a la pantalla de aviso.
- AC-2: `/inscripcion` e `/inscripcion/retorno` redirigen a la misma pantalla de aviso sin
  renderizar el formulario de matrícula ni permitir iniciar un pago por pasarela.
- AC-3: La pantalla de aviso (`/modulo-no-disponible`) es distinta de `/acceso-denegado` —
  comunica "todavía no disponible en esta fase", no "no tienes permiso".
- AC-4: El estado habilitado/bloqueado de cada módulo vive en un solo lugar
  (`pilot-phase.config.ts`) — apagar la fase para un módulo es un cambio de una línea, sin
  buscar guards ni casos de menú repartidos por el código.
- AC-5: El código de los 4 portales y de matrícula pública sigue existiendo intacto — no se
  borra ninguna ruta, componente, facade ni test.
- AC-6: `npm run lint:arch` y `npm run test:ci` pasan.

## Decisión explícita (nota #4 de ASG-i-008)

No se bloquea el login para cuentas `instructor`/`alumno` — se deja que autentiquen
normalmente y el guard de fase les impide navegar a cualquier pantalla útil de su portal
(redirige a `/modulo-no-disponible`). Motivo: las cuentas de prueba de esos roles siguen
siendo necesarias para QA interno durante el piloto, y bloquear el login mismo requeriría
distinguir "cuenta de prueba" de "cuenta real" en `authGuard`/login, alcance no cubierto por
esta Asignación. Si aparece una cuenta real de instructor/alumno antes de levantar la fase,
el efecto práctico es el mismo: entra pero no tiene a dónde ir.

## Cambio

- **`src/app/core/config/pilot-phase.config.ts`** (nuevo) — fuente única de verdad: un
  `ReadonlySet<PilotBlockedModule>` con los 3 módulos bloqueados
  (`'instructor' | 'alumno' | 'inscripcion-publica'`) y la función pura
  `isBlockedInPilot(module)`. Apagar la fase para un módulo = sacarlo del Set.
- **`src/app/core/guards/pilot-phase.guard.ts`** (nuevo) — `pilotPhaseGuard(module)`,
  factory `CanActivateFn` sin dependencia de `AuthFacade` (aplica igual a rutas públicas
  como `/inscripcion`): si `isBlockedInPilot(module)`, redirige a
  `router.createUrlTree(['/modulo-no-disponible'])`; si no, `true`.
- **`src/app/features/modulo-no-disponible/modulo-no-disponible.component.ts`** (nuevo) —
  página standalone, `OnPush`, fuera del `AppShell` (mismo nivel que `acceso-denegado`).
  Mensaje: módulo no habilitado todavía en esta fase del sistema, con link a `/login`.
  Terminada (no stub) — usa tokens del DS, sin colores hardcodeados.
- **`src/app/app.routes.ts`**:
  - Nueva ruta top-level `modulo-no-disponible` (junto a `acceso-denegado`).
  - `path: 'inscripcion'` y `path: 'inscripcion/retorno'` agregan
    `canActivate: [pilotPhaseGuard('inscripcion-publica')]`.
  - Grupos `path: 'instructor'` y `path: 'alumno'` (bajo `path: 'app'`) agregan
    `pilotPhaseGuard('instructor')`/`pilotPhaseGuard('alumno')` a su `canActivate`, junto al
    `hasRoleGuard` existente.
- **`src/app/core/services/auth/menu-config.service.ts`** — casos `case 'instructor':` y
  `case 'alumno':` del `computed()` de `menuItems` devuelven `[]` cuando
  `isBlockedInPilot(...)` es true, en vez de `INSTRUCTOR_NAV`/`ALUMNO_NAV`.

## Test de Regresión

- `pilot-phase.config.spec.ts` — `isBlockedInPilot` para los 3 módulos bloqueados y un caso
  no bloqueado (ej. `'admin'` si se tipa como módulo general, o test de que el Set solo
  contiene los 3 esperados).
- `pilot-phase.guard.spec.ts` — bloqueado → `createUrlTree(['/modulo-no-disponible'])`; no
  bloqueado → `true`. Mismo patrón que `professional-branch.guard.spec.ts` (TestBed +
  `runInInjectionContext`).
- `menu-config.service.spec.ts` (si no existe, crear) — rol `instructor`/`alumno` con fase
  activa → `menuItems()` devuelve `[]`.
- Manual: login con cuenta de prueba `instructor` → confirmar menú vacío de ese grupo y que
  `/app/instructor/dashboard` por URL directa redirige a `/modulo-no-disponible`. Repetir
  para `alumno`. Navegar a `/inscripcion` sin sesión → confirmar redirect sin ver el
  formulario de matrícula.
