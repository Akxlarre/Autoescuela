# fix-040-m — Relatores: layout app-like + iniciales de avatar incorrectas

## Contexto

El dueño reportó dos problemas en `admin-profesional-relatores` (vista
"Relatores"):

1. **No es app-like.** La lista de relatores se corta al cargar la página
   y hay que scrollear el documento para ver el resto — no sigue el patrón
   fill-screen documentado en `.claude/rules/visual-system.md` (specs
   0028-0031), donde el shell ocupa 100vh en desktop y el overflow se
   resuelve con scroll interno del panel, no del documento.
2. **Bug de iniciales del avatar.** En `RelatoresFacade.mapToRow()`
   (`core/facades/relatores.facade.ts`), las iniciales se calculaban
   tomando la primera y la última palabra del nombre completo
   (`first_names + paternal_last_name + maternal_last_name`). Como el
   nombre completo casi siempre incluye apellido materno, la "última
   palabra" resultaba ser el apellido **materno**, no el paterno. Debe ser
   siempre primer nombre + apellido paterno.

## Alcance

- `admin-profesional-relatores.component.ts`: aplicar patrón app-like
  (shell fill-screen + `.bento-fill` con scroll interno en la celda de la
  lista, densidad no aplica paginación en desktop sino scroll).
- `relatores.facade.ts`: corregir `mapToRow()` para derivar `initials`
  directamente de `first_names` + `paternal_last_name`, ignorando
  `maternal_last_name`.

## Acceptance Criteria

- [x] AC0: En viewport desktop (lg+), la página de Relatores no requiere
  scroll del documento para ver hero + KPIs + la lista completa (con
  scroll interno dentro de la celda de lista si hay más relatores de los
  que caben).
- [x] AC1: En mobile, la página conserva scroll nativo normal (no rompe
  el layout existente).
- [x] AC2: Las iniciales del avatar de cada relator son primer nombre +
  apellido paterno (nunca apellido materno).
- [x] AC3: `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.

## Cierre

- Grid raíz pasa a `.bento-grid--fill-screen` (hero ya trae los KPIs
  embebidos, solo hace falta 1 fila fill para la lista → coincide con el
  patrón de 2 filas `auto minmax(0,1fr)`).
- La celda `.bento-banner` recibe `.bento-fill` + `flex flex-col min-h-0`;
  el `.card` interno pasa a `h-full min-h-0 overflow-hidden`, con el header
  de filtros `shrink-0` y el bloque de contenido (grid de tarjetas +
  paginación) en `flex-1 min-h-0 overflow-y-auto`. Bajo `lg` el modificador
  `.bento-fill` no aplica `contain:size` (gate por `@container` ya
  existente en `_bento-grid.scss`), por lo que mobile conserva scroll
  nativo sin cambios.
- `RelatoresFacade.mapToRow()`: `initials` ahora se deriva directo de
  `first_names[0] + paternal_last_name[0]`, sin pasar por el nombre
  completo combinado (que incluía el apellido materno como "última
  palabra").
- Test de regresión agregado en `relatores.facade.spec.ts` (mock de
  `initialize()` con apellido materno distinto al paterno) — verifica que
  `initials` sea `first_names[0] + paternal_last_name[0]`. `npx vitest run
  src/app/core/facades/relatores.facade.spec.ts` → 4/4 verde.
- `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.
- Ajuste post-cierre pedido por el dueño: `pageSize` de 9 → 6 relatores por
  página, para que con la grilla de 3 columnas (2 filas completas) la
  página quepa sin activar el scroll interno de la card en el caso normal.
- Segundo ajuste post-cierre: con 6 relatores seguía apareciendo scroll
  interno en la card (capturas del dueño mostraban un thumb de scrollbar
  visible). Se tensó la densidad vertical del panel de lista para ganar
  altura sin volver a bajar `pageSize`:
  - Header de filtros: `lg:py-4`→`lg:py-3`, `gap-4`→`gap-3`.
  - Wrapper de contenido: `p-6`→`p-4 lg:p-5`.
  - Nueva clase local `.relator-list-grid` (gap `var(--space-3)`, 12px)
    aplicada al grid de tarjetas (loading y real), en vez del gap por
    defecto de `.bento-grid` (`var(--space-5)`, 20px a lg+).
  - Cada `relator-card`: `p-4`→`p-3`, badge de estado `top-4 right-4`→
    `top-3 right-3`, márgenes internos `mb-4`→`mb-3` (avatar y chips),
    footer `pt-3`→`pt-2`.
  - Footer de paginación: `mt-6 pt-6`→`mt-3 pt-3`.
  - `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.
- Tercer ajuste post-cierre: capturas del dueño mostraban que aun con
  6/página seguía apareciendo un thumb de scroll dentro de la card. Se
  tensó aún más la densidad vertical (sin volver a bajar `pageSize`):
  - Header de filtros: `lg:py-3`→`lg:py-2`, `gap-3`→`gap-2`,
    padding base `p-4`→`p-3`.
  - Wrapper de contenido: `p-4 lg:p-5`→`p-3 lg:p-4`.
  - `.relator-list-grid` gap: `var(--space-3)` (12px)→`var(--space-2)` (8px).
  - Cada `relator-card`: `p-3`→`p-2.5`, badge de estado `top-3 right-3`→
    `top-2.5 right-2.5`, avatar `w-10 h-10`→`w-9 h-9`, márgenes internos
    `mb-3`→`mb-2` (avatar y chips), footer `pt-2`→`pt-1.5`.
  - Botones de acción (`.action-btn`): `32px`→`28px`.
  - Footer de paginación: `mt-3 pt-3`→`mt-2 pt-2`.
  - `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.
