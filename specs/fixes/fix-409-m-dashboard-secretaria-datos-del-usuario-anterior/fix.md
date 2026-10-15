# Fix: el dashboard de secretaria muestra un momento los datos de quien usó la pestaña antes
> id: fix-409-m-dashboard-secretaria-datos-del-usuario-anterior
> refs: fix-395-m-testing-dashboards (caso R06, sospecha S19) · fix-224-m (cada secretaria ve solo sus propias acciones) · swr-pattern.md
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

Secretaria 1 abre su dashboard y cierra sesión; en la misma pestaña entra la secretaria 2 de la
misma sede. Mientras carga, el dashboard dice "¡Bienvenido, <secretaria 1>!" y lista la "Actividad
reciente" y las alertas de la secretaria 1, sin skeleton. Dura lo que tarda la carga (3–6 s).

## Root Cause

`DashboardFacade` y `DashboardAlertsFacade` son singletons que guardan lo último que cargaron y
solo distinguen por sede: si la sede activa es la misma (`branchId === _lastBranchId`), tratan la
visita como una re-entrada SWR y muestran lo guardado mientras refrescan. Cerrar sesión no recarga
la página, así que lo guardado es del usuario anterior. La actividad reciente es personal
(`fix-224-m`) y el saludo lleva el nombre: no son datos de la sede.

## Fix

Los dos Facades recuerdan para qué usuario cargaron. Si `initialize()` llega con otro usuario,
descartan lo guardado y cargan desde cero, con skeleton.

## Acceptance Criteria

- [x] AC1 — Con datos cargados por un usuario, `initialize()` con otro usuario de la misma sede no
      deja ver los datos anteriores: los descarta y muestra el skeleton.
- [x] AC2 — Lo mismo con las alertas.
- [x] AC3 — El mismo usuario que vuelve al dashboard sigue viendo sus datos al instante (SWR).

## Regression Test

- `dashboard.facade.spec.ts` → `cambio de usuario (fix-409-m)`
- `dashboard-alerts.facade.spec.ts` → `cambio de usuario (fix-409-m)`

## Verificación (2026-10-13)

- Unit: `dashboard.facade.spec.ts` y `dashboard-alerts.facade.spec.ts`, 4 tests nuevos (otro
  usuario: lo guardado se descarta de inmediato y aparece el skeleton; mismo usuario: sigue viendo
  sus datos al instante). 111/111 junto con `hora-chile.facades.spec.ts`. `tsc` sin errores.
- No se probó en el navegador con dos cuentas reales: en dev no hay dos secretarias de la misma
  sede con la misma sede activa (la multi-sede entra en "Todas", que ya recargaba por ser otra
  sede). El caso queda cubierto por los tests unitarios.

Observación (fuera de este fix): el resto de los Facades con caché (listas de alumnos, pagos,
etc.) tienen el mismo patrón de singleton; se protegen por sede y por RLS al refrescar, pero
también pueden mostrar un instante lo del usuario anterior. Una recarga completa de la página al
cerrar sesión lo resolvería para todos; es una decisión del módulo de Sesión.
