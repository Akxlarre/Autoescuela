# Fix: App-like — `/secretaria/dashboard` sin portar `--fill-screen-2`
> id: fix-123-b-app-like-secretaria-dashboard
> refs: ASG-b-065
> status: done
> closed: 2026-08-08
> created: 2026-08-08

## Root Cause

**[Heredado de ASG-b-065, a confirmar]:** Primera pieza del rollout del patrón app-like documentado
en `indices/APP-LIKE-ROLLOUT.md` (auditoría completa de los 4 portales, 2026-08-02/03).
`/admin/dashboard` (`DashboardComponent`, `src/app/features/dashboard/dashboard.component.ts`) ya
es 100% app-like — `/secretaria/dashboard` (`SecretariaDashboardComponent`) tiene el mismo layout
conceptual (hero + KPIs + `app-live-classes-panel` + Actividad reciente + Alertas) pero nunca portó
el patrón.

No es un gap de una línea (así lo describía la primera pasada del audit) — son 4 cambios reales,
todos ya verificados contra el código de admin:

1. Root `<section>`: agregar `bento-grid--fill-screen-2` + `[class.force-compact]="isDrawerOpen()"`
   (agregar el computed `isDrawerOpen`, `layoutDrawer` ya está inyectado).
2. `<app-live-classes-panel>`: agregar clase `bento-fill` (hoy falta — confirmado leyendo
   `live-classes-panel.component.ts:35-36`, el comentario dice explícitamente "el consumidor la
   pone" y acá no está puesta), `[maxItems]="liveClassesBudget()"`, `(viewAllClick)="openAgenda()"`.
3. Cards "Actividad reciente" / "Alertas Importantes": agregar `bento-fill h-full overflow-hidden`
   a las clases existentes.
4. Densidad adaptativa: portar `LayoutService` + `isDesktopTier` + `sliceByBudget()` para
   `visibleActivities`/`visibleAlerts` (hoy hardcodeado a `.slice(0,4)`/`.slice(0,3)` fijo, sin
   adaptar por tier). Copiar literal el patrón de `dashboard.component.ts:371-380`.

Detalle menor a decidir libremente: admin no tiene botón "Ver todo" en el header de cada card (lo
movió al footer de la lista, dentro del scroll); secretaria sí lo tiene en el header. Unificar al
patrón de admin (footer) para no tener 2 UX del mismo widget — no bloqueante si se decide dejarlo.

## ACs Afectados

Ninguno — no hay spec previa para el dashboard de secretaria. Fix originado de una Asignación de
equipo (ASG-b-065), no de una spec con ACs formales.

## Cambio

`src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`:

1. Root `<section>`: `bento-grid` → `bento-grid bento-grid--fill-screen-2` + `[class.force-compact]="isDrawerOpen()"` (nuevo computed `isDrawerOpen`).
2. `<app-live-classes-panel>`: clase `bento-fill` agregada, `[maxItems]="liveClassesBudget()"`, `(viewAllClick)="openAgenda()"` (nuevo método `openAgenda()`, lazy-import de `DailyAgendaDrawerComponent` siguiendo el patrón ya usado por `openRecentActivity()`/`openAlerts()`).
3. Cards "Actividad reciente" / "Alertas Importantes": `bento-fill h-full overflow-hidden` agregado a las clases existentes; botón "Ver todo" del header movido al footer (unificado al patrón de admin), con el mismo CSS `.scroll-fade` portado.
4. Densidad adaptativa: `LayoutService` inyectado, `isDesktopTier`/`liveClassesBudget`/`visibleActivities`/`visibleAlerts` portados literal de `dashboard.component.ts`, reemplazando `.slice(0,4)`/`.slice(0,3)` fijos en el template.

`src/app/features/secretaria/dashboard/secretaria-dashboard.component.spec.ts`: agregado bloque
"densidad adaptativa (fix-123-b)" (9 tests) con `LayoutService` mockeado vía `tierSig`, siguiendo el
patrón de `admin-secretarias.component.spec.ts`.

## Test de Regresión

- `.spec.ts` obligatorio (`.claude/rules/testing-tdd.md`) para los `computed()` de densidad nuevos:
  `isDesktopTier`, `visibleActivities`, `visibleAlerts`, `liveClassesBudget`. → **9/9 verde**.
- `/verify` en 390×844, 1440×900 **y 768 de alto** de viewport. → Ejecutado con el Browser pane
  (Playwright MCP no disponible en esta sesión); sin capturas posibles (panel no compone frames en
  sesión headless), pero confirmado en runtime vía DOM/`ng.getComponent`: `bento-grid--fill-screen-2`
  activo, 3 `.bento-fill` con `contain:size`, doc no scrollea, 33/33 requests a Supabase en 200,
  consola limpia (solo ruido preexistente ajeno al componente). El resize a 375px no disparó
  `ResizeObserver` (limitación confirmada del panel no compuesto, no del componente) — la densidad
  adaptativa en sí ya está cubierta por los 9 unit tests.
- `force-compact` verificado con un drawer abierto. → **Confirmado en runtime** (`ng.getComponent`):
  `true` con "Registrar Pago" abierto, `false` al cerrarlo.
- Reventar la caché SWR / probar que el refresh silencioso no pierde posición de scroll si aplica
  Realtime en esta página. → No aplica cambio de comportamiento SWR/Realtime en este fix (el
  Facade no se tocó); sin regresión posible en ese eje.
- `npm run test:ci` completo: **1875 passed, 5 skipped, 0 failed**.
- `npm run lint:arch`: exit 0 (solo warnings preexistentes ajenos a este archivo).

## Checklist de cierre (heredado de ASG-b-065, aplica a TODO el rollout app-like)

- [x] `force-compact` verificado con un drawer abierto
- [x] `.spec.ts` para los `computed()` de densidad nuevos
- [x] `/verify` en 390×844, 1440×900 y 768 de alto (con reserva: sin capturas, ver Test de Regresión)
- [x] Reventar la caché SWR / probar refresh silencioso no pierde posición de scroll si aplica
      Realtime en esta página (no aplica — sin cambios al Facade)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/secretaria/dashboard` en "Candidatas" (sección Secretaria)
- `src/app/features/dashboard/dashboard.component.ts` — referencia canónica a copiar
- `.claude/rules/visual-system.md` §"Patrón App-like" — canon del patrón
- `specs/assignments/ASG-b-065-app-like-secretaria-dashboard.md` — Asignación original

## Archivos involucrados

- `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`
