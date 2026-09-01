# Fix: Selector de año/mes del datepicker ilegible en el wizard público cuando el navegador está en modo oscuro

> id: fix-152-b-datepicker-anio-mes-ilegible-modo-oscuro-wizard-publico
> refs: — (encontrado en barrido UAT, Paquete 1 — docs/UAT-PLAN.md, reportado por el usuario en vivo)
> status: done
> closed: 2026-09-01
> created: 2026-09-01

## Root Cause

El wizard de matrícula pública (`app-public-enrollment`) fuerza tema **claro** vía el atributo
`[data-public-theme]` (`src/styles/themes/_public-enrollment.scss`), redeclarando
`--text-primary`, `--text-secondary`, `--text-muted`, `--bg-surface`, etc. con valores claros —
correcto e intencional, para que la página pública nunca dependa del modo oscuro/claro que el
visitante (o un admin logueado en la misma pestaña) tenga configurado en el resto de la app.

Esa redeclaración funciona para casi todo el `p-datepicker` porque
`src/styles/vendors/_primeng-overrides.scss:1369-1376` fuerza explícitamente
`.p-datepicker-panel { background-color: var(--bg-surface) !important; color: var(--text-primary)
!important; }` dentro del bloque `[data-mode='dark']` — como el panel SÍ es descendiente real de
`[data-public-theme]` en el DOM (confirmado recorriendo `parentElement` hasta `<html>`), esas
variables resuelven correctamente al valor claro y el panel y los días del mes (1-31) se ven bien.

**Pero las celdas de año y mes del selector (`.p-yearpicker-year`, `.p-monthpicker-month`,
`[data-pc-section='year']`, `[data-pc-section='month']`) nunca declaran un `color` en estado de
reposo** — `_primeng-overrides.scss:851-865` solo define `transition`, `border-radius` y
`:hover`, dejando el color base 100% a cargo del preset Aura de PrimeNG sin pasar por los tokens
`--text-*` de la app. El preset de PrimeNG sí reacciona al modo oscuro/claro del navegador de
forma independiente al sistema de theming manual de esta app (el `darkModeSelector:
'.fake-dark-mode'` configurado en `app.config.ts` para neutralizar el auto-dark de PrimeNG no
cubre este caso — confirmado empíricamente).

**Reproducido y diagnosticado en vivo (2026-09-01):** con `document.documentElement`
`data-mode="dark"` (heredado de una sesión previa donde se probó el toggle de modo oscuro del
admin, en la misma pestaña del navegador — o, para un visitante real, con el navegador/SO en
modo oscuro por `prefers-color-scheme`), el selector de año del datepicker en
`/inscripcion` (paso "Datos personales", campo Fecha de Nacimiento) muestra el texto de los años
no seleccionados en `rgb(244, 244, 245)` (casi blanco) sobre fondo `rgb(255, 255, 255)` (blanco) —
contraste ≈1:1, muy por debajo del mínimo WCAG AA (4.5:1). Forzando
`document.documentElement.setAttribute('data-mode', 'light')` el color pasa a `rgb(106, 106,
108)` (contraste ≈5.7:1, legible), confirmando que la causa es el modo oscuro global colándose
en un componente que el wizard público nunca debería dejar oscurecer.

**Severidad:** Alta. El campo Fecha de Nacimiento es **obligatorio** en el paso 1 del wizard de
auto-matrícula pública (Clase B y Profesional) — cualquier visitante real con su navegador/SO en
modo oscuro (`prefers-color-scheme: dark`, muy común) queda con el selector de año
prácticamente ilegible al intentar elegir su fecha de nacimiento.

## ACs Afectados

Ninguno — fix autónomo, bug de accesibilidad/contraste encontrado en QA manual (paquete 1 de
`docs/UAT-PLAN.md`, owner B), señalado en vivo por el usuario durante una sesión de revisión.

## Cambio

- **Archivo:** `src/styles/themes/_public-enrollment.scss`
- **Qué cambia:** dentro del bloque `[data-public-theme]`, se agrega una regla que fuerza el
  color de las celdas de año/mes del datepicker (estado de reposo, no seleccionado) a
  `var(--text-secondary)` con `!important`, para que el wizard público nunca dependa del preset
  de PrimeNG ni del modo oscuro global — igual que ya se hace para el resto del panel en
  `_primeng-overrides.scss`, pero scopeado correctamente bajo `[data-public-theme]` en vez de
  bajo `[data-mode='dark']` (que es precisamente la fuente del bug: ese bloque es la excepción,
  no la regla — el wizard público no debe leer el modo oscuro global en absoluto).

## Test de Regresión

- Verificado en vivo (`ng serve`, 2026-09-01): con `data-mode="dark"` forzado en `<html>`,
  antes del fix el color computado de `.p-yearpicker-year` no seleccionado era `rgb(244, 244,
  245)` sobre panel `rgb(255, 255, 255)` (contraste ≈1:1). Tras el fix, pasa a
  `var(--text-secondary)` (`#64748b` bajo `[data-public-theme]`, contraste ≈4.8:1 sobre blanco,
  cumple WCAG AA) — **sin depender de `data-mode`**, confirmado forzando tanto `dark` como
  `light` y verificando que el color no cambia (queda anclado al tema público).
  Screenshot de verificación adjunta a la sesión (ver `docs/UAT-PLAN.md`, hallazgo relacionado).
- `public-enrollment.component.spec.ts` / `public-personal-data.component.spec.ts`: el proyecto
  excluye specs de componentes Angular de Vitest (memoria `project_no_angular_component_tests`,
  mismo patrón ya documentado en `fix-064-b-rut-dv-automatico`) — es un cambio puramente SCSS,
  sin lógica de componente. Verificación por navegador real, no unit test.
