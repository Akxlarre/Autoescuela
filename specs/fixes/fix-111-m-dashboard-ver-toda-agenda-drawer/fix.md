# Fix: Dashboard — "Ver toda la agenda" abre Agenda Semanal en vez de la agenda del día
> id: fix-111-m-dashboard-ver-toda-agenda-drawer
> refs: —
> status: done
> closed: 2026-08-05
> created: 2026-08-05

## Root Cause
`LiveClassesPanelComponent` (sección "Clases Actuales", exclusiva del día de hoy) emite
`viewAllClick`, y `DashboardComponent.openAgenda()` lo conecta a
`this.layoutDrawer.open(AdminAgendaComponent, 'Agenda Semanal', 'calendar-days')` —
el mismo drawer semanal con selector de instructor que ya abre el botón "Agenda" del hero
(`handleQuickAction('qa2')`, línea 476). Resultado: dos botones distintos abren el mismo
drawer, y un botón dentro de una sección de "hoy" salta a una vista de semana completa con
selector de instructor, quitando el contexto de "hoy" que el usuario esperaba. La utilidad
real del botón (ver TODAS las clases de hoy cuando no caben en el panel compacto) queda sin
resolver.

## ACs Afectados
Ninguno — fix autónomo (corrección de UX/navegación, no altera contrato de datos ni ACs de
una spec).

## Cambio
- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts`
  **Qué cambia:** nuevo input `showViewAllFooter` (default `true`) para poder reutilizar el
  componente sin el footer "Ver toda la agenda" cuando ya se está en la vista completa.
- **Archivo:** `src/app/features/dashboard/daily-agenda-drawer/daily-agenda-drawer.component.ts` (nuevo)
  **Qué cambia:** drawer que reutiliza `app-live-classes-panel` con `[maxItems]="null"` (sin
  budget) y `[showViewAllFooter]="false"`, leyendo `DashboardFacade.data().liveClasses` /
  `loading()` directamente — mismas filas, mismo formato visual que "Clases Actuales", pero
  sin recorte. El click en una clase reutiliza el mismo flujo de acción
  (`resolveLiveClassActionPlan` + iniciar/finalizar/detalle) que `DashboardComponent`, vía
  `push()` en vez de `open()` para conservar el botón "Atrás" hacia la lista completa.
- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
  **Qué cambia:** `openAgenda()` (invocado por `viewAllClick`) pasa a abrir
  `DailyAgendaDrawerComponent` ('Agenda de Hoy', 'calendar-clock') en vez de
  `AdminAgendaComponent`. El botón "Agenda" del hero (`qa2`) NO cambia — sigue abriendo
  `AdminAgendaComponent` (Agenda Semanal), que es su propósito correcto.

## Test de Regresión
- `daily-agenda-drawer.component.spec.ts > muestra todas las clases de hoy sin límite de budget` ✓
- `daily-agenda-drawer.component.spec.ts > delega el click de una clase al mismo flujo de acción que el dashboard` ✓
