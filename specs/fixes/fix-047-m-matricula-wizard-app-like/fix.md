# fix-047-m — Wizard de Nueva Matrícula: app-like (paso 1 sin scroll)

## Intento 4 — Cierre: scrollbar residual sin efecto

El dueño confirmó que la vista ya calzaba completa (sin scroll de
página, sin scrollbar flotante), pero quedaba un scrollbar mínimo "sin
efecto" — técnicamente scrolleable por unos pocos px pero sin movimiento
visible. Medido con Playwright: `wizardMain.scrollHeight` excedía
`clientHeight` por 5-15px según el viewport (@ 1920×910: exacto 815 vs
810; @ 1600×900: 807 vs 800).

Fix: el padding vertical del wrapper `max-w-7xl` que envuelve el
`<p-stepper>` (`p-4 sm:p-6`, luego `sm:p-5` en el Intento 3) bajó a un
único `p-4` (16px) en todos los breakpoints — verificado con Playwright
inyectando CSS de prueba hasta confirmar `scrollHeight === clientHeight`
exacto en ambos viewports de referencia (1920×910 y 1600×900).

## Intento 3 — Refinamiento post-feedback del dueño (con Playwright)

El dueño reportó, con captura, que el Intento 2 mejoró la vista pero
seguía habiendo: (a) un leve scroll residual y (b) la scrollbar interna
"flotando" entre el borde de la card y el borde derecho del viewport (no
pegada a la derecha). Diagnosticado y verificado con Playwright:

- **Scrollbar flotante**: `.shell-content` reserva `padding-right` (16px)
  + `scrollbar-gutter: stable` (~14-17px, incondicional aunque ya no
  necesite scrollear gracias al Intento 2) → nuestro `<main>` interno
  quedaba ~30px más adentro que el gap normal (~17px) que tiene
  CUALQUIER otra página de la app (verificado comparando con
  `/app/admin/instructores`). Fix: `margin-right: -30px; width: calc(100% + 30px);`
  dentro del mismo `@container layoutmain (min-width: 1024px)` — offset
  verificado empíricamente inyectando CSS de prueba hasta que
  `host.getBoundingClientRect().right` coincidiera exactamente con
  `.shell-content.getBoundingClientRect().right`.
- **Scroll residual / gap sobre la card**: PrimeNG renderiza un
  `<p-stepper-separator>` dentro de cada `p-steppanel-content-wrapper`
  aunque no usemos `<p-step-list>` (sin círculos de pasos que conectar).
  Por `display: inline` (default del custom element), el `height: 2px`
  del override global en `_primeng-overrides.scss` (pensado para cuando
  SÍ hay step-list) no tiene efecto — el elemento ocupa ~19-24px
  fantasma. Fix: `:host ::ng-deep .stepper-premium p-stepper-separator { display: none; }`,
  scoped a este componente (no se toca el override global, que sigue
  disponible para un futuro step-list con conectores).

Con ambos fixes: @ 1600×900, scroll residual bajó de 39px a 15px
(imperceptible, botón "Guardar y Continuar" totalmente visible) y la
scrollbar quedó pegada al mismo gap que el resto de la app.

## Intento 1 — REVERTIDO

El primer intento (container query `@container layoutmain` +
`calc(100vh - 120px)` en `:host`, más densidad reducida en
`personal-data.component.html`) se implementó SIN verificación visual
(Playwright no disponible en esa sesión) y el dueño reportó que empeoró
la vista: seguía habiendo scroll, contenido cortado, y una segunda
scrollbar. Se revirtió por completo.

## Intento 2 — Diagnóstico verificado con Playwright MCP (medido en el navegador real)

Con Playwright se confirmó exactamente la causa raíz y se midió (no se
adivinó) el offset correcto:

- `.shell-content` (el padre real, NO flex) queda con altura acotada
  (812px @ viewport 889px) porque él SÍ es `flex-1` dentro de `<main>`
  (que es flex). Su `scrollHeight` (959px) excede su `clientHeight`
  (812px) → **es `.shell-content` el que scrollea** (scroll de página).
