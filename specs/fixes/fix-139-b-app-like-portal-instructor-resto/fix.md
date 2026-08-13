# Fix: App-like: portal instructor resto (`dashboard`, `alumnos`, `liquidacion`, `ensayos-teoricos`, `notificaciones`)
> id: fix-139-b-app-like-portal-instructor-resto
> refs: ASG-b-078
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
[Heredado de ASG-b-078, a confirmar]: Paso 11 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`) — 5 páginas del portal instructor que no forman parte de
otra familia (tareas y horario ya cubiertas en otras piezas) no siguen el patrón app-like
(fill-screen desktop / scroll interno). Son independientes entre sí, sin componente
compartido:

- **`/instructor/dashboard`** (`InstructorDashboardComponent`): hero + 1 SOLA
  `.bento-banner` con grid Tailwind interno `lg:grid-cols-3` (Clases de Hoy `col-span-2` +
  sidebar `col-span-1`) — no son celdas bento separadas. Plan: root → `--fill-screen`
  singular; banner → `bento-fill flex flex-col h-full overflow-y-auto` (scroll compartido,
  la lista "de hoy" suele ser corta).
- **`/instructor/alumnos`** (`InstructorAlumnosComponent`): paginación hand-rolled
  (`PAGE_SIZE=9`, `pageStart/pageEnd`), cards en un `.bento-grid` anidado dentro de la
  `.bento-banner` externa. Plan: root → `--fill-screen`; banner externa → `bento-fill flex
  flex-col h-full`; grid anidado de cards → `flex-1 min-h-0 overflow-y-auto`. Sacar
  paginación hand-rolled → patrón `sliceByBudget` + "Cargar más" (mobile) / todo+scroll
  (desktop), mismo criterio que ASG-b-066.
- **`/instructor/liquidacion`** (`InstructorLiquidacionComponent`): NO son 2 banners — es 1
  SOLA `.bento-banner` con `flex flex-col gap-6` interno (chart de desglose + tabla de logs
  diarios). Plan: root → `--fill-screen` singular; banner → `bento-fill flex flex-col
  h-full`; chart → `shrink-0`; tabla de logs → `flex-1 min-h-0 overflow-y-auto`.
- **`/instructor/ensayos-teoricos`** (`InstructorEnsayosTeoricosComponent`): hero + 1
  `.bento-banner` con 2 `<table>` hand-rolled (resultados/historial), sin paginación. Plan:
  `--fill-screen` singular, `.bento-fill` en la banner, evaluar scroll independiente por
  tabla al implementar.
- **`/instructor/notificaciones`** (`InstructorNotificacionesComponent`): lista corta de
  notificaciones (única página de notificaciones NO stub de los 4 portales). Prioridad baja
  dentro de este lote — `--fill-screen` opcional.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
Ninguno — fix autónomo (rollout de layout, no cambia contrato de negocio).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** `src/app/features/instructor/dashboard/instructor-dashboard.component.ts`
  — **Qué cambia:** root a `--fill-screen`, banner a `bento-fill flex flex-col h-full overflow-y-auto`.
- **Archivo:** `src/app/features/instructor/alumnos/instructor-alumnos.component.ts`
  — **Qué cambia:** root a `--fill-screen`, banner externa `bento-fill flex flex-col h-full`, grid anidado `flex-1 min-h-0 overflow-y-auto`, reemplazar paginación hand-rolled por `sliceByBudget`+"Cargar más".
- **Archivo:** `src/app/features/instructor/liquidacion/instructor-liquidacion.component.ts`
  — **Qué cambia:** root a `--fill-screen`, banner `bento-fill flex flex-col h-full`, chart `shrink-0`, tabla de logs `flex-1 min-h-0 overflow-y-auto`.
- **Archivo:** `src/app/features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts`
  — **Qué cambia:** root a `--fill-screen`, `.bento-fill` en la banner.
- **Archivo:** `src/app/features/instructor/notificaciones/instructor-notificaciones.component.ts`
  — **Qué cambia:** evaluar `--fill-screen` opcional (lista corta, prioridad baja).

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- `instructor-alumnos.component.spec.ts` (nuevo, 11 tests) ✓ — cubre `maxVisible`/`visibleStudents`/`remainingStudents`/`loadMoreStudents` en desktop y mobile/tablet, y el reset de densidad en `onSearch`/`setFilter`/`clearFilters`.
- `npm run test:ci`: 158 test files / 1995 tests ✓ (2 skipped pre-existentes, sin relación), sin regresiones.
- `npx tsc --noEmit`: sin errores.
- `npm run lint:arch`: 0 errores (169 advertencias, todas pre-existentes fuera de los 5 archivos tocados).
- `force-compact`: **no aplica a ninguna de las 5 páginas** — confirmado por grep, ninguna inyecta `LayoutDrawerFacadeService` ni abre drawers.
- `/verify` manual en navegador, logueado como `instructor@test.com`, las 5 rutas (`/instructor/dashboard`, `/instructor/alumnos`, `/instructor/liquidacion`, `/instructor/ensayos-teoricos`, `/instructor/notificaciones`):
  - **1440×900:** `documentScrolls:false` en las 5; `.bento-fill` con `contain:size` confirmado vía JS en cada una.
  - **1440×768:** `documentScrolls:false` en las 5 (altura mínima de laptop, sin overflow).
  - **390×844:** scroll nativo correcto, sin `--fill-screen` forzado en mobile; cards/tablas/empty-states legibles.
  - Consola sin errores, red sin 4xx/5xx en ninguna de las 5 rutas.
  - `/instructor/ensayos-teoricos`: empty-state confirmado centrado en wrapper `flex-1 flex items-center justify-center` dentro del `.bento-fill`.
  - `/instructor/alumnos`: con 1 solo alumno de prueba no se pudo ejercitar "Cargar más" visualmente (requiere >9 alumnos) — cubierto en cambio por los 11 tests unitarios de densidad, que sí simulan 22 alumnos.
