# Fix: Áreas táctiles bajo 44×44 en el vocabulario de controles compartidos

> id: fix-150-b-areas-tactiles-compartidos
> refs: ASG-b-093
> status: done
> closed: 2026-08-25
> created: 2026-08-24

## Root Cause

**[Heredado de ASG-b-093, confirmado con medición propia]:** medido durante la verificación
móvil de `fix-147-b` con `isMobile`/`hasTouch` reales:

| Elemento | Medido | Mínimo HIG |
|---|---|---|
| Tabs de `<app-tabs variant="segmented">` | **94×32** y **73×32** | 44×44 |
| Link "volver" de `<app-section-hero>` (`backLabel`) | **50×16** | 44×44 |

Reproducido en este track a 375×812 con `any-pointer: coarse` y `maxTouchPoints: 5`:
`/app/alumno/clases` da exactamente **94×32 y 73×32**, y el back-link **50×16**.

Encuadre (igual que en `fix-095-b`, para no confundir con incumplimiento): esos tamaños **ya
cumplen WCAG 2.5.8** (Target Size Minimum, AA, WCAG 2.2 → mínimo real 24×24px). Lo que no
cumplen es 44×44px, que es guía Apple/Google HIG y WCAG 2.5.5 (AAA, no obligatorio). Es mejora
de usabilidad táctil, no un bug de accesibilidad bloqueante.

Lo que sí lo vuelve P1: el portal alumno se usa mayoritariamente en móvil y en `/alumno/clases`
las tabs Prácticas/Teoría son el control principal de la pantalla.

## ACs Afectados

Ninguno — fix autónomo de usabilidad, sin AC de spec previa.

## Alcance del barrido (el vocabulario de controles del DS)

La asignación pide barrer el vocabulario de controles del DS, no arreglar solo los dos
nombrados. Resultado, con el alto derivado de los tokens y confirmado en vivo:

| Control del DS | Alto | ¿Entra? |
|---|---|---|
| `btn-primary` y hermanos (`--btn-primary-padding-y` 12px + ~20px de línea) | 44px | No — ya cumple |
| **`btn-sm`** (6px + ~16px) | **~28-30px** | **Sí** |
| `app-tabs` variant **`line`** (py-3.5 + text-sm) | 48px — medido 72px en vivo | No — ya cumple |
| `app-tabs` variant **`segmented`** (py-1.5 + text-sm) | **32px** | **Sí** |
| `app-tabs` variant **`pill`** (py-2.5 + text-sm) | **40px** | **Sí** |
| `app-section-hero` back-link, barra compacta | **16px** | **Sí** |
| `app-section-hero` back-link, barra hero (py-1.5 + text-xs) | **28px** | **Sí** |
| `badge-*`, `tab-count` | — | No — no son interactivos |

`btn-sm` estaba **deliberadamente diferido**: `ASG-b-061` dijo "si se decide que vale la pena
para los ~44 usos hermanos de `btn-sm`, coordinar aparte — no expandir el scope sin decisión
explícita". **ASG-b-093 es esa decisión**, y la preocupación de fondo queda intacta: el
mecanismo es hit-area invisible, así que **no toca el tamaño visual** ni reabre la densidad
compacta de `fix-086-m`. Son 39 usos en 3 componentes hermanos.

Los `*-content` de página con botones compactos ad-hoc (sin `btn-*`) **quedan fuera a
propósito**: no son vocabulario del DS, y ya los cubre `ARCH-16` (utilities de tamaño sobre
`btn-*`) con su ratchet.

## Cambio

**1. `src/tailwind.css` — primitivo nuevo `.tap-area`, y `btn-sm` lo aplica solo**

`::before` invisible centrado que crece **solo en alto** hasta 44px, bajo
`@media (any-pointer: coarse)`. `btn-sm` lo consume con `@apply tap-area` (verificado sobre el
CSS compilado: la regla queda inlineada dentro de `.btn-sm`).

