# Fix: con cambios seguidos en la escuela, el dashboard de secretaria no termina de cargar
> id: fix-407-m-dashboard-secretaria-sin-datos-con-eventos-seguidos
> refs: fix-395-m-testing-dashboards (casos A02, O01, O02) · spec 0005-m (guard de orden) · fix-404-m · swr-pattern.md
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Corriendo la suite E2E con 4 sesiones escribiendo clases y pagos a la vez (2026-10-13), el
dashboard de una secretaria quedó más de 30 s mostrando solo el saludo: sin KPIs, sin skeleton y
sin mensaje de error. En uso real es el mismo escenario que varias secretarias e instructores
iniciando y cerrando clases en la misma franja.

## Root Cause

`DashboardFacade` escucha por Realtime cada cambio en `students`, `class_b_sessions` y `payments`,
y cada evento llama a `refreshSilently()`, que arranca **otra** carga completa. El guard de orden
(spec 0005-m) descarta toda carga que no sea la última pedida. Una carga tarda 3–6 s: si llega un
evento antes de que termine, esa carga se descarta; si los eventos siguen llegando, ninguna carga
llega a aplicarse nunca. La primera carga (`initialize()`) corre la misma suerte: termina
"correctamente" (apaga el skeleton) con su resultado descartado, y la pantalla queda vacía.

## Fix

`refreshSilently()` no arranca una carga si ya hay una en curso (la inicial o un refresco): anota
que hay un refresco pendiente y lo corre una vez cuando termina la que está en curso. Así cada
carga llega a aplicarse y los eventos seguidos se funden en un solo refresco posterior.

## Acceptance Criteria

- [x] AC1 — Un evento que llega durante la primera carga no la descarta: sus datos se muestran y
      después corre un refresco.
- [x] AC2 — Varios eventos durante un refresco en curso producen un solo refresco adicional.
- [x] AC3 — Un cambio de sede durante un refresco sigue ganando: quedan los datos de la sede nueva.
- [x] AC4 — Con eventos llegando de forma continua, el dashboard muestra datos.

## Regression Test

- `dashboard.facade.spec.ts` → `eventos Realtime seguidos (fix-407-m)`

## Verificación (2026-10-13)

- Unit: `dashboard.facade.spec.ts` 36/36; los 3 tests nuevos cubren un evento durante la primera
  carga (se muestra la carga y después corre un refresco), varios eventos durante un refresco (un
  solo refresco más: 3 cargas pedidas en total, no 5) y un cambio de sede durante un refresco (gana
  la sede nueva). `tsc` sin errores.
- AC4 se cubre con esos dos primeros casos: con la regla nueva toda carga en curso llega a
  aplicarse, llegue lo que llegue mientras tanto.
- E2E `e2e/dashboards.spec.ts` con 4 workers escribiendo clases y pagos: 19 de 20 en verde en
  tres corridas seguidas. El caso que sigue fallando a veces (secretaria multi-sede en "Todas") ya
  no queda en blanco: muestra "No se pudo cargar el panel", por el timeout de `audit_log` que
  corrige `fix-408-m` (migración aplicada el 2026-10-14).
