# Fix: El datepicker del wizard público filtra el modo oscuro (año/mes ilegibles + header negro)

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

### El mecanismo exacto (medido, no supuesto)

Ampliado tras una segunda revisión del owner en pantalla, que señaló que el **header del panel
seguía siendo una barra negra** dentro del panel blanco. Midiendo el mismo elemento:

| Variable, leída EN el header | Valor |
|---|---|
| `--bg-surface` | `#ffffff` ✅ (hereda bien de `[data-public-theme]`) |
| `--p-datepicker-header-background` | **`#18181b`** ❌ |
| `--bg-surface` en `:root` | `#18181b` |

Los tokens de PrimeNG se declaran como `--p-x: var(--ds-token)` **en `:root`**, y CSS resuelve
ese `var()` en `:root` — el valor **ya cocinado** (oscuro) es el que se hereda hacia abajo. Que
`[data-public-theme]` redefina `--bg-surface: #ffffff` más adentro **llega tarde**: el token de
PrimeNG quedó fijado con el valor de dark mode antes.

Corolario práctico (la lección reusable de este fix): **para blindar un componente de PrimeNG
dentro de un scope de tema forzado no alcanza con re-declarar los tokens del DS — hay que pisar
la propiedad final (`color` / `background-color`) sobre el elemento**, que es donde el `var()`
sí se resuelve con el valor del scope.

### Alcance real del daño — y dos errores de verificación propios

Este fix se corrigió **tres veces** porque las dos primeras verificaciones estaban mal hechas.
Queda documentado porque el error de método es más reusable que el fix:

**Error 1 — barrido que medía la métrica equivocada.** El primer "barrido exhaustivo" recorrió el
DOM midiendo únicamente `background-color`. El **contraste del texto** — que era literalmente lo
reportado — nunca estuvo en la métrica, así que el barrido era estructuralmente incapaz de
encontrar el problema, y aun así se reportó como prueba de cobertura total. Al medir de nuevo
con contraste WCAG texto-vs-fondo: **41 de 44 nodos del panel a ≈1.1:1**, no 1.

**Error 2 — agregación con muestra no representativa.** Un segundo script agrupó por `className`
y guardó el color del *primer* elemento de cada grupo como representativo. En el datepicker del
admin, ese primero era el día "hoy" (texto oscuro sobre su caja clara), lo que hizo parecer que
30 días estaban a 1.01:1. **Falso**: al desglosar por color real, 29 días estaban en `#f4f4f5`
a 16:1. Casi se reporta un bug inexistente en el admin.

**Alcance verdadero, ya con la métrica correcta:** el problema está **solo** en el wizard
público. El datepicker del admin fue verificado sano en modo oscuro (días 16:1; el día de hoy
en oscuro sobre caja clara, correcto) en las tres vistas.

### Por qué el fix es categórico y no una lista de selectores

Las dos primeras iteraciones parchearon los selectores señalados (celdas de año/mes, después el
header) — y en ambos casos apareció el siguiente elemento roto al lado. Perseguir selectores no
converge cuando la causa es categórica.

La versión final ancla `color` **en el panel** y fuerza a todo su contenido a `color: inherit`,
excluyendo solo los estados con contraste propio (día seleccionado / resaltado). Eso cubre
también lo que hoy no está en pantalla: footer de botones, números de semana ISO, o cualquier
vista que PrimeNG agregue en una futura versión.

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

