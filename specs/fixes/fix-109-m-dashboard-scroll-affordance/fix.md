# Fix: Dashboard — sin affordance de scroll en Actividad Reciente y Alertas Importantes
> id: fix-109-m-dashboard-scroll-affordance
> refs: —
> status: done
> closed: 2026-08-02
> created: 2026-08-02

## Root Cause
En `dashboard.component.ts`, las listas `#activityList` y de alertas son `overflow-y-auto`
sin ninguna señal visual de que son scrolleables (ni fade, ni scrollbar visible por defecto).
Además, el botón "Ver toda la actividad" / "Ver todas las alertas" está implementado como
`<li>` **dentro** del mismo `<ul>` scrolleable, por lo que solo se revela si el usuario ya
adivinó que puede hacer scroll y llegó al final. Resultado: nada indica a primera vista que
hay más contenido, y la salida a la vista completa queda escondida.

## ACs Afectados
Ninguno — fix autónomo (UX de affordance, no altera contrato de datos ni ACs de una spec).

## Cambio
- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
- **Qué cambia:**
  1. Los botones "Ver toda la actividad" / "Ver todas las alertas" salen del `<ul>` scrolleable
     y pasan a ser un footer fijo (`shrink-0`) fuera del área de scroll, siempre visible.
  2. La lista scrolleable se envuelve en un contenedor con fade inferior (`::after` con
     `linear-gradient` hacia `var(--card-bg)`, `pointer-events: none`) que insinúa contenido
     adicional cuando el bloque scrollea.
  3. `.custom-scrollbar` deja de mostrar el thumb solo al hover: ahora es visible por
     defecto (`var(--text-muted)`, 6px, más `scrollbar-width`/`scrollbar-color` para
     Firefox) — pedido explícito del owner tras ver la captura ("agregaría una barra de
     scroll").

## Test de Regresión
Cambio puramente visual/CSS sin lógica nueva (no hay `computed()` ni decisión de negocio
involucrada) — validado con `/verify` (Playwright) en vez de un test unitario, según
`testing-tdd.md` ("shared/dumb sin lógica → opcional"; aquí aplica el mismo criterio al
template de un Smart Component sin cambio de lógica).
