# Fix: El ícono del modal de confirmación es `alert-triangle` incluso para `info`/`success`/`secondary`
> id: fix-096-b-icono-modal-confirmacion
> refs: ASG-b-062
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause

**[Heredado de ASG-b-062, confirmado en código]:** `app-shell.component.ts:98` resuelve el
ícono con un ternario binario — `severity === 'danger' ? 'circle-alert' : 'alert-triangle'`.
Cualquier severidad que no sea `danger` cae en `alert-triangle`, incluidas `info`, `success` y
`secondary` (default cuando no se pasa `severity`). Un modal informativo o neutral se ve como
advertencia.

Escopado real a `confirmModal.confirm(...)` (no el conteo project-wide de `fix-094-b`, que
incluía severidades de `p-tag`/badge/toast sin relación): 4 llamadas `info` + 4 `secondary`
implícitas (de 22 totales) muestran hoy el triángulo incorrecto.

## ACs Afectados

Ninguno — fix autónomo de semántica visual, sin AC de spec previa.

## Cambio

- **Archivo:** `src/app/layout/app-shell.component.ts`
- **Qué cambia:** el ternario se reemplaza por un mapeo completo de las 5 severidades a ícono,
  reusando el mismo vocabulario que ya define `alert-card.component.ts` (canon del DS):
  `danger → circle-alert`, `warn → alert-triangle`, `info → info`, `success → circle-check`,
  `secondary → info` (sin equivalente propio en `alert-card`; se reusa `info` porque
  `--state-info` y `--color-primary` son el mismo azul en modo oscuro y casi idénticos en
  claro, así que no choca con el tratamiento `bg-brand-muted`/`text-brand` que `secondary` ya
  tenía). Los 4 íconos ya están registrados en `app.config.ts` — cero registro nuevo.

## Test de Regresión

Resultado (2026-08-02, `/verify`, rol admin):

- `info` (modal real "Re-matricular alumno", `/app/admin/ex-alumnos`): ícono `info`, ya no
  `alert-triangle` ✓
- `secondary` (default sin `severity`, disparado directo contra la instancia real de
  `ConfirmModalService` vía `window.ng.getComponent()` — no había botón vivo que ejercitara
  este caso exacto en menos de un click-hunt largo): ícono `info` sobre `bg-brand-muted`,
  coherente con el tratamiento de color existente ✓
- `success` (0 usos reales en el código hoy, mismo método de disparo directo): `circle-check`
  verde ✓
- `warn`: **sin cambios** — sigue `alert-triangle` amarillo, en claro y oscuro ✓ (control de
  no-regresión)
- `danger`: no re-verificado en este fix — ya lo cubrió `fix-094-b` y el ternario que lo
  resolvía no se tocó, solo se extendió a un `Record` completo.
- Consola limpia, 0 errores ✓
- `npx ng build` sin errores ✓
- `npm run lint:arch` exit 0 ✓