- **Archivo:** `src/styles/themes/_public-enrollment.scss` (un solo archivo, una sola causa raíz)
- **Qué cambia:** un bloque `[data-public-theme] .p-datepicker-panel` que:
  1. Ancla `background-color: var(--bg-surface)` y `color: var(--text-primary)` **en el panel**.
  2. Fuerza `color: inherit !important` a **todo** su contenido
     (`*:not(.p-datepicker-day-selected):not(.p-highlight)`) — la parte categórica: en vez de
     enumerar clases, todo el texto pasa a heredar del panel y deja de leer su propio `--p-*`
     ya resuelto en oscuro. Se excluyen los estados con contraste propio (seleccionado /
     resaltado), que traen fondo de marca y color pensado para él.
  3. Pone en `transparent` las superficies que PrimeNG pinta con token propio
     (`.p-datepicker-header` — la barra negra — y los botones ‹ ›), y tokeniza el borde
     inferior del header.
  4. **Estado `:hover`** (tercera aparición de la misma fuga, detectada por el owner en
     pantalla): las reglas de hover de `_primeng-overrides.scss` usan
     `var(--p-content-hover-background, var(--bg-elevated))`. El fallback claro **nunca
     entra** porque el token sí está definido — vale `#27272a` en oscuro — así que al pasar
     el mouse aparecía una caja casi negra sobre el panel blanco.

     **No se copió el valor del modo claro tal cual.** El `:root` en claro usa `#fafafa`,
     pero combinado con el texto en `--ds-brand` (`#0ea5e9`) da **2.66:1**, o sea las letras
     seguirían ilegibles — exactamente la queja original. Se usa el tinte de marca del propio
     tema público (`--color-primary-muted`) con el tono oscuro de marca para el texto
     (`--color-primary-dark`): conserva el acento de color del DS **y** cumple AA.

     | | Fondo hover | Texto | Contraste | |
     |---|---|---|---|---|
     | Antes | `#27272a` | `#0ea5e9` | 5.37:1 | caja casi negra sobre panel blanco ❌ |
     | **Ahora** | `#f0f9ff` | `#0369a1` | **5.57:1** | ✅ |
     | *Descartado* | `#fafafa` | `#0ea5e9` | *2.66:1* | *copiar el claro tal cual* |

     Ambas variantes de sede (azul y roja) definen `--color-primary-muted` y
     `--color-primary-dark`, así que la regla sirve para las dos sin hardcodear hex.

- **Lo que deliberadamente NO se toca:** el estado deshabilitado no recibe color propio.
  PrimeNG ya lo distingue con `opacity: .6` sobre `.p-disabled`, que es **el mismo mecanismo que
  usa el datepicker del admin** (verificado ahí: habilitados y deshabilitados comparten color y
  solo cambian en opacidad). Mantenerlo así deja ambos datepickers consistentes en vez de
  inventar un criterio nuevo solo para el público.

Todo scopeado bajo `[data-public-theme]` y no bajo `[data-mode='dark']` — el wizard público no
debe leer el modo oscuro global en absoluto, ni para corregirlo. Verificado en el CSSOM: las 5
reglas emitidas llevan el scope, ninguna puede alcanzar el resto de la app.

## Test de Regresión

Verificado en vivo (`ng serve`, 2026-09-01) con `data-mode="dark"` activo en `<html>` (el
escenario que rompía). **La métrica correcta es contraste WCAG texto-vs-fondo de cada nodo**,
incorporando la `opacity` efectiva del elemento — no `background-color`, que fue el error de la
primera verificación:

| Vista | Nodos de texto | Bajo 3:1 | Peor habilitado | Peor deshabilitado |
|---|---|---|---|---|
| Días | 44 | **0** | 17.85:1 | 4.69:1 |
| Meses | 13 | **0** | 17.85:1 | 4.69:1 |
| Años | 11 | **0** | 17.85:1 | 4.69:1 |

**Antes del fix, en la misma vista de días: 41 de 44 nodos a ≈1.1:1.**

- Los deshabilitados quedan en 4.69:1: atenuados por su `opacity: .6` pero perfectamente
  legibles — de hecho por encima del mínimo AA, que ni siquiera exige contraste en controles
  deshabilitados.
- Confirmado visualmente además de numéricamente: captura del calendario con header blanco,
  cabeceras L M X J V S D legibles y todos los días visibles.

### Regresión en el admin — medida DESPUÉS del fix, no argumentada