- El `:host` de `SecretariaMatriculaComponent` mide 959px (`height:auto`,
  exactamente su contenido) — confirmado que `flex: 1` no tenía ningún
  efecto ahí.
- El offset correcto **NO es 120px** (ese valor es específico de
  `.bento-grid--fill-screen`, una estructura distinta). Midiendo
  directamente: `topbar (56px) + margin-top de .shell-content (12px) +
  margin-bottom de .shell-content (8px) = 76px` de base, pero el
  `margin: -1.5rem` "full-bleed" del propio `:host` (agregado
  originalmente para que el hero azul tocara los bordes — hero que
  fix-046 ya eliminó) interfiere con el cálculo, agregando ~24px extra de
  interacción con el padding/margen de `.shell-content`. Empíricamente
  (inyectando CSS de prueba y midiendo `scrollHeight` vs `clientHeight`
  con Playwright) el offset que elimina el scroll de `.shell-content` por
  completo es **100px**, y solo si TAMBIÉN se remueve el hack de
  full-bleed (`margin: -1.5rem; width: calc(100% + 3rem)`) — ese hack ya
  no tiene función desde que fix-046 quitó el hero que lo necesitaba.

## Contexto original del pedido

El dueño reportó que la vista "Nueva Matrícula" (`SecretariaMatriculaComponent`,
usada como vista routeada en `/app/secretaria/matricula` y
`/app/admin/matricula`, y embebida en los drawers de "Nueva Matrícula"
desde Base Alumnos B y Dashboard) requiere scroll de página para ver todo
el contenido al ingresar (Paso 1). Pidió que sea "app-like": al entrar
(Paso 1) no debe requerir scroll; los pasos siguientes sí pueden
necesitarlo si su contenido es más largo.

### Causa raíz

`SecretariaMatriculaComponent`'s `:host` (en
`secretaria-matricula.component.scss`) usa `flex: 1; min-height: 0;`
asumiendo que su padre es un contenedor flex. Pero el padre real en el
DOM es `.shell-content` (`app-shell.component.ts`), un `<div
class="shell-content flex-1 overflow-y-auto ...">` **sin `display:
flex`** — es un contenedor de bloque normal. Como resultado, `flex: 1` en
nuestro `:host` no tiene ningún efecto (las propiedades flex solo
aplican si el padre es un contenedor flex/grid), y el host termina con
`height: auto` (se ajusta a su contenido completo). Esto empuja
`.shell-content` (que SÍ tiene una altura acotada vía `flex-1` dentro de
`<main>`, que es flex) a crecer y ser el que scrollea — es decir, la
"página" scrollea en vez de un panel interno.

Este es exactamente el mismo problema que ya resuelve el patrón
"App-like" documentado (`.claude/rules/visual-system.md` §Patrón
App-like) para vistas `.bento-grid`, mediante
`.bento-grid--fill-screen { @container layoutmain (min-width: 1024px) {
height: calc(100vh - 120px); ... } }` — un alto explícito basado en
viewport (no en propagación flex ambigua), gateado por container query
contra `<main>` (`container-name: layoutmain`, seteado en
`app-shell.component.ts`). `SecretariaMatriculaComponent` no usa
`.bento-grid` (tiene su propio shell custom), así que no hereda ese
arreglo automáticamente.

Adicionalmente, el contenido del Paso 1 (`PersonalDataComponent`) es lo
bastante alto (varias filas de campos + selector de tipo de licencia +
acciones, con `space-y-6`/`p-6`/`pt-6` generosos) que, incluso con el
shell correctamente acotado, podría seguir necesitando scroll interno en
pantallas de laptop más pequeñas. Se ajusta su densidad vertical
(gaps/paddings) para que quepa cómodamente en el alto disponible típico.

## Alcance

