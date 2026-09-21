# Fix: Recortar Clase Profesional a solo Matrícula + Base de Alumnos

> id: fix-256-m
> refs: ASG-i-009
> status: done
> closed: 2026-09-21
> created: 2026-09-21

## Root Cause

Decisión de alcance para la primera entrega del piloto (reunión de equipo, 2026-09-15,
mismo origen que ASG-i-008/fix-255-m): de Clase Profesional solo queda visible en esta fase
"Matricular a Clase Profesional" (wizard compartido con Clase B, no se toca) y "Base de
Alumnos Profesional". El resto de Clase Profesional (Pre-inscritos, Relatores, Promociones,
Asistencia, Certificados, Evaluaciones, Archivo, Ex-Alumnos Profesional — 8 módulos, admin y
secretaria) no tiene ningún mecanismo que lo oculte hoy: las 16 rutas (8 × 2 roles) son
alcanzables por URL directa y sus 14 ítems de menú (7 × 2 roles; Pre-inscritos no tiene ítem
de menú) siguen visibles.

Verificación de dependencias hecha en ASG-i-009 (2026-09-16, código real revisado): ocultar
Promociones y Relatores es seguro para el flujo de matrícula — las promociones se
auto-generan vía `pg_cron` (`auto-create-next-promotions`) y `EnrollmentFacade` solo lee
`promotion_courses` ya existentes. Sin acoplamiento con las pantallas ocultas.

Reutiliza el mecanismo de fase de fix-255-m (`pilot-phase.config.ts` +
`pilotPhaseGuard`) — no se diseña un segundo sistema de flags.

## ACs Afectados

Ninguno — fix autónomo (originado de una Asignación de equipo, sin spec previa).

- AC-1: Las 16 rutas de los 8 módulos ocultos (admin `clase-profesional/*` + secretaria
  `profesional/*`, ambas variantes de `ex-alumnos-profesional`) redirigen a
  `/modulo-no-disponible` en vez de renderizar, tanto para admin como para secretaria.
- AC-2: `clase-profesional/alumnos` (admin) y `profesional/alumnos` (secretaria) — Base de
  Alumnos Profesional — siguen accesibles sin cambios.
- AC-3: La ruta de matrícula (`admin/matricula`, `secretaria/matricula`) sigue funcionando
  igual para ambas categorías de curso — no se toca el wizard.
- AC-4: El menú lateral (`menu-config.service.ts`) no ofrece los ítems de los 7 módulos
  ocultos que sí tenían ítem de menú (Promociones, Relatores, Asistencia Prof., Evaluaciones,
  Certificados Prof., Archivo, Ex-Alumnos Prof.) para admin ni secretaria. "Base Alumnos
  Prof." y "Libro de Clases" (fuera de alcance, no está en la lista de 8) siguen visibles.
- AC-5: El estado bloqueado/habilitado vive en un solo lugar
  (`pilot-phase.config.ts` — nuevo valor `'clase-profesional-recorte'` en
  `PilotBlockedModule`), consultado tanto por el guard de rutas como por el menú. Apagar la
  fase = sacar el valor del Set.
- AC-6: No se borra código, rutas, componentes ni tests de los 8 módulos ocultos.
- AC-7: `npm run lint:arch` y `npm run test:ci` pasan.

## Cambio

- **`src/app/core/config/pilot-phase.config.ts`** — agrega `'clase-profesional-recorte'` a
  `PilotBlockedModule` y a `BLOCKED_MODULES`.
- **`src/app/app.routes.ts`** — agrega
  `canActivate: [pilotPhaseGuard('clase-profesional-recorte')]` a las 16 rutas de los 8
  módulos (admin `clase-profesional/pre-inscritos|relatores|promociones|asistencia|
  certificados|evaluaciones|archivo`, `ex-alumnos-profesional`; secretaria
  `profesional/pre-inscritos|relatores|promociones|asistencia|evaluaciones|certificados|
  archivo`, `ex-alumnos-profesional`). En las 7 rutas de secretaria que ya tienen
  `canActivate: [professionalBranchGuard]`, se agrega el guard nuevo al mismo arreglo (ambos
  deben pasar). No toca `clase-profesional/alumnos` / `profesional/alumnos` (Base de Alumnos)
  ni `admin/matricula` / `secretaria/matricula`.
- **`src/app/core/services/auth/menu-config.service.ts`** — marca los 7 `NavItem` de
  "Academia Profesional" que corresponden a los módulos ocultos con
  `hiddenInPilotRecorte: true` (Promociones, Relatores, Asistencia Prof., Evaluaciones,
  Certificados Prof., Archivo, Ex-Alumnos Prof., en admin y secretaria). El `computed()` de
  `menuItems` filtra esos ítems del grupo "Academia Profesional" cuando
  `isBlockedInPilot('clase-profesional-recorte')` es true, antes de devolver
  `ADMIN_NAV`/`SECRETARIA_NAV`.

## Test de Regresión

- `pilot-phase.config.spec.ts` — agregar `'clase-profesional-recorte'` al
  `it.each` existente de módulos bloqueados.
- `menu-config.service.spec.ts` — nuevo test: para admin y secretaria, el grupo "Academia
  Profesional" no contiene ítems con `routerLink` de los 7 módulos ocultos, pero sí contiene
  "Base Alumnos Prof." y "Libro de Clases".
- Manual: login admin → navegar por URL directa a
  `/app/admin/clase-profesional/promociones` → confirmar redirect a
  `/modulo-no-disponible`; confirmar que `/app/admin/clase-profesional/alumnos` y
  `/app/admin/matricula` siguen renderizando. Repetir para secretaria con
  `/app/secretaria/profesional/relatores`.