Una primera versión de este documento afirmaba que el admin estaba sano citando una medición
tomada **antes** de aplicar el fix, más un argumento de scope. Insuficiente: se volvió a medir
el admin **con el fix ya aplicado**, y con un método de contraste más estricto que compara el
texto contra su **fondo efectivo propio** (subiendo el árbol hasta el primer fondo opaco), no
contra el fondo del panel:

| Post-fix · modo oscuro · vista días | Nodos | Bajo AA (4.5:1) |
|---|---|---|
| Público `/inscripcion` | 44 | **0** (peor 4.69:1) |
| Admin `/app/admin/matricula` | 44 | **0** |

El método simplificado (contra el fondo del panel) marcaba 1 falso positivo a 1.01:1 en el
admin: era el día "hoy", que tiene texto oscuro sobre **su propia caja clara**. Con el fondo
efectivo correcto desaparece. Mismo tipo de error de medición que ya había ocurrido dos veces
en este fix — de ahí que el método final compare siempre contra el fondo real del elemento.

- Refuerzo estructural: inspección del CSSOM confirma que las reglas emitidas llevan todas
  el prefijo `[data-public-theme]`, así que no pueden alcanzar el admin ni otro portal.

### Barrido final de los 4 estados — el que faltaba desde el principio

Las cuatro primeras rondas de este fix cubrieron solo el estado de **reposo**; cada vez que el
owner miraba otro estado aparecía la misma fuga de nuevo. La verificación final los barre todos
juntos, con `data-mode="dark"` activo y navegación de teclado real:

| Estado | Antes | Después |
|---|---|---|
| Reposo (51 nodos) | 41/44 a ≈1.1:1 | **0 habilitados bajo AA**, peor 5.93:1 |
| Hover | `#27272a` + `#0ea5e9` (caja negra) | `#f0f9ff` + `#0369a1` → **5.57:1** |
| **Seleccionado** | `#38bdf8` + blanco → **2.14:1** ❌ | `#0369a1` + blanco → **5.93:1** |
| **Foco de teclado** | outline `#38bdf8` → **2.14:1** ❌ (mín. 3:1) | outline 2px `#0369a1` → **5.93:1** |

**El caso del seleccionado merece nota**: estaba *explícitamente excluido* de la regla
`color: inherit` con el comentario "trae su propio contraste". Ese supuesto nunca se midió y era
falso — usaba `#38bdf8`, el shade de marca de **modo oscuro**, o sea la misma fuga que el fix
decía estar cerrando. Una exclusión escrita sin medir es una fuga con permiso.

**El foco tiene además una trampa de verificación**: `element.focus()` desde consola **no**
activa `:focus-visible`, así que un primer intento reportó "sin indicador de foco" y luego
"outline none". Sólo con `ArrowRight` real apareció el outline verdadero. Cualquier futura
revisión de foco en este proyecto tiene que usar teclado real, no foco programático.

### Hover — verificado con el mouse físicamente encima

El `:hover` no se puede comprobar por captura (el screenshot automatizado no lo refleja), así
que se midió el estilo computado **con el puntero sobre la celda**:

| Caso | Resultado |
|---|---|
| Día habilitado (11/ago) | fondo `rgb(240,249,255)`, texto `rgb(3,105,161)` → **5.57:1** ✅ |
| Día deshabilitado (15/sep, futuro) | fondo transparente, **sin** estado hover ✅ correcto |

El segundo caso confirma además que la regla respeta `:not(.p-disabled)`: una fecha futura
—inválida como fecha de nacimiento— no simula ser clickeable al pasar el mouse.
- `npm run lint:arch`: **exit 0**, 0 errores (los 174 warnings son backlog pre-existente ajeno a
  este cambio; ningún warning apunta a `_public-enrollment.scss`).
- `public-enrollment.component.spec.ts` / `public-personal-data.component.spec.ts`: el proyecto
  excluye specs de componentes Angular de Vitest (memoria `project_no_angular_component_tests`,
  mismo patrón ya documentado en `fix-064-b-rut-dv-automatico`) — es un cambio puramente SCSS,
  sin lógica de componente. Verificación por navegador real, no unit test.