- Cuarto ajuste post-cierre: con el tercer ajuste, la captura del dueño
  mostró que ya cabía **con margen de sobra** (espacio en blanco visible
  debajo de la paginación, dentro de la card) — pero las tarjetas se veían
  demasiado apretadas entre sí. Se restauró la respiración visual
  aprovechando ese margen, sin volver a bajar `pageSize` ni reintroducir el
  scroll:
  - Header de filtros: `lg:py-2`→`lg:py-3`, `gap-2`→`gap-3`,
    padding base `p-3`→`p-4`.
  - Wrapper de contenido: `p-3 lg:p-4`→`p-4 lg:p-5`.
  - `.relator-list-grid` gap: `var(--space-2)` (8px)→`var(--space-4)` (16px).
  - Cada `relator-card`: `p-2.5`→`p-3.5`, badge de estado `top-2.5 right-2.5`→
    `top-3.5 right-3.5`, avatar `w-9 h-9`→`w-10 h-10`, márgenes internos
    `mb-2`→`mb-3` (avatar y chips), footer `pt-1.5`→`pt-2.5`.
  - Botones de acción (`.action-btn`): `28px`→`32px`.
  - Footer de paginación: `mt-2 pt-2`→`mt-4 pt-4`.
  - `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.
- Quinto ajuste post-cierre: el cuarto ajuste volvió a desbordar (captura
  del dueño: paginación totalmente oculta, peor que antes). Cuatro rondas
  de ida y vuelta ajustando padding/gap a ciegas (sin Playwright activo en
  esta máquina, ver [[project_test_baseline_jun2026]]) confirman que el
  presupuesto de píxeles es demasiado frágil para adivinarlo. Se reemplazó
  el enfoque por uno robusto: en vez de fijar alturas de tarjeta por
  padding, las 2 filas del grid de tarjetas ahora se reparten el alto
  disponible automáticamente.
  - `.relator-list-grid`: se agregó `grid-auto-rows: 1fr` + clase `h-full`
    en el contenedor real (no en el skeleton de loading). Con el
    contenedor acotado por `flex-1 min-h-0 overflow-y-auto` del panel
    padre, las 2 filas de tarjetas siempre se reparten exactamente el alto
    visible (nunca menos que el contenido mínimo de una card, por eso no
    hay riesgo de recorte) — si sobra alto, se reparte como aire extra
    entre las tarjetas y su contenido en vez de quedar como espacio muerto
    debajo de la paginación.
  - Cada `relator-card` pasa a `flex flex-col` y su footer usa `pt-2
    mt-auto`, de modo que si la fila crece más que el contenido mínimo, el
    espacio extra empuja el footer hacia abajo (WhatsApp + acciones) en
    vez de dejar hueco entre los chips de especialidad y el footer.
  - Esto hace que el layout sea correcto para cualquier alto de viewport
    razonable sin volver a tocar números de padding a mano.
  - `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.