- **Solo en alto:** en los controles medidos el eje que falla es siempre el vertical; el ancho
  ya supera 44px. Extenderlo también en X hace que dos controles contiguos de una toolbar se
  roben el toque entre sí. Misma conclusión empírica a la que llegó `fix-095-b`.
- **`any-pointer: coarse` y no siempre:** con mouse no aporta nada y sí agrega riesgo de
  robarle el click al vecino de arriba. `any-pointer` (no `pointer`) para cubrir el laptop
  híbrido con pantalla táctil, donde el puntero *primario* es el trackpad.

**2. `tabs.component.ts` — `tap-area` en `segmented` y `pill` + alto reservado en el contenedor**

`line` no se toca (48px, ya cumple). Además de la clase en los botones, los dos contenedores
necesitaron reservar alto — ver el hallazgo de abajo, que es la parte no obvia del fix.

**3. `section-hero.component.ts` — `tap-area` en los 4 markups del back-link**

`<a routerLink>` y `<button>` (backClickable), en la barra compacta y en la barra hero.

**4. `asistencia-clase-b-content.component.ts` — se elimina la clase local `.rail-action-btn`**

Era la copia ad-hoc de este mismo mecanismo (`fix-095-b`). Sus 3 botones ya son `btn-sm`, así
que heredan el hit-area del primitivo sin clase extra; el componente quedó sin `styles`.
⚠️ **Angosta un comportamiento existente a propósito:** la versión local aplicaba con **todo**
puntero, el primitivo la limita a punteros gruesos.

**5. `scripts/lib/a11y-guardrails.js` — detector `findHandRolledTapAreas` (ARCH-23)**

Ver "Guardrail" abajo.

## Hallazgo: el `::before` se recortaba — el hit-area real era 40px, no 44px

La parte que **la medición geométrica no ve**. Con `.tap-area` puesto, el computed style del
pseudo decía `min-height: 44px`; el barrido con `document.elementFromPoint()` dio **40px**:

```
boton visual : 261 -> 293  (32px)
hit-area real: 257 -> 296  (40px)   <-- no 44
contenedor   : 257 -> 297  (40px, padding 4px, overflow-y computado: auto)
```

**Causa:** el contenedor de tabs es un scroller horizontal (`overflow-x: auto`), y en CSS
`overflow-y` **no puede quedar `visible`** si `overflow-x` es `auto`: computa a `auto`. El
scroller recortaba el `::before` contra su propio borde, dejándole solo los 4px de padding en
vez de los 6px que el pseudo pide de cada lado.

**Corrección:** reservar el alto en el contenedor, solo en punteros gruesos.

- `.tabs-segmented-row` → `padding-block: 6px` (botón de 32px; el contenedor pasa de 40 a
  **44px**). Tiene fondo propio, así que no se puede esconder con margen negativo.
- `.tabs-pill-row` → `padding-block: 2px; margin-block: -2px` (botón de 40px, solo necesita 2px
  por lado). Sin fondo, el margen negativo cancela el efecto en el layout: imperceptible.
- `row-gap: 0.75rem` en segmented, **solo** por el caso `wrap=true` (hoy nadie usa ese input):
  con dos filas apiladas, hit-areas de 44px sobre botones de 32px se solaparían en el `gap-1`
  de 4px y una fila le robaría el toque a la otra.

**Moraleja, ya volcada a `indices/STYLES.md` y al comentario del primitivo:** con `.tap-area`
hay que verificar con `document.elementFromPoint()`, **nunca** con `getComputedStyle` —
cualquier ancestro que recorte se come el hit-area sin que el computed style lo denuncie.

## Guardrail: ARCH-23 (evaluado, no asumido)

La asignación pedía **evaluar** si amerita un guardrail. Evaluación:

- **Botón compacto ad-hoc sin `btn-*`** → ya lo cubre `ARCH-16` con ratchet. No hace falta
  regla nueva.
