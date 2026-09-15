# Fix: Vista Secretarias (admin) — espacio vacío a la derecha y descuadre de alto

> id: fix-247-m-secretarias-layout-espacio-vacio
> refs: ASG-m-006 (specs/assignments/ASG-m-006-fix-visual-vista-secretarias-admin.md)
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Root Cause

[Heredado de ASG-m-006, confirmado visualmente por el owner]: la vista
`AdminSecretariasComponent` (`src/app/features/admin/secretarias/admin-secretarias.component.ts`)
tiene dos celdas hijas del `.bento-grid--fill-screen`:

- **Lista de Personal** — `class="bento-wide bento-fill" data-col-span="9" data-col-span-md="8"`
- **Panel de Control** — `class="bento-tall bento-fill" data-col-span="3" data-col-span-md="8"`

Dos bugs de layout distintos, ambos originados en el mismo choque de capas CSS:

1. **Ancho — espacio vacío a la derecha.** `.bento-wide` fija por defecto (capa
   `bento.proportions`) `grid-column: span 6` en `lg`. El atributo `data-col-span="9"` vive en la
   capa `bento.placement` (declarada después → gana por orden de capa, no por especificidad) pero
   solo escribe `grid-column-end: span 9` — nunca toca `grid-column-start`. El resultado neto es
   `grid-column-start: span 6` (de proportions) combinado con `grid-column-end: span 9` (de
   placement): el navegador NO resuelve esto como "9 columnas", sino como un span efectivo menor.
   Auto-placement coloca a "Panel de Control" (span 3 sin conflicto, porque su valor por defecto
   ya coincide con el override) justo después, dejando ~3 columnas de 12 sin ocupar a la derecha
   — la franja gris vacía reportada en la captura de la reunión.
2. **Alto — Panel de Control más alto que Lista de Personal.** `.bento-tall` fija
   `grid-row: span 2` por defecto (para grids con múltiples filas auto-generadas). Pero
   `bento-grid--fill-screen` define solo 2 filas explícitas (`auto minmax(0, 1fr)`): fila 1 =
   hero, fila 2 = el contenido. Al pedir 2 filas, "Panel de Control" se extiende a una fila
   implícita extra (vía `grid-auto-rows`), quedando más alto que "Lista de Personal" (que sí
   respeta 1 fila) — la app-like feature de `.bento-fill` (`contain: size`) hace que cada celda
   se estire a la altura de SU área de grid, así que la discrepancia de filas se traduce
   directamente en alturas de card distintas.

Este patrón de "clase de proporción con default que no coincide con el `data-col-span` override"
no tenía precedente en el resto del código: es el único lugar del repo que usa
`data-col-span="9"` — por eso el bug pasó desapercibido hasta ahora, en vez de ser un problema
sistémico del sistema Bento Grid.

**Encontrado durante `/verify` (no en la lectura inicial del código):** el mismo choque de capas
ocurre también en `md` (tablet, 768-1023px). `data-col-span-md="8"` en ambas celdas solo
sobreescribe `grid-column-end`, dejando `grid-column-start` en `span 4` (Lista, heredado de
`.bento-wide` a nivel `sm`) y `span 2` (Panel, heredado de `.bento-tall` a nivel `sm`) — medido
con `getBoundingClientRect()` a 768px: Lista 329px de ancho / 731px de alto, Panel 157px / 957px,
en vez de ocupar cada una el ancho completo apiladas. Mismo root cause, mismo archivo — se
extiende el `Cambio` de abajo para cubrir también `md`, en vez de abrir un fix aparte.

## ACs Afectados

Ninguna spec declaró ACs de layout para esta vista. ACs de regresión que este fix establece:

- **AC-1 — Sin espacio vacío horizontal en desktop (lg, 1280px):** "Lista de Personal" y "Panel
  de Control" ocupan juntas el 100% del ancho disponible del `.bento-grid` (9/12 + 3/12), sin
  franja gris a la derecha.
- **AC-2 — Alturas iguales (app-like):** ambas cards ocupan exactamente la misma altura, la del
  área de contenido completa (fila `minmax(0, 1fr)` del `--fill-screen`), igual que ya lo hacía
  "Panel de Control" — "Lista de Personal" debe estirarse hasta el mismo punto, con su scroll
  interno (`overflow-y-auto`) absorbiendo filas que no entren.
- **AC-3 — Sin regresión en tablet (md, 768px) ni mobile:** ambas cards siguen apilándose a ancho
  completo (comportamiento ya intencional vía `data-col-span-md="8"`), sin fila vacía extra entre
  ellas.
