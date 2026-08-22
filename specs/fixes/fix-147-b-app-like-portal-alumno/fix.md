# Fix: App-like: portal alumno (`clases`, `pagos`, `pruebas-online`, `pagar`)
> id: fix-147-b-app-like-portal-alumno
> refs: ASG-b-079
> status: in_progress
> created: 2026-08-22

## Root Cause

[Heredado de ASG-b-079, a confirmar]: Paso 12 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`) — 4 páginas del portal alumno que hoy no siguen el patrón
app-like (fill-screen desktop / scroll interno). El portal se usa mayoritariamente en mobile,
donde el patrón no aporta, así que es prioridad menor que el resto del rollout, pero de
esfuerzo bajo-medio. `alumno/horario` y `alumno/dashboard` no entran acá — son ASG-b-070 y
ASG-b-083 respectivamente, ambas ya cerradas.

Diagnóstico por página (verificado en el audit del 2026-08-02, a re-confirmar contra el código
actual antes de tocar — precedente `fix-133-b`, donde el toolbar que describía la asignación ya
no existía en el archivo):

- **`/alumno/clases`** (`AlumnoClasesComponent`, 489 líneas): hero + selector-matrícula
  (opcional) + 1 card con TABS INTERNAS (Prácticas/Teoría, signal `activeTab`) + banner final
  condicional (probablemente empty-state).
- **`/alumno/pagos`** (`AlumnoPagosComponent`, 324 líneas): hero + selector-matrícula (opcional)
  + banner de estado (opcional, 1 de 2 variantes mutuamente excluyentes: aviso saldo pendiente
  Profesional / "matrícula al día") + "Historial de pagos" (siempre, salvo error). Mismo problema
  que `alumno/horario`: selector + banner-estado pueden coexistir = 2 filas auto antes del fill.
- **`/alumno/pruebas-online`** (`AlumnoPruebasOnlineComponent`, 204 líneas): hero + banner con
  grid anidado de `bento-square` (stats) + banner con grid anidado de `bento-wide` (lista de
  simuladores) — encaja directo como KPI-row + contenido.
- **`/alumno/pagar`** (`AlumnoPagarComponent`, 317 líneas): stepper hand-rolled (no PrimeNG),
  3 pasos (resumen de saldo, confirmación, pago Webpay). Contenido corto por paso — **posible
  exención, no implementación** (ver decisión de alcance abajo).

## ACs Afectados

Ninguno — fix autónomo (rollout de layout, no cambia contrato de negocio).

## Decisión de alcance tomada al reclamar (2026-08-22)

`/alumno/pagar` entra al track como **decisión con evidencia, no como implementación
garantizada**. Primer paso obligatorio: medir el alto real de los 3 pasos del stepper.

- Si ningún paso desborda → califica por el **criterio #1** de
  `.claude/rules/visual-system.md` §"Cuándo NO aplica el patrón" ("contenido genuinamente corto
  que nunca produce overflow"). Se deja la página sin tocar y se documenta la excepción
  justificada en `indices/APP-LIKE-ROLLOUT.md`.
- Si desborda → se le aplica el patrón full-height custom de wizard ya validado en
  `secretaria-matricula.component.scss` (`:host { display:flex }` +
  `@container layoutmain (min-width:1024px) { height: calc(100vh - Npx) }`), **no** un
  `--fill-screen-*` del canon bento.

Descartadas explícitamente: excluir `pagar` de entrada sin medir (grabaría una decisión sin
evidencia) e implementarla sí o sí (tocaría una página que quizás no lo pide).

## Cambio

**Patrón único aplicado a las 4 páginas** (`pagar` incluida: la medición la trajo al alcance,
ver §4): root `--fill-screen-kpi --rows-fit`, un
wrapper-agrupador SIEMPRE presente en la fila 2 (los `@if` adentro) y una única celda
`.bento-fill` con su propio scroller interno. `--rows-fit` no es decorativo: sin él, el wrapper
agrupador cuando queda vacío hereda el piso `--bento-row-min` (120px) en móvil, donde no hay
`grid-template-rows` explícito, y deja una franja vacía.

### 1. `/alumno/clases`
- **Archivo:** `src/app/features/alumno/clases/alumno-clases.component.ts`
- **Incógnita heredada RESUELTA — el banner final SÍ se suma como 4ta fila.** El panel
  principal (`bento-banner card`) **no tiene `@if`**: se renderiza siempre. La alerta "Sin
  matrícula activa" (`!loading() && !facade.data()`) por lo tanto no lo reemplaza, coexiste con
  él. Confirmado leyendo el componente, no asumido.
- **Qué cambia:** root → `--fill-screen-kpi --rows-fit`. Selector-matrícula + alerta
  "Sin matrícula" agrupados en un wrapper `.bento-banner flex flex-col gap-3` siempre presente
  (la alerta **sube** por encima del panel a propósito: explica por qué el panel de abajo está
  vacío). Panel de tabs → `.bento-fill`; las tabs quedan `shrink-0` **fuera** del scroller (no
  se pierden al bajar el listado) y todo el `@if/@else if/@else` de contenido pasa a un único
  `<div class="flex-1 min-h-0 overflow-y-auto">`.

### 2. `/alumno/pagos`
- **Archivo:** `src/app/features/alumno/pagos/alumno-pagos.component.ts`
- **Qué cambia:** root → `--fill-screen-kpi --rows-fit`. Selector + banner-de-estado + banner de
  error agrupados en el wrapper siempre presente; el `@if (error) {...} @else {...}` se aplanó a
  `@if (error) … @else if (enrollment) … @else if (…)`, preservando exactamente las mismas
  condiciones. Historial → `.bento-fill` con `<h2>` `shrink-0` y scroller propio.
- **Comportamiento preservado a propósito:** el historial sigue **oculto ante error**
  (`@if (!facade.error())`). En ese estado no se renderiza celda `.bento-fill` alguna, así que
  la fila fill queda simplemente vacía — no hay nada que `contain:size` pueda colapsar.
- **Estado vacío centrado:** "Aún no se han registrado pagos" pasó a
  `flex-1 flex flex-col items-center justify-center` por la regla de `visual-system.md`
  (dentro de un `.bento-fill` la celda mide el resto del viewport y el mensaje quedaría arriba
  con un hueco enorme debajo). El skeleton se dejó alineado arriba a propósito: representa una
  lista que también empieza arriba.
- **`style="padding-bottom: 5rem"` inline eliminado del root.** No es un patrón compartido —
  existía solo en `pagos` y `pagar`, y no hay bottom-nav en `layout/` que lo justifique. Con
  `--fill-screen-kpi` el root pasa a `height: calc(100vh - 120px)` y esos 80px se comían del
  alto fijo, dejando una franja muerta al pie: exactamente lo contrario del patrón.

### 3. `/alumno/pruebas-online`
- **Archivo:** `src/app/features/alumno/pruebas-online/alumno-pruebas-online.component.ts`
- **Riesgo heredado CONFIRMADO como real, resuelto sin lógica nueva.** El banner de stats es
  `@if (!isProfessional())`: un alumno Profesional no tiene fila KPI, que es justo el caso que
  en `fix-133-b` mandaba la celda `.bento-fill` a la fila `auto` y la colapsaba a ~0px.
- **Resuelto con el wrapper siempre presente** (precedente `fix-127-b`) en vez del `computed()`
  que alterna el modificador del root (precedente `fix-133-b`). Ambos sirven; se eligió el
  wrapper porque **no introduce lógica de densidad nueva** y por lo tanto no obliga a un
  `.spec.ts` nuevo, manteniendo el checklist del rollout como estaba previsto. El `computed()`
  de `vehicle-maintenances` sigue siendo la opción correcta cuando la fila KPI depende de datos
  de red (0..N ítems); acá depende de un `computed()` estable del tipo de licencia.
- **Qué cambia:** root → `--fill-screen-kpi --rows-fit`; stats en wrapper siempre presente;
  banner de simuladores → `.bento-fill` con el grid anidado como scroller
  (`flex-1 min-h-0 overflow-y-auto`) y el encabezado `shrink-0`.

### 4. `/alumno/pagar` — SE IMPLEMENTA (la medición contradijo la hipótesis heredada)

- **Archivo:** `src/app/features/alumno/pagar/alumno-pagar.component.ts`
- **Medición con saldo pendiente real, ANTES del cambio** (`.shell-content`, el scroller real):

  | Alto | Step 1 | Step 3 |
  |---|---|---|
  | 1440×900 | 823/823 ok | 823/823 ok |
  | 1440×768 | **697/691 DESBORDA** | 691/691 ok |
  | 1440×700 | **697/623 DESBORDA** | **656/623 DESBORDA** |

  1440×768 es una resolución de laptop común y está en el checklist del rollout. La página
  **NO califica** por el criterio #1 ("contenido que nunca produce overflow"): sí lo produce.

- **Dos falsos negativos que casi cierran esto como exención — vale la pena que queden escritos:**
  1. **La cuenta del seed no tiene saldo pendiente Clase B**, así que `/alumno/pagar` renderiza
     solo hero + stepper (ninguna rama del `@if` entra). Medir así da "no desborda" con total
     confianza y es una medición del vacío. Hubo que inyectar un `load-enrollment-status`
     sintético (Edge Function interceptada en el harness, **sin tocar código de la app**) para
     que apareciera la variante pesada de 2 columnas.
  2. **El scroller de la app NO es `main` ni `documentElement`, es `.shell-content`.** Medir
     overflow contra `main` da `scrollHeight === clientHeight` siempre → "no desborda" en todos
     los casos. Se detectó porque el contenido (681px) no entraba en el contenedor (643px) y
     aun así el chequeo daba negativo: la contradicción delató el método, no el layout.

- **Qué cambia:** se aplicó **el canon bento (`--fill-screen-kpi --rows-fit`)**, no el patrón
  custom de wizard que este mismo documento había pre-registrado. Motivo: el patrón de
  `secretaria-matricula.component.scss` existe porque ese wizard **no es un `.bento-grid`**
  (tiene shell propio, con `margin-right:-30px` para realinear su scrollbar). `pagar` **ya es
  un `.bento-grid`** y su estructura es literalmente las 3 filas del canon: hero / stepper /
  contenido del paso. Meterle el hack de wizard habría sido duplicar maquinaria para un caso
  que el canon cubre. Concretamente: stepper + banner de error agrupados en el wrapper siempre
  presente (el error es condicional y corría el contenido fuera de la fila fill); step 1 y
  step 3 comparten la única celda `.bento-fill` (son mutuamente excluyentes); `bento-banner`
  quitado de las ramas internas, que ya no son celdas del grid; card "Tu matrícula está al día"
  centrada en el alto disponible; `style="padding-bottom: 5rem"` inline eliminado igual que en
  `pagos`.
- **Corrección al enunciado heredado:** el stepper tiene **2 nodos, no 3** (`steps()` =
  Resumen → Pago, `facadeStep` 1 y 3). El paso intermedio no existe desde fix-017: las 12 clases
  se agendan en la matrícula y el alumno no elige horarios.

## Test de Regresión

### Estático

- [x] `npx tsc --noEmit` — exit 0.
- [x] `npm run test:ci` — **177 test files, 2210 tests, 0 fallos**.
- [x] `npm run lint:arch` — exit 0. Conteo de warnings por regla **idéntico** al baseline sin
      este cambio (comprobado stasheando los archivos y difeando). ARCH-19 (9 casos vs cuota 7)
      es deuda preexistente en `matricula-steps/confirmation`, que este track no toca.
- [x] **Sin `.spec.ts` nuevo** — ninguna de las 4 páginas introdujo lógica de densidad (ver
      §Cambio 3: se eligió el wrapper por sobre el `computed()` justamente para eso).

> ⚠️ **`tsc --noEmit` NO valida templates de Angular.** Un estado intermedio de `alumno-clases`
> tenía `NG5002: Unexpected closing tag "section"` y pasaba `tsc`, los 2210 tests y `lint:arch`
> sin una queja: apareció solo al abrir el navegador. En este rollout, verde en estático no es
> evidencia de que el template compile.

### Visual (navegador real, datos reales, tipografía de producción)

Alumno `alumno@test.com` (Clase B, 2/12 prácticas). Medido sobre `.shell-content` — el scroller
real de la app, no `main` ni `documentElement`.

| Página | 1440×900 | 1440×768 | 390×844 |
|---|---|---|---|
| `clases` | fill 561px, scroll interno ✅ | fill 429px, scroll interno ✅ | `contain:none`, scroll nativo ✅ |
| `pagos` | fill 543px ✅ | fill 411px ✅ | `contain:none` ✅ |
| `pruebas-online` | fill 340px ✅ | fill 208px, scroll interno ✅ | `contain:none` ✅ |
| `pagar` | fill 506px ✅ | fill 374px ✅ | `contain:none` ✅ |

- [x] **`documentScrolls: false` en las 4 páginas y los 3 viewports.**
- [x] Ninguna celda `.bento-fill` colapsada (todas > 0px) y `contain: size` solo en lg+.
- [x] **`pagar` post-fix:** no desborda a 900/800/768/**700**, donde antes sí. El contenido
      **scrollea, no se recorta**: a 1440×600 y 1440×520 el CTA "Pagar con Webpay" sigue siendo
      alcanzable dentro del scroller (verificado con `scrollIntoView`, no asumido).
- [x] **Tipografía de producción**: la primera pasada corrió con fuentes de fallback
      (Google Fonts bloqueado) — se relayaron también `fonts.googleapis.com`/`fonts.gstatic.com`
      y se re-midió. Las alturas se sostienen. Medir un layout con la tipografía equivocada
      habría dado números que no son los de producción.
- [x] **Caso "wrapper vacío" verificado en vivo:** en `clases` y `pagos` la fila 2 mide
      **0px** (este alumno no tiene selector ni banner de estado) y la celda fill igual cae en
      la fila 3 sin colapsar. Es exactamente el mecanismo que protege el caso Profesional de
      `pruebas-online`, y confirma que `--rows-fit` hacía falta (sin él la fila vacía heredaría
      el piso de 120px en móvil).
- [x] Consola sin errores atribuibles a este cambio.

### Caso Profesional de `pruebas-online` — verificado con control negativo

El caso que motivó el wrapper (alumno Profesional, sin fila de stats) no existe en el seed, así
que se ejercitó el **mecanismo CSS** directamente sobre el DOM renderizado, con un control
negativo que reproduce el bug que el wrapper evita:

| Escenario | `grid-template-rows` | Alto de `.bento-fill` |
|---|---|---|
| Con stats (Clase B, estado real) | `62px 274px 340px` | 340px ✅ |
| Wrapper vacío (= Profesional) | `62px 0px 614px` | **614px ✅** crece, no colapsa |
| **Sin wrapper** (control negativo) | `62px 0px 614px` | **0px ❌ colapsada** |

El control negativo es la parte que importa: **quitar el wrapper colapsa la celda a 0px**, que
es exactamente el fallo de `fix-133-b`. Prueba que la mitigación es portante y no decorativa.

### Pendiente

- [ ] **`clases` con alumno sin matrícula** (alerta "Sin matrícula" + panel coexistiendo). No hay
      cuenta de seed en ese estado. Riesgo bajo: la dirección peligrosa es el wrapper **vacío**
      (ya verificada arriba y en el estado real de `clases`/`pagos`, donde la fila 2 mide 0px);
      con la alerta presente el wrapper solo crece, que es el caso benigno.

### Ruido ambiental del contenedor (no del cambio)

`ERR_TUNNEL_CONNECTION_FAILED`→403 a Supabase hasta que se habilitó el host; Chromium no
enruta HTTPS por el agent proxy (se resolvió interceptando en el harness y relayando por node,
sin tocar la app); WebSocket de Realtime rechazado (el proxy no soporta upgrades); ícono Lucide
`milestone` servido desde un CDN no relayado. Ninguno es reproducible fuera de este sandbox.
