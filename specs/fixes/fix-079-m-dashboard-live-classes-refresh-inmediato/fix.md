---
# Fix: "Clases Actuales" del Dashboard no se actualiza de inmediato tras iniciar/finalizar
> id: fix-079-m-dashboard-live-classes-refresh-inmediato
> refs: fix-076-m-dashboard-finalizar-clase-en-curso, fix-078-m-iniciar-clase-no-auto-abre-finalizar
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

El panel "Clases Actuales" del Dashboard (`DashboardFacade.data().liveClasses`) solo se refresca por
dos vías indirectas: el canal Realtime de `dashboard.facade.ts` (`setupRealtime()`, suscrito a
`class_b_sessions`) y un `setInterval` local de 60s (`refreshLiveClassesOnly()`). Ninguna de las dos
se dispara de forma inmediata tras la propia acción del usuario — el usuario (Matías) verificó en
`ng serve` que tras iniciar una clase desde el Dashboard (fix-078: el drawer se cierra), la tarjeta
sigue mostrando "Por Iniciar"/tiempo atrasado, y al volver a hacer clic se reabre el drawer de
"Iniciar Clase" (datos locales stale) — el estado real solo se refleja ~20-30s después (latencia de
Realtime) o con F5. Viola la sección "Post-action refresh" de `swr-pattern.md`: tras una mutación
(INSERT/UPDATE/DELETE) se debe refrescar explícitamente, no depender solo de Realtime/polling.

`AsistenciaClaseBFacade.startClass()`/`finishClass()` mutan `class_b_sessions`, pero no tienen forma
de avisarle a `DashboardFacade` (facade independiente, mismo patrón singleton `providedIn: 'root'`)
que refresque su copia local de `liveClasses` de inmediato.

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
  - `refreshLiveClassesOnly()`: cambiar de `private` a público — ya hace exactamente lo necesario
    (re-fetch liviano de solo `liveClasses`, sin tocar KPIs/actividad), sin necesidad de duplicar
    lógica.
- **Archivo:** `src/app/features/admin/asistencia/admin-iniciar-clase-drawer.component.ts`
  - Inyectar `DashboardFacade`. Tras `startClass()` exitoso, además de `layoutDrawer.close()`, llamar
    `this.dashboardFacade.refreshLiveClassesOnly()` (fire-and-forget, no bloquea el cierre).
- **Archivo:** `src/app/features/admin/asistencia/admin-finalizar-clase-drawer.component.ts`
  - Mismo cambio: inyectar `DashboardFacade` y llamar `refreshLiveClassesOnly()` tras `finishClass()`
    exitoso, antes/junto a `layoutDrawer.close()`.

Ambos drawers son compartidos por Dashboard Admin/Secretaria y Asistencia B Admin/Secretaria — llamar
`refreshLiveClassesOnly()` desde Asistencia B es inofensivo (solo refresca el signal interno de
`DashboardFacade`, que es `providedIn: 'root'` y ya existe en memoria aunque el Dashboard no esté
montado en ese momento).

## Test de Regresión

- `dashboard.facade.spec.ts`: test de que `refreshLiveClassesOnly()` es invocable públicamente y
  actualiza `data().liveClasses` sin tocar el resto de `data()`.
- `admin-iniciar-clase-drawer.component.spec.ts > onSubmit (fix-079)`: agregar caso
  `startClass exitoso → llama dashboardFacade.refreshLiveClassesOnly()`.
- `admin-finalizar-clase-drawer.component.spec.ts` (nuevo si no existe): `onFinalize exitoso → llama
  dashboardFacade.refreshLiveClassesOnly()`.
- Suite completa (`npm run test:ci`): 1471/1471 en verde (6/6 en `dashboard.facade.spec.ts`,
  2/2 en `admin-iniciar-clase-drawer.component.spec.ts`, 1/1 en el nuevo
  `admin-finalizar-clase-drawer.component.spec.ts`).
- `npm run lint:arch`: 0 errores, 165 advertencias (mismas pre-existentes, ninguna nueva).
- `npx tsc --noEmit`: 0 errores.
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.
