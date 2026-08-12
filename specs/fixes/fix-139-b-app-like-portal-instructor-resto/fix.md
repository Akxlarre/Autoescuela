# Fix: App-like: portal instructor resto (`dashboard`, `alumnos`, `liquidacion`, `ensayos-teoricos`, `notificaciones`)
> id: fix-139-b-app-like-portal-instructor-resto
> refs: ASG-b-078
> status: in_progress
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
- `.spec.ts` nuevo SOLO para `/instructor/alumnos` (lógica de densidad `sliceByBudget`/`mobileShown`) — obligatorio por `testing-tdd.md`. Las otras 4 páginas no agregan lógica de densidad nueva.
- `force-compact` verificado con drawer abierto en cada una de las 5 páginas.
- `/verify` en 390×844, 1440×900 y 768 de alto, cada página.