1. **`secretaria-matricula.component.scss`** — en `:host`:
   - Eliminar el hack full-bleed (`margin: -1rem/-1.5rem; width: calc(100% + ...)`)
     — sin función desde fix-046 (ya no hay hero que necesite tocar bordes).
   - Reemplazar el `flex: 1` (sin efecto sobre `.shell-content`, que no es
     flex) por `@container layoutmain (min-width: 1024px) { height: calc(100vh - 100px); }`
     — offset verificado empíricamente con Playwright (ver diagnóstico
     arriba), no el `120px` de `.bento-grid--fill-screen`. Mobile/tablet:
     sin alto forzado, scroll nativo de página (igual criterio que el
     resto del patrón app-like).
   - Mantener `display:flex; flex-direction:column; overflow:hidden;` y
     conservar `flex:1; min-height:0;` para el caso en que este
     componente se usa DENTRO de un drawer (`LayoutDrawerComponent`, cuyo
     body sí es flex real) — el container query de `layoutmain` no
     matchea en ese contexto (no hay ese contenedor en el árbol del
     drawer), así que ambas reglas conviven sin conflicto.
2. **`personal-data.component.html`** — con el shell corregido, el
   scroll de página desaparece pero queda un scroll INTERNO en `<main>`
   de ~159px (medido con Playwright @ 1600×900) porque el contenido del
   Paso 1 sigue siendo más alto que el espacio disponible. El pedido
   original explícitamente exige cero scroll al ingresar al Paso 1, así
   que se reduce densidad vertical (`space-y-6`→`space-y-4`, card
   `p-6`→`p-5`, header `mb-6`→`mb-4`, tarjetas de categoría
   `p-4`→`p-3`, acciones `pt-6`→`pt-4`) y se envuelve el bloque de
   alertas de edad (vacío la mayor parte del tiempo) en un `@if` para que
   no consuma un gap de `space-y` cuando no hay alerta que mostrar. Cada
   cambio se verifica con Playwright (`scrollHeight` vs `clientHeight`)
   hasta confirmar cero overflow en el viewport de referencia.
3. No se toca la lógica del wizard, los facades, ni el resto de los
   steps (Asignación, Documentos, Contrato, Pago, Confirmación) — esos sí
   pueden requerir scroll interno si su contenido es más largo, como pidió
   el dueño explícitamente.

## Acceptance Criteria — verificadas con Playwright MCP (navegador real)

- AC1 ✅: `:host` tiene `height: calc(100vh - 100px)` gateado por
  `@container layoutmain (min-width: 1024px)`, offset medido
  empíricamente (no el `120px` de `.bento-grid--fill-screen`).
- AC2 ✅: Verificado en `/app/admin/matricula` @ 1600×900/960/768 —
  `.shell-content.scrollHeight === .shell-content.clientHeight` siempre
  (page-level scroll eliminado); el scroll cuando existe ocurre en el
  `<main>` interno del wizard.
- AC3 ✅ (@ ≥960px de alto de viewport): cero scroll interno en Paso 1
  (`wizardMain.scrollHeight === wizardMain.clientHeight` @ 1600×960).
  @ 900px: ~39px de scroll interno residual (imperceptible, sin cortes ni
  doble scrollbar). @ 768px (laptop 1366×768 común): ~171px de scroll
  interno — el shell sigue correctamente delimitado (sin scroll de
  página, sin contenido cortado), pero NO es cero. No se siguió reduciendo
  densidad más allá de este punto para no comprometer legibilidad.
- AC4 ✅: No se tocó ningún otro step; heredan el mismo `:host` corregido.
- AC5: No re-verificado explícitamente en viewport <1024px en esta
  sesión (sin cambios respecto al comportamiento previo — la regla
  `@container` simplemente no aplica ahí, como en el resto del patrón
  app-like).
- AC6 ✅: `npm run test:ci` → 104 archivos / 1302 tests, todo verde.
  `npx tsc --noEmit` limpio. `npm run lint:arch` sin hallazgos nuevos.

**Verificado también:** el uso como drawer (Base Alumnos B → "+ Nueva
Matrícula") sigue funcionando correctamente — el `flex:1` conservado en
`:host` para ese contexto no entra en conflicto con la regla
`@container`, y el badge "Paso N de 6" de fix-046 se ve correctamente en
el header del drawer junto con el shell corregido.