- **Detectar estáticamente "control bajo 44px"** desde clases de Tailwind → **descartado**:
  habría que calcular altura resolviendo `py-*`/`p-*`/`text-*`/`h-*`/`min-h-*` y sus
  combinaciones. Altísimo falso positivo para lo que aporta.
- **Reimplementar el hit-area a mano** → **sí amerita**, y es preciso. Ya pasó exactamente una
  vez (`.rail-action-btn`, `fix-095-b`), que es lo que este fix consolidó. Mismo patrón que
  `ARCH-21`/`ARCH-22`: congelar el primitivo y bloquear la copia ad-hoc.

`ARCH-23` marca un `::before`/`::after` que declare `min-height`/`min-width` de `44px` (o
`2.75rem`) fuera de `tailwind.css`. **No** marca un `min-height: 44px` aplicado directo al
control — eso es dimensionar de verdad, decisión legítima y distinta (ej. los CTA de
`_public-enrollment.scss`). Error duro sin ratchet: arranca en cero.

> **El wiring en `scripts/architect.js` lo aplicó el dueño a mano (2026-08-25).** `architect.js`
> está en la lista de archivos protegidos del File Protector (`.claude/hooks/pre-write-guard.js`),
> que dice explícitamente "pide al humano que lo haga manualmente" — por eso el agente dejó el
> patch preparado en `architect-arch23.patch` (al lado de este archivo) en vez de escribirlo.
>
> Verificado tras la aplicación: import + metadata + función + los **3 call sites**
> (`analyzeTypeScript`, `analyzeTemplate`, `analyzeStyles`) presentes; `lint:arch` **exit 0** con
> el repo limpio y **exit 1** con un componente de control que reintroduce el CSS de `fix-095-b`,
> con el mensaje apuntando a `.tap-area`.

## Test de Regresión

Sin `.spec.ts` nuevo para los componentes — el cambio es de CSS/clases en `shared/` y el
proyecto excluye component specs de Vitest (memoria `project_no_angular_component_tests`).

`npm run test:ci`: **2221 pasan, 5 skipped, 1 falla**.

- La que falla es
  `secretaria-contabilidad-cuadratura.component.spec.ts > openIngresoDrawer (fix-080)`.
  **Es pre-existente, verificado y no supuesto:** con `git stash push -- src/` (o sea, HEAD
  limpio, sin ninguno de los cambios de este fix) **falla igual**. Este track no toca
  `features/secretaria/` ni ninguna facade. Queda como deuda ajena a reportar aparte.
- ⚠️ Ojo con `tabs.component.spec.ts`, que la asignación pedía "mantener verde": está
  **`describe.skip`** desde antes de este track, y además solo cubre `variant="line"`, que es
  justamente la variante que este fix **no toca**. No hay nada que mantener verde ahí — y
  tampoco cobertura automática de las variantes que sí se tocaron, de ahí que la verificación
  sea en navegador real.

Verificado en vivo (2026-08-25, `ng serve` en :4210, dispositivo táctil emulado 375×812 con
`any-pointer: coarse` y `maxTouchPoints: 5`):

**Toque — medido con `document.elementFromPoint()`, no con `getComputedStyle`**

| Control | Portal / Ruta | Visual (sin cambio) | Hit-area | ≥ 44 |
|---|---|---|---|---|
| tab segmented "Prácticas" | alumno · `/app/alumno/clases` | 94×32 | **95×44** | ✅ |
| tab segmented "Teoría" | alumno · `/app/alumno/clases` | 73×32 | **73×44** | ✅ |
| back-link "Inicio" | alumno · `/app/alumno/pruebas-online` | 50×16 | **50×44** | ✅ |
| back-link "Listado de Alumnos" | admin · `/app/admin/alumnos/1` | 131×16 | **132×45** | ✅ |
| back-link "Dashboard" | instructor · `/app/instructor/horario` | 82×16 | **82×45** | ✅ |
| `btn-sm` rail "Recordar" | admin · `/app/admin/asistencia` | 95×47 | **48 de alto** | ✅ |
| `btn-sm` "Actualizar" | admin · `/app/admin/asistencia` | 122×45 | **46 de alto** | ✅ |
| tab `line` (no se tocó) | admin · `/app/admin/asistencia` | 147×72 | — | ✅ ya cumplía |

