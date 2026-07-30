# Fix: Realtime sin limpiar en 7 facades + polling prohibido en Dashboard
> id: fix-004-i-realtime-sin-dispose-dashboard-polling
> refs: ASG-b-003
> status: done
> closed: 2026-07-30
> created: 2026-07-30

## Root Cause
[Heredado de ASG-b-003, a confirmar]: 7 facades (`dashboard`, `admin-alumnos`, `admin-alumno-detalle`, `flota`, `pagos`, `liquidaciones`, `cuadratura`) abren un canal de Supabase Realtime que ningún Smart Component cierra nunca — quedan vivos toda la sesión aunque el usuario navegue a otra parte de la app. Además, `dashboard.facade.ts` tiene un `setInterval` de 60s que hace fetch real de red para recalcular "clases actuales" — exactamente el anti-patrón que `swr-pattern.md` prohíbe ("NUNCA usar setInterval/polling — Supabase Realtime existe para esto").

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **7 Smart Components** — se inyectó `DestroyRef` y se registró `this.destroyRef.onDestroy(() => this.facade.destroyRealtime())` (mismo patrón que `admin-agenda.component.ts`/`admin-tareas.component.ts`):
  - `src/app/features/dashboard/dashboard.component.ts` (en el `constructor()` existente, ya que la clase no implementa `OnInit`).
  - `src/app/features/admin/alumnos/admin-alumnos.component.ts` (dentro de `ngOnInit()`, que ya existía).
  - `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — este componente **ya** implementaba `ngOnDestroy()` (limpiaba listeners de `scroll`/`resize`); solo se agregó `this.facade.destroyRealtime()` al final del método existente, sin necesidad de `DestroyRef`.
  - `src/app/features/admin/flota/admin-flota.component.ts` (en el `constructor()`, la clase no tenía ningún lifecycle hook).
  - `src/app/features/admin/pagos/admin-pagos.component.ts` — ya inyectaba `DestroyRef` (sin uso) desde antes; se usó esa instancia existente en el `constructor()`.
  - `src/app/features/admin/contabilidad-liquidaciones/admin-contabilidad-liquidaciones.component.ts` (en el `constructor()`).
  - `src/app/features/admin/contabilidad-cuadratura/admin-contabilidad-cuadratura.component.ts` (en el `constructor()`).
- **`src/app/core/facades/dashboard.facade.ts`**: se eliminó el `setInterval` de 60s (`_liveClassesInterval`) dentro de `setupRealtime()` y su `clearInterval` correspondiente en `destroyRealtime()`. No se reemplazó por un `computed()` porque, al revisar `fetchLiveClasses()`, no hay ningún dato derivable localmente contra `Date.now()` — el campo `timeLabel` ya es un string estático (`'00:00 - 00:45'`, no calculado), y el estado de cada clase (`status`) ya llega directo de BD y ya se refresca vía el canal Realtime existente sobre `class_b_sessions` (evento `postgres_changes` → `refreshSilently()`). El polling de 60s era, en la práctica, un fetch de red redundante sin ninguna lógica de recálculo temporal detrás — se eliminó sin reemplazo, dejando que Realtime + los refrescos post-acción (`refreshLiveClassesOnly()`, ya invocado por los drawers de iniciar/finalizar clase) cubran todos los casos de actualización.
- `refreshLiveClassesOnly()` se mantuvo intacto — sigue siendo llamado por `admin-iniciar-clase-drawer.component.ts` y `admin-finalizar-clase-drawer.component.ts` tras mutar una clase (patrón SWR post-acción, no polling).
- Fuera de scope (respetado): no se unificaron los nombres de método (`dispose` vs `destroyRealtime`).

## Test de Regresión
- `src/app/core/facades/dashboard.facade.spec.ts` — 2 tests nuevos en `describe('Realtime lifecycle (fix-004-i)', ...)`:
  1. `setupRealtime()` ya no agenda polling con `setInterval`: con `vi.useFakeTimers()`, se avanza el reloj 120s tras `setupRealtime()` y se verifica que `refreshLiveClassesOnly` (spy) nunca fue invocado.
  2. `destroyRealtime()` remueve el canal Realtime suscrito: se verifica que `client.removeChannel` es llamado con el canal devuelto por `client.channel(...)`.
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores (162 warnings pre-existentes, ninguno nuevo en los archivos tocados), `npx vitest run src/app/core/facades/dashboard.facade.spec.ts src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.spec.ts` → 18/18 verde (2 archivos, sin regresión). Los otros 6 Smart Components no tienen `.spec.ts` propio; el cambio en ellos es lifecycle puro (sin `computed()` ni ramas de decisión), por lo que no aplica test nuevo per `.claude/rules/testing-tdd.md`.
- Verificación visual pendiente: confirmar en el navegador que no hay error de consola al navegar entre Dashboard/Alumnos/Detalle de Alumno/Flota/Pagos/Liquidaciones/Cuadratura repetidamente (los canales Realtime no deben acumularse — se puede verificar en el panel Network > WS de Supabase o revisando que no crezcan las suscripciones activas).
