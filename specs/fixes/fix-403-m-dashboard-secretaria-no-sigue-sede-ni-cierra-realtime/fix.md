# Fix: el dashboard de secretaria no recarga al cambiar de sede ni cierra su canal al salir
> id: fix-403-m-dashboard-secretaria-no-sigue-sede-ni-cierra-realtime
> refs: fix-395-m-testing-dashboards (casos R02, O05; sospechas S7, S12) · facades.md §7 · swr-pattern.md
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Con la secretaria multi-sede (`can_access_both_branches`), 2026-10-13:

1. En el dashboard, cambiar de "Todas las sedes" a "Conductores Chillán": KPIs (197 alumnos, 17
   vehículos), clases y alertas siguen siendo los de "Todas" hasta salir y volver a entrar.
2. Al pasar del dashboard a Base de Alumnos, el canal Realtime `dashboard-realtime` no se cierra
   (no hay `phx_leave`): cada cambio en `students`, `class_b_sessions` o `payments` de cualquier
   sede sigue disparando las ~12 consultas del dashboard aunque la secretaria esté en otra pantalla.

## Root Cause

`SecretariaDashboardComponent` solo tiene `ngOnInit()`: carga una vez y nada más. No sigue a
`BranchFacade.selectedBranchId()` (facades.md §7 pide ese `effect()` en el Smart Component) ni
libera el canal que abre `DashboardFacade.initialize()` (swr-pattern.md: nunca suscribir Realtime
sin su `dispose()` en el ciclo de vida). El dashboard de admin original tenía las dos cosas; al
separarse en un componente propio para secretaria se perdieron.

## Fix

En `SecretariaDashboardComponent`: un `effect()` sobre la sede seleccionada que llama a
`initialize()` de los dos Facades (reemplaza a `ngOnInit`), y `DestroyRef.onDestroy` que llama a
`DashboardFacade.destroyRealtime()`.

## Acceptance Criteria

- [x] AC1 — Al cambiar la sede en el selector, el dashboard de secretaria recarga KPIs, clases y
      alertas sin salir de la pantalla.
- [x] AC2 — Al entrar carga una sola vez (no hay doble carga inicial).
- [x] AC3 — Al salir del dashboard se cierra el canal `dashboard-realtime`; al volver se abre de nuevo.

## Regression Test

- `secretaria-dashboard.component.spec.ts` → `ciclo de vida (fix-403-m)`

## Verificación (2026-10-13)

- Unit: `secretaria-dashboard.component.spec.ts` 15/15; los 4 tests nuevos cubren carga única al
  entrar, recarga al cambiar de sede, que un cambio de `loading` no recarga, y el cierre del canal
  al destruir el componente. El spec ahora usa una plantilla vacía (`overrideComponent`) para poder
  correr la detección de cambios: Vitest no compila los inputs de señal de los componentes hijos.
  `tsc` sin errores.
- Navegador, secretaria multi-sede: "Todas" 197 alumnos y 17 vehículos → "Conductores Chillán" 130
  y 8, con sus alertas (40 pagos pendientes) → "Autoescuela Chillán" 67 y 9. La recarga tarda entre
  3 y 6 s (unas 30 consultas).
- Navegador, secretaria de la sede 1, tramas del WebSocket para `dashboard-realtime`: `join` al
  entrar, `leave` al pasar a Base de Alumnos, `join` al volver.

Queda para `fix-404-m`: al cambiar de sede varias veces seguidas, una carga vieja que termina
después apaga el skeleton de la nueva (`DashboardFacade.initialize()`), y las alertas no tienen
guard de orden. Antes de este fix no era alcanzable porque el dashboard no recargaba.