**Cobertura de portales** (la asignación pedía verificar las rutas consumidoras): medido en
**alumno, admin e instructor**. `secretaria` no se midió por separado a propósito — sus páginas
consumen exactamente los mismos `shared/` (`app-section-hero`, `app-tabs`) y el mecanismo es un
primitivo CSS **global**, no algo que se active por ruta. Lo único que sí puede variar por ruta
es el choque de hit-areas, y ese se chequeó con un barrido de solapes en cada página medida:
**0 controles solapados** en todas.

- **Prueba funcional real, no solo geométrica:** un toque en `(200, 258)` — **5px por encima**
  del borde visual de "Teoría", fuera de su caja de 32px — lo resuelve el navegador al propio
  botón `Teoría`, y dispararlo **cambia efectivamente de tab** (`aria-selected` pasa a `true`
  tras un ciclo de change detection). El hit-area extendido captura el toque de punta a punta.
- **Sin robo de toque:** barrido de solapes entre el hit-area del back-link y todo otro control
  interactivo de la página → **ninguno**. En el rail de alertas, **46px de holgura** al
  siguiente botón.

**Desktop (puntero fino) — cero cambio, probado, no asumido**

En 926px sin touch (`any-pointer: coarse` = `false`), mismo `/app/alumno/clases`:

| | Esperado | Medido |
|---|---|---|
| `::before` del tab | no debe generarse | **`content: none`** |
| `position` del botón | `static` | **`static`** |
| Alto del contenedor | 40px | **40px** |
| Hit-area real | = caja visual | **32px** |

La regla entera vive dentro del `@media`, así que en desktop sin touch **no se emite**.

**Guardrail**

- Micro-suite `node scripts/lib/a11y-guardrails.test.mjs`: **verde**, 10 casos nuevos de
  ARCH-23 sobre los 12 pre-existentes de ARCH-20. Incluye como **control positivo el CSS
  textual de `.rail-action-btn` de `fix-095-b`** — si ese caso deja de marcarse, la regla no
  sirve para nada.
- Con el patch aplicado: `npm run lint:arch` **exit 0** (ARCH-23 en cero, la única copia ya fue
  consolidada) y **exit 1** con un componente de control que reintroduce ese CSS, con el
  mensaje apuntando a `.tap-area`.

**Otros**

- `npm run lint:arch`: **exit 0**, 0 errores. Los warnings ARCH-16/ARCH-19 que aparecen son de
  `precios-cursos-drawer`, `instructor-alumnos` y `confirmation.component.html` — archivos que
  este fix no toca.
- Consola del browser limpia en las rutas verificadas. El único par 406/PGRST116 del buffer
  viene de una sonda propia a `/app/admin/alumnos/2` (id inexistente), no de la app.
- Captura móvil de `/app/alumno/clases`: las tabs se ven **idénticas**; el contenedor 4px más
  alto en touch es imperceptible.

### Limitación declarada

**La variante `pill` no pudo medirse en vivo.** Sus 4 usos están gateados por
`enrollments.length > 1` y el seed no tiene ningún alumno con dos matrículas (se probaron
`/app/admin/alumnos/1` y `/2`, y las 3 páginas del portal alumno que la usan). Quedó verificado
que la regla CSS se emite y que el mecanismo es **el mismo** que en `segmented`, que sí se midió
end-to-end — pero el número concreto de `pill` no está medido. Vale confirmarlo cuando exista
el dato.