- Sexto ajuste post-cierre (causa raíz real del "sigue con scroll"): el
  quinto ajuste (`h-full` en el grid) seguía desbordando porque el
  contenedor `.p-4 lg:p-5 flex-1 min-h-0 overflow-y-auto` **no era flex**
  — sus hijos (grid + paginación) se apilaban en flujo normal (block). Al
  ponerle `h-full` al grid, este reclamaba el 100% del alto del
  contenedor **por sí solo**, y la paginación se agregaba *después*,
  desbordando exactamente su propio alto (por eso en la última captura la
  paginación quedaba completamente oculta, no solo parcialmente). `h-full`
  sobre un porcentaje de un contenedor con más de un hijo en flujo normal
  no "resta" el espacio de los hermanos — por eso no bastaba con
  `grid-auto-rows: 1fr` si el contenedor padre no repartía el espacio
  correctamente entre el grid y la paginación.
  - Fix real: el wrapper de contenido pasa a `flex flex-col` (antes solo
    `flex-1 min-h-0 overflow-y-auto`, sin ser él mismo un contenedor flex).
  - El grid real de tarjetas cambia `h-full` → `flex-1 min-h-0` (ahora sí
    es un ítem flex que recibe "el alto sobrante después de la
    paginación", en vez de reclamar el 100% del contenedor a ciegas).
  - La paginación se marca `shrink-0` para que nunca se comprima y el
    grid absorba correctamente el resto del espacio.
  - Con esto, `grid-auto-rows: 1fr` dentro del grid (ya `flex-1 min-h-0`)
    reparte el alto realmente disponible entre las 2 filas de tarjetas,
    sin desbordar nunca a costa de la paginación.
  - `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos.
- Séptimo ajuste post-cierre (causa raíz real del layout roto — captura
  del dueño mostraba las tarjetas ocupando solo ~2/3 del ancho del panel,
  con un hueco en blanco a la derecha, y el badge de estado encimado sobre
  el nombre): la clase global `.bento-grid` (`_bento-grid.scss`) trae por
  diseño `height: fit-content` y `align-self: start`, pensados para cuando
  el grid actúa como **celda de OTRO grid** (para que no se estire y
  reparta espacio vacío). Al anidar `relator-list-grid` dentro de un
  `flex flex-col` (cambio del sexto ajuste), esas dos propiedades:
  - `height: fit-content` anulaba silenciosamente el `flex-1` de alto —
    por eso `grid-auto-rows: 1fr` nunca repartió espacio real en los
    ajustes anteriores.
  - `align-self: start` (que en un flex-column controla el eje
    transversal = ancho) hacía que el grid solo ocupara el ancho de su
    contenido en vez de estirarse al 100% del panel — de ahí el hueco en
    blanco a la derecha, y las tarjetas más angostas empujaban el nombre
    contra el badge de estado.
  - Fix: `.relator-list-grid` ahora sobreescribe explícitamente
    `height: auto` y `align-self: stretch`, devolviendo el comportamiento
    normal de un ítem flex (se estira en ambos ejes) sin tocar la clase
    global `.bento-grid` (que sigue sirviendo bien a sus demás usos como
    celda de grid).
  - `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos. `npx
    vitest run src/app/core/facades/relatores.facade.spec.ts` → 4/4 verde.
- Octavo ajuste post-cierre (rediseño pedido explícitamente por el dueño):
  tras siete rondas ajustando el grid de tarjetas bento, el dueño pidió
  abandonar ese formato y copiar el patrón de "Base Alumnos B"
  (`admin-alumnos` → `AlumnosListContentComponent`), que ya resuelve el
  fill-screen de forma robusta usando `p-table` de PrimeNG con
  `scrollHeight="flex"` (PrimeNG calcula el alto disponible internamente,
  sin necesidad de trucos de CSS/flex/grid propios).
  - `admin-profesional-relatores.component.ts` se reescribió por completo:
    se eliminó el grid de tarjetas bento (`relator-list-grid`,
    `.relator-card`, paginación manual con `currentPage`/`pageSize`) y se
    reemplazó por un `<p-table>` con columnas Relator (avatar+nombre+rut),
    Especialidades (badges), WhatsApp, Estado (`p-tag`) y Acciones
    (`pButton` ver/editar), paginador nativo (`[rows]="10"
    [paginator]="true"`), `scrollHeight="flex"` y `emptymessage` vía
    `<app-empty-state>`.
  - Nuevos imports PrimeNG: `TableModule`, `TagModule`, `ButtonModule`,
    `TooltipModule` (además de `SelectModule` que ya estaba). Se agregó
    `EmptyStateComponent` (shared) para el estado vacío, reemplazando el
    bloque de "no encontrados" hecho a mano.
  - El shell raíz sigue siendo `.bento-grid.bento-grid--fill-screen` +
    `.bento-banner.bento-fill` (igual que en `admin-alumnos`), pero ya no
    hay `grid-auto-rows`, `flex-1`/`h-full` manuales en el contenido —
    `p-table[scrollHeight="flex"]` resuelve el alto internamente dentro
    del `.bento-fill`.
  - No se replicó el "dual-viewport" (vista de tarjetas en mobile/squeeze)
    de `AlumnosListContentComponent` — fuera de alcance de este fix, no
    pedido explícitamente; en mobile/squeeze la tabla actual solo scrollea
    horizontalmente. Queda como posible follow-up si el dueño lo pide.
  - `relatores.facade.ts` (iniciales) no se tocó en este ajuste — el fix
    del apellido paterno/materno sigue vigente e intacto.
  - `npx tsc --noEmit -p tsconfig.app.json` sin errores nuevos. `npx
    vitest run src/app/core/facades/relatores.facade.spec.ts` → 4/4 verde.
