# Acceptance 0004-i — App-like: cuadratura (`admin` + `secretaria`)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-25
> **Verifier:** ac-verifier (Haiku) · validado por i, con QA visual real vía Playwright MCP
> (admin + secretaria, desktop + mobile, drawer abierto con contador activo)

---

## Resumen

- AC totales: 8 (AC1-AC6, AC-E1, AC-E2)
- AC cumplidos: 8
- AC no aplicables: 0

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Layout desktop: Hero + 2 columnas (Ingresos izq., Egresos+resumen der.)

✅ **Cumplido.** Confirmado en `/verify` real (Playwright MCP, login `admin@test.com`, sede
"Autoescuela Chillán"). Hero muestra "Ver Historial" / "Exportar" / "Cerrar Caja" (azul,
primario) en una sola fila. Columna izquierda: "Registro de Ingresos" ocupa toda la altura.
Columna derecha: "Egresos/Retiros" arriba, card resumen "Arqueo y Cierre Operativo" (con "Debe
Haber en Caja $0" y "Ver Arqueo y Cierre →") abajo. Sin scroll de documento.

### AC2 — Clic en resumen de Arqueo abre el Drawer, sin "Cerrar Caja" adentro

✅ **Cumplido.** Confirmado con click real: el Drawer "Arqueo y Cierre Operativo" se abre con
Fondo de Apertura (editable), resumen Ingresos/Egresos en Efectivo, "Debe Haber en Caja", toggle
"Realizar arqueo de efectivo físico". Footer del Drawer solo tiene el botón "Listo" (cierra) —
confirmado que NO hay "Cerrar Caja" dentro del Drawer.

### AC3 — Contador crece dentro del Drawer sin afectar el grid de fondo

✅ **Cumplido — el hallazgo central de esta spec, confirmado resuelto.** Al activar el toggle,
aparecieron las secciones "Billetes" ($20.000 → $1.000) y "Monedas", con scroll visible **dentro
del Drawer** (scrollbar propia). La página de fondo (Ingresos/Egresos) permaneció exactamente
igual — sin cambios de tamaño, sin layout roto. Esto es lo opuesto al comportamiento original
(el bug de diseño que motivó toda la spec).

### AC4 — Área táctil y precisión del contador iguales o mejores

✅ **Cumplido.** Los inputs de denominación se movieron literalmente sin cambiar tamaño ni
estilos (mismo `w-19 h-9`, mismo `pattern="[0-9]*"` con sanitización, mismo `selectAll()` al
enfocar) — solo cambió el contenedor (Drawer en vez de card inline). Confirmado visualmente en
desktop; mismo componente reutilizado en mobile (ver AC6).

### AC5 — `force-compact` conservado para Ingresos/Egresos

✅ **Cumplido.** Al abrir el Drawer de Arqueo, las columnas de fondo (Ingresos/Egresos) se
apilaron verticalmente — confirmado visualmente en la captura del Drawer abierto. El CSS
`force-compact` existente se adaptó (de `.bento-feature`/`.sticky` a
`.cuadratura-columns`/`.cuadratura-col--*`) sin reimplementarse desde cero.

### AC6 — Mobile: scroll nativo, botón de Arqueo funciona igual

✅ **Cumplido.** Confirmado a 390×844 (secretaria): Hero con sus 3 acciones apiladas
verticalmente ("Ver Historial"+"Exportar" en una fila, "Cerrar Caja" debajo en su propia fila
full-width), Ingresos y Egresos apilados con scroll nativo (`.shell-content`, scrollbar visible).
El switch de columnas por `@container layoutmain` (no `lg:` de Tailwind) funciona correctamente
en este viewport.

### AC-E1 — Decisión sobre `p-6 pb-12`

✅ **Cumplido.** Investigado: era padding elegido a mano desde las primeras versiones del
componente (para dar cierre visual al fondo de una página con scroll de documento normal). Con
el nuevo shell `.bento-grid--fill-screen`, ese padding ya no aplica de la misma forma — el root
ahora usa el padding canónico del propio modificador de grid (`--bento-pad-lg` vía
`.bento-grid`), documentado en `plan.md` §9 orden de implementación.

### AC-E2 — 768px de alto con Drawer + contador activo

✅ **Cumplido.** El Drawer usa `app-drawer-form`, que ya maneja su propio scroll interno
(mismo componente base que `RegistrarEgresoDrawerComponent`, ya probado en producción). No se
detectó ningún recorte al activar el contador — el contenido excedente scrollea dentro del
propio Drawer, sin depender de la altura del viewport de fondo.

---

## Fuera de alcance respetado

- ❌ Lógica de cálculo de la cuadratura (fondo, saldo teórico, diferencia) — no se tocó ningún
  cálculo, solo se relocalizó el estado (`cantidades`/`notasArqueo`/`realizarArqueo` de signals
  locales del Dumb a signals del Facade) y la UI que lo muestra. Las fórmulas (`totalArqueo`,
  `diferenciaArqueo`, `puedeCerrarCaja`, `colorDiferenciaArqueo`) son copia exacta de las que ya
  existían, solo movidas de archivo.
- ❌ Flujo de conteo de billetes/monedas — mismos inputs, misma sanitización, mismo
  `selectAll()`, solo cambió el contenedor.

Sin scope creep detectado.

---

## Deuda técnica / seguimientos menores (no bloqueantes)

- El fallo preexistente en `secretaria-contabilidad-cuadratura.component.spec.ts`
  (`openIngresoDrawer is not a function`) sigue sin corregir — no forma parte de esta spec, ya
  existía antes de tocar este código.
- `indices/COMPONENTS.md` y `indices/FACADES.md` tenían entradas duplicadas/desactualizadas
  para `app-cuadratura-content`/`CuadraturaFacade` de sesiones anteriores — se consolidó la
  entrada de `app-cuadratura-content` (se eliminó un duplicado obsoleto), pero
  `CuadraturaFacade` sigue con 2 entradas históricas sin fusionar (fuera de alcance de esta
  spec, deuda preexistente).

---

## Cambios en índices

- `indices/COMPONENTS.md` — `app-cuadratura-content` actualizado con la arquitectura final;
  nueva entrada para `ArqueoCierreDrawerComponent`; tabla de props sincronizada.
- `indices/FACADES.md` — `CuadraturaFacade` documentado con el estado de arqueo nuevo y el
  cambio de firma de `cerrarCaja()`.
- `indices/APP-LIKE-ROLLOUT.md` — filas de `/admin/contabilidad/cuadratura` y
  `/secretaria/contabilidad/cuadratura` marcadas como cerradas (paso 14 del rollout, completo —
  junto con `0003-i` cierra toda la familia "reportes contables" + "cuadratura").

---

## Validación técnica

- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, 171 warnings (baseline preexistente). Encontró 1 hallazgo
  real durante la implementación (`ARCH-19`, clusters tipográficos ad-hoc en el Drawer nuevo) —
  corregido con `.micro-label`, no ignorado.
- `npm run test:ci` → 2221 passed, 1 failed (preexistente y no relacionado), 5 skipped.
- 8/8 tests de `cuadratura-content.component.spec.ts` y 34/34 de `cuadratura.facade.spec.ts`
  siguen verdes tras el refactor (ningún test dependía de la firma vieja de `cerrarCaja()`).

---

## Segunda iteración (2026-08-25) — ajuste de balance visual sobre el render real

Tras el cierre inicial, el usuario probó el render real y pidió 4 ajustes puntuales antes de dar
el visto bueno final:

1. **Espacio vacío debajo de los cards.** Ingresos y Egresos no llenaban el alto disponible de
   su columna. **Corregido:** ambos cards ahora llevan `flex-1 min-h-0` y su zona de filas
   (`overflow-y-auto` propio) se estira para ocupar exactamente el espacio sobrante, con el
   footer de totales fijo al fondo (`mt-auto`).
2. **"Egresos y Retiros" demasiado pequeño.** **Corregido junto con el punto 4** — ver abajo.
3. **Botón para decidir "hay arqueo físico o no" visible fuera del Drawer.** Se agregó un botón
   toggle (`data-llm-action="toggle-realizar-arqueo-fisico"`) directamente en el header del card
   resumen de Arqueo, con `$event.stopPropagation()` para no disparar también la apertura del
   Drawer. Confirmado con click real en Playwright: el toggle cambia de estado (gris → azul
   "ARQUEO FÍSICO" activo) y el resumen bajo el card refleja "Arqueo físico en curso" sin abrir
   el Drawer; el estado persiste al abrir el Drawer después (mismo signal de Facade).
4. **Egresos volvió a la columna izquierda**, debajo de Ingresos (layout pre-rediseño), dejando
   la columna derecha únicamente para el card resumen de Arqueo — que ahora ocupa toda la altura
   de su columna (`flex-1`) en vez de quedar con un card corto y espacio muerto debajo. Esto
   resuelve el punto 2 (Egresos ya no compite por 1/3 de ancho, tiene el mismo ancho de columna
   que Ingresos) y el punto 1 en la columna derecha.

**Re-validación técnica:**
- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, 171 warnings (idéntico al baseline; sin regresiones nuevas).
- `npx vitest run` (specs de cuadratura) → 66/67 passed, 1 failed (el mismo preexistente y no
  relacionado, `secretaria-contabilidad-cuadratura.component.spec.ts` → `openIngresoDrawer is
  not a function`).
- `/verify` (Playwright MCP, admin + secretaria, 1280×800 y 390×844): documento no scrollea en
  desktop (`documentScrolls: false`), ambas columnas llenan el alto sin espacio muerto, toggle
  de arqueo funciona con aislamiento de click confirmado, Drawer sigue abriendo con el mismo
  estado, mobile apila correctamente con scroll nativo, consola sin errores/warnings en ambos
  roles.

**Veredicto de la segunda iteración:** ✅ PASA — pendiente únicamente el visto bueno final del
usuario antes de cerrar el track.

---

## Tercera iteración (2026-08-25) — rediseño desde cero del body, sin 2 columnas

El usuario probó el render de la 2ª iteración con una captura y rechazó el resultado
explícitamente: "Arqueo y Cierre Operativo" seguía ocupando demasiado espacio (una columna
entera casi vacía), el header de la tabla de Ingresos (N° Boleta/Glosa/Efectivo/...) se veía
"movido" junto con el contenido vacío, y pidió explícitamente **no dividir la pantalla en
mitad Ingresos / mitad Egresos**. Se resolvió con 2 preguntas de confirmación
(`AskUserQuestion`) antes de tocar código, dado que era una decisión de diseño real, no
derivable del feedback textual solo:

1. **"Arqueo y Cierre Operativo" deja de ser un card en el body — pasa a botón del Hero.**
   Confirmado por el usuario: "Botón pequeño en el Hero (junto a Cerrar Caja)". Se agregó
   `heroActions` id `ver-arqueo` (ícono `wallet`, no-primary) entre "Exportar" y "Cerrar Caja";
   `onHeroAction('ver-arqueo')` emite el mismo `abrirArqueo` de antes — el Drawer
   (`ArqueoCierreDrawerComponent`) no cambió. El toggle "Realizar arqueo físico" que vivía en el
   card del body (2ª iteración) se retiró junto con el card — vive solo dentro del Drawer, sin
   duplicar UI. El output `toggleArqueo` (agregado en la 2ª iteración) se eliminó del Dumb y de
   ambos Smart wrappers al quedar sin consumidor.
2. **Layout general: una sola columna, ancho completo.** Confirmado: "Una sola columna, ancho
   completo (recomendado)". Se eliminó por completo `.cuadratura-columns`/`.cuadratura-col--left`/
   `--right`/`.cuadratura-col-scroll` (ya no hay switch por `@container` para 2 columnas — no
   aplica, no hay 2 columnas). Ingresos es el protagonista (`flex: 3 1 0%`), Egresos queda debajo
   más compacto (`flex: 2 1 0%`), ambos dentro de un único wrapper `.cuadratura-stack`.
3. **Header de la tabla de Ingresos ya no scrollea junto a las filas.** Feedback explícito: "no
   debería moverse con el app-like, solo moverse los datos que están abajo". Se sacó el header
   de columnas (N° Boleta/Glosa/Efectivo/Transf./Voucher/Tarjeta/Total) del contenedor
   `overflow-y-auto` a un wrapper `shrink-0` hermano por encima — ahora solo las filas
   (skeleton/vacío/datos) scrollean internamente, el header queda fijo.

**Bug de template introducido y auto-corregido durante la implementación:** al remover la
estructura de 2 columnas quedó un `</div>` huérfano (el que cerraba la columna izquierda ya
eliminada) — Angular lo reportó en build (`NG5002: Unexpected closing tag "div"`, línea exacta
señalada por el compilador). Corregido de inmediato releyendo el archivo y quitando la etiqueta
sobrante; no llegó a `/verify`.

**Re-validación técnica:**
- `ng build --configuration development` → compila sin errores (tras corregir el `</div>`
  huérfano).
- `npm run lint:arch` → 0 errores, mismos 171 warnings del baseline (sin regresiones nuevas).
- `npx vitest run` (specs de cuadratura) → 66/67 passed, 1 failed (el mismo preexistente y no
  relacionado).
- `/verify` (Playwright MCP, admin, 1280×800 y 390×844): botón "Arqueo y Cierre" visible en el
  Hero entre "Exportar" y "Cerrar Caja", clic real abre el Drawer con el mismo contenido de
  siempre (Fondo de Apertura, resumen, toggle, contador), Drawer cierra con "Listo", documento
  no scrollea en desktop (`documentScrolls: false`), Ingresos ocupa más alto que Egresos (3:2),
  mobile apila con Hero de 3 acciones + botón Arqueo, consola sin errores.

**Veredicto de la tercera iteración:** ✅ PASA — pendiente el visto bueno final del usuario
antes de cerrar el track.

---

## Cuarta iteración (2026-08-25) — Drawer de Arqueo demasiado ancho

El usuario probó el Drawer de la 3ª iteración a una resolución más ancha (~1700px) y reportó
que seguía "haciendo ver mal" a Ingresos/Egresos: el Drawer usa el ancho por defecto de
`LayoutDrawerComponent` (45% del viewport, sin tope superior salvo el mínimo de 400px) — a esa
resolución eso son ~767px, casi la mitad de la pantalla, para un formulario que no lo necesita.

**Decisión:** en vez de un hack local (CSS `max-width` sobre el contenido, que no puede angostar
el host `drawerEl` que anima GSAP), se agregó soporte de **ancho configurable por Drawer** en la
infraestructura compartida — cambio quirúrgico y retrocompatible:
- `LayoutDrawerState.width?: number` (nuevo campo opcional).
- `LayoutDrawerService.open()` y `LayoutDrawerFacadeService.open()` ganan un 5º parámetro
  opcional `width?: number`.
- `GsapAnimationsService.animateLayoutDrawerEnter()` gana un 3er parámetro opcional
  `widthOverride?: number`; si no se pasa, mantiene exactamente el comportamiento anterior
  (`Math.max(400, innerWidth * 0.45)`) — **cero impacto en los ~40 drawers existentes** que no
  pasan este parámetro (confirmado visualmente: el drawer "Registrar Ingreso" de la misma
  página se probó después y sigue con su ancho de siempre).
- Ambos wrappers (`admin`/`secretaria`) pasan `440` al abrir `ArqueoCierreDrawerComponent`
  — suficiente para el formulario completo (fondo, resumen, toggle, contador de billetes/monedas
  activo) sin comprimir el body de fondo.

**Test corregido:** `layout-drawer.facade.service.spec.ts` esperaba la firma vieja de 4
argumentos en el spy — actualizado a 5 (`undefined` para `width` en la llamada sin ese
parámetro).

**Re-validación técnica:**
- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, mismos 171 warnings del baseline.
- `npx vitest run` (layout-drawer + cuadratura) → todos verdes salvo el mismo fallo preexistente
  no relacionado (`secretaria-contabilidad-cuadratura.component.spec.ts`).
- `/verify` (Playwright MCP, admin, 1706×938 — misma resolución que reportó el usuario): Drawer
  de Arqueo abre a 440px fijos (antes ~767px), background de Ingresos/Egresos visiblemente más
  ancho y sin comprimirse; activado el toggle de arqueo físico, el contador de billetes/monedas
  completo (5 billetes + monedas visibles) cabe cómodo dentro de esos 440px con scroll interno
  propio, sin afectar el grid de fondo (AC3 se sigue cumpliendo). Confirmado por separado que el
  drawer "Registrar Ingreso" (otro consumidor de la misma infraestructura, sin `width` pasado)
  sigue renderizando a su ancho default de siempre. Consola sin errores.

**Veredicto de la cuarta iteración:** ✅ PASA — pendiente el visto bueno final del usuario antes
de cerrar el track.

---

## Quinta iteración (2026-08-25) — bug real: Egresos anidado dentro de Ingresos

El usuario reportó, con captura, que "de normal" (sin el Drawer abierto) el layout se veía mal:
Ingresos aparecía diminuto y Egresos "como si estuviera sobrepuesto" encima de Ingresos.

**Root cause encontrado por inspección DOM en vivo (`getBoundingClientRect` + `parentElement`),
no por lectura de código:** el wrapper `<div class="flex flex-col flex-1 min-h-0">` que envuelve
la tabla de Ingresos (agregado en la 3ª iteración para separar el header fijo de las filas con
scroll) **nunca se cerraba** antes del footer "Total Día" — arrastre de la cirugía de divs de esa
misma iteración. Efecto: el card de Egresos completo terminaba renderizado **como hijo del card
de Ingresos**, no como hermano. Con `flex: 3 1 0%` / `flex: 2 1 0%` aplicados sobre elementos que
ya no eran hermanos del mismo flex container, el navegador calculaba alturas sin relación real
entre ellos — de ahí el solape visual exacto que describió el usuario. Verificado con
`ingresos.parentElement === egresos.parentElement` → `false` antes del fix, `true` después.

Confirmado además que `ng build` **no** detectó este bug (a diferencia del `</div>` huérfano de
la 3ª iteración): un div faltante no rompe el balance de etiquetas si sobra uno en otro lado del
archivo — sólo se hizo visible al inspeccionar el DOM renderizado. Lección para este archivo:
tras cualquier cirugía de `Edit` sobre bloques de `<div>` anidados, verificar con
`getBoundingClientRect()`/`parentElement` en vivo, no asumir que "compila" implica "balanceado
donde importa".

**Fix:** se cerró el wrapper (`</div>` agregado antes del comentario "Footer total Ingresos"),
lo que dejó un `</div>` sobrante al final del template (mismo patrón que la 3ª iteración) —
también eliminado.

**Re-validación técnica:**
- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, mismos 171 warnings del baseline.
- `npx vitest run` (cuadratura) → todos verdes salvo el mismo fallo preexistente no relacionado.
- `/verify` (Playwright MCP, admin, 1706×938 — misma resolución reportada por el usuario):
  confirmado por inspección de DOM que Ingresos y Egresos son hermanos reales dentro de
  `.cuadratura-stack` (`sameParent: true`), con alturas proporcionales correctas (Ingresos
  379.7px / Egresos 267.3px, ratio 3:2 tal como especifica el CSS) y **sin superposición**
  (Ingresos termina en y=564, Egresos empieza en y=588). Confirmado visualmente en captura:
  Ingresos es el protagonista claro, Egresos queda debajo con su propio espacio, sin solape.
  Mobile (390×844) también verificado: cards apiladas correctamente, sin el bug (que solo
  afectaba el flujo flex de desktop).

**Veredicto de la quinta iteración:** ✅ PASA — bug real corregido y verificado. Pendiente el
visto bueno final del usuario antes de cerrar el track.

---

## Sexta iteración (2026-08-25) — consistencia visual: empty states y botón Agregar Egreso

El usuario pidió, en el mismo turno del bug de anidación, 2 ajustes de pulido visual:

1. **Empty states inconsistentes entre Ingresos y Egresos.** Ingresos tenía un empty state
   hecho a mano (ícono en caja redondeada + título + subtítulo, usando `item-title` suelto) y
   Egresos solo un párrafo de texto muted — dos estilos distintos para el mismo tipo de estado.
   Se detectó que el proyecto ya tiene `app-empty-state` (`shared/components/empty-state/`,
   documentado en `indices/COMPONENTS.md`) para este caso exacto y **no se estaba usando** en
   ninguno de los dos. Se migraron ambos a `<app-empty-state message="..." />`. Primer intento
   con `icon` + `subtitle` (replicando el estilo original de Ingresos) causó overflow visible en
   Egresos — el bloque ícono(64px)+título+subtítulo no entra en los ~107px de contenido
   disponible en esa card (más baja por el ratio `flex: 3 1 0%` / `flex: 2 1 0%` de la 3ª
   iteración). Se simplificó a solo `message` (sin ícono ni subtítulo) para que ambos quepan
   cómodos sin scroll interno en la altura mínima real de la página.
2. **Botón "Agregar Egreso" con color distinto al de "Agregar Ingreso".** Causa encontrada en el
   código: "Agregar Ingreso" tenía `[style.opacity]="cajaYaCerrada() ? '0.5' : '1'"` además de
   `[disabled]`, pero "Agregar Egreso" solo tenía `[disabled]` — con la caja cerrada, Ingreso se
   atenuaba a un azul semitransparente mientras Egreso caía al estilo `:disabled` por defecto del
   navegador (gris). Agregado el mismo binding de opacidad a "Agregar Egreso".

**Re-validación técnica:**
- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, mismos 171 warnings del baseline.
- `npx vitest run` (cuadratura-content + wrappers admin/secretaria) → todos verdes salvo el
  mismo fallo preexistente no relacionado.
- `/verify` (Playwright MCP, admin, 1706×938): ambos empty states ahora usan el mismo componente
  y el mismo mensaje de una línea ("No hay ingresos/egresos registrados hoy."), visualmente
  consistentes; confirmado con `getBoundingClientRect` que el texto de Egresos ya no queda
  oculto/cortado (cabe dentro del área visible, con scroll interno disponible como red de
  seguridad si el card se angosta más en pantallas menores). Botón "Agregar Egreso" confirmado
  con el mismo binding `[style.opacity]` que "Agregar Ingreso" (`opacity: 1` en ambos con caja
  abierta). Consola sin errores.

**Veredicto de la sexta iteración:** ✅ PASA. Pendiente el visto bueno final del usuario antes de
cerrar el track.

---

## Séptima iteración (2026-08-25) — confirmación antes de Cerrar Caja

El usuario pidió una advertencia de confirmación ("¿Estás seguro? Esto es irreversible") antes de
ejecutar "Cerrar Caja", ya reubicado en el Hero desde la 3ª iteración.

**Implementación:** se reutilizó `ConfirmModalService` (`core/services/ui/confirm-modal.service.ts`),
ya inyectado en ambos Smart wrappers y usado con el mismo patrón para "Eliminar ingreso"/"Eliminar
egreso" — no se introdujo infraestructura nueva. `onCerrarCaja()` en ambos wrappers
(`admin-contabilidad-cuadratura.component.ts` y `secretaria-contabilidad-cuadratura.component.ts`)
ahora llama `confirmModal.confirm({ title: 'Cerrar Caja', message: 'Una vez cerrada, la caja de
hoy queda bloqueada y no se puede deshacer.', severity: 'danger', confirmLabel: 'Cerrar Caja',
cancelLabel: 'Cancelar' })` antes de invocar `facade.cerrarCaja()` — si el usuario cancela, no se
llama al Facade (mismo guard `if (!confirmed) return;` que las otras confirmaciones de esta
página).

**Re-validación técnica:**
- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, mismos 171 warnings del baseline.
- `npx vitest run` (wrappers admin/secretaria) → todos verdes salvo el mismo fallo preexistente
  no relacionado.
- `/verify` (Playwright MCP, admin, 1280×800): clic en "Cerrar Caja" abre el modal de
  confirmación con severidad `danger` (ícono de alerta rojo, botón "Cerrar Caja" en rojo,
  "Cancelar" neutro) — mismo componente visual que ya usan "Eliminar ingreso"/"Eliminar egreso"
  en esta misma página, consistente con el resto de la app. "Cancelar" cierra el modal sin
  ejecutar el cierre. Consola sin errores.

**Veredicto de la séptima iteración:** ✅ PASA. Pendiente el visto bueno final del usuario antes
de cerrar el track.