- **AC-4 — Sin regresión visual del resto de la vista:** hero, KPIs, filtros, tabla y panel de
  auditoría se ven igual que antes salvo el ajuste de alto/ancho corregido.

## Cambio

- **Archivo:** `src/app/features/admin/secretarias/admin-secretarias.component.ts`
  - Celda "Lista de Personal" (activa, línea ~102): agregar `data-col-start="1"` junto al
    `data-col-span="9"` existente — fija explícitamente `grid-column-start: 1`, neutralizando el
    `span 6` heredado de `.bento-wide` y dejando el span efectivo en 9 columnas reales.
  - Celda "Panel de Control" (activa, línea ~256): agregar `data-row-span="1"` junto al
    `data-col-span="3"` existente — neutraliza el `grid-row: span 2` heredado de `.bento-tall`,
    confinando la celda a la única fila de contenido del `--fill-screen`.
  - Lista de Personal: agregar también `data-col-start-md="1"` (activa y skeleton) — mismo
    mecanismo que `data-col-start`, aplicado al breakpoint `md`.
  - Panel de Control: agregar también `data-col-start-md="1"` y `data-row-span-md="1"` (activa y
    skeleton) — a `md` cada celda ocupa su propia fila completa (apiladas), así que Panel
    también necesita `grid-column-start: 1` explícito (su `span 2` heredado de `.bento-tall` a
    nivel `sm` lo dejaba angosto igual que a Lista).
  - **Segunda vuelta de `/verify`:** `data-col-start-md="1"` en Panel (arriba) usa un
    `@container (min-width: 768px)` — un mínimo, no un rango — así que también matcheaba a
    `lg` (1024px+) y pisaba (por orden de cascada, declarado después) el `data-col-start="1"`
    de Lista, dejando a AMBAS celdas en columna 1 y forzando al navegador a apilarlas en filas
    distintas por auto-placement denso (regresión de AC-1/AC-2 detectada al re-medir con
    `getBoundingClientRect()`, NO visible con solo leer el código). Fix: agregar
    `data-col-start="10"` a Panel (activa y skeleton) — al vivir en el bloque `@container
    layoutmain (min-width: 1024px)`, declarado después en `_bento-grid.scss`, gana en `lg` sobre
    el `data-col-start-md="1"` sin afectar su comportamiento en `md`.
  - Mismo par de atributos en el bloque de **skeleton** (líneas ~62 y ~89) para que el estado de
    carga no produzca un salto de layout (CLS) al llegar los datos reales.
  - No cambia lógica, Facade, ni contratos públicos — es puramente placement CSS vía
    data-attributes ya soportados por `_bento-grid.scss` (`bento.placement`).

## Test de Regresión — resultados

- `/verify` (Playwright) en **1280×800**: `getBoundingClientRect()` — Lista de Personal
  673×476px, Panel de Control 211×476px (mismo `top`, misma altura), `colStart`/`colEnd`
  computados: Lista `1 / span 9`, Panel `10 / span 3` — 9+3=12, sin franja vacía.
  `gridTemplateRows` = `120px 476px` (2 filas, como espera `--fill-screen`).
  `documentScrolls === false`. Captura confirma visualmente ambas cards a la misma altura, sin
  espacio a la derecha.
- `/verify` en **768×1024 (md)**: ambas cards 674px de ancho (full-width), apiladas
  (`top` 228 y 694 respectivamente) — sin regresión, sin fila vacía entre ellas.
- `/verify` en **375×812 (mobile)**: apiladas a ancho completo, sin regresión visual.
- Consola: 0 errores, 0 warnings.
- `npm run lint:arch` — 0 errores (175 advertencias preexistentes, ninguna en este archivo).
- `npm run test:ci -- --run src/app/features/admin/secretarias` — **11/11 passed**, sin cambios
  de lógica que requirieran tests nuevos (solo placement CSS vía data-attributes).

**Nota de proceso:** la primera pasada del fix (solo `lg`) dejó una regresión sin detectar en
`md` (root cause idéntico, breakpoint distinto) y luego una regresión propia introducida al
corregir `md` (el `data-col-start-md="1"` de Panel se colaba a `lg` por ser un `min-width`, no
un rango) — ambas se encontraron y corrigieron dentro de esta misma sesión de `/verify`, nunca
a ciegas. Ver Root Cause arriba para el detalle de cada una.
