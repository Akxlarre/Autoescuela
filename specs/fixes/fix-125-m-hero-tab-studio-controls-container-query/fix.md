# Fix: `.studio-controls` de Hero Tab usa viewport en vez de contenedor — contenido oculto con drawer abierto
> id: fix-125-m-hero-tab-studio-controls-container-query
> refs: fix-124-m-app-like-configuracion-web
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
`hero-tab.component.ts` (`.studio-controls`, líneas ~832-846) usa `@media (min-width: 768px)` y
`@media (min-width: 1200px)` para pasar de 1 a 2 a 3 columnas — basados en el **viewport**, no en
el **contenedor** (`@container layoutmain`, el patrón canónico de todo el resto del bento-grid,
ver `.claude/rules/visual-system.md` § "Switch de layout por CONTENEDOR, NO por viewport").

Hallado durante QA visual de fix-124: con un drawer/modal abierto (ej. "Ajustes del Sistema")
angostando `<main>` a 534px, el viewport sigue ≥1200px, así que la media query mantiene forzadas
3 columnas (368px + 251px + 141px = 810px de `scrollWidth`) dentro de un contenedor de 326px de
`clientWidth`. El padre (`.bento-fill`/`.studio-card`) recorta el overflow, así que el contenido
no solo se desborda — **queda oculto** a la derecha, invisible para el usuario.

Reproducido con Playwright MCP: `/admin/configuracion-web` → tab "Sección Hero" → abrir "Ajustes
del Sistema" (drawer lateral) → la tarjeta "Texto Izq / Media Der" y el resto de `.studio-controls`
quedan cortados/ocultos.

## ACs Afectados

- AC-1: `.studio-controls` usa `@container layoutmain` en vez de `@media (min-width)` para sus 3
  breakpoints de columnas (1 → 2 → 3), con los mismos umbrales `$bp-md` (768px) / `$bp-lg`... o
  el equivalente en px directo ya que este archivo no importa el `_bento-grid.scss` (usar 768px /
  1200px literales, mismo valor que hoy, solo cambiando `@media` por `@container layoutmain`).
- AC-2: Con el drawer "Ajustes del Sistema" abierto sobre `/admin/configuracion-web` en la tab
  "Sección Hero", ningún contenido de `.studio-controls` queda oculto — el grid reduce a 1 o 2
  columnas según el ancho real disponible del contenedor.
- AC-3: Sin drawer abierto, en 1440×900 la página sigue sin overflow ni contenido oculto. **Nota
  al verificar:** el layout de 3 columnas puede pasar a 2 en este viewport — el `<main>` real
  (descontando sidebar) mide ~1190px, 10px por debajo del breakpoint de 1200px. Con `@media` esto
  se disparaba igual porque medía el *viewport* (1440px ≥ 1200px), no el contenedor real; con
  `@container` mide el ancho real y es más correcto, aunque cambia el punto exacto del quiebre.
  No es una regresión: es la causa raíz corregida también en el caso sin drawer.

## Cambio
- **Archivo:** `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts`
  - `.studio-controls`: `@media (min-width: 768px)` → `@container layoutmain (min-width: 768px)`.
  - `.studio-controls`: `@media (min-width: 1200px)` → `@container layoutmain (min-width: 1200px)`.
  - Nota: `@container` requiere que un ancestro declare `container-type: inline-size;
    container-name: layoutmain;` — ya lo hace `<main>` (ver `_bento-grid.README.md`), así que no
    se necesita registrar el contenedor de nuevo.

## Test de Regresión
`/verify` (Playwright MCP) — reproducir el escenario exacto del bug: admin, sede seleccionada,
tab "Sección Hero", abrir drawer "Ajustes del Sistema", confirmar con `browser_evaluate` que
`studioControls.scrollWidth <= studioControls.clientWidth` (o que el grid bajó a 1 columna sin
overflow), y verificar visualmente que ningún card queda oculto.

**Ejecutado 2026-08-06 (Playwright MCP):** con el drawer "Ajustes del Sistema" abierto (`<main>`
a 536px), `.studio-controls` bajó de 3 columnas forzadas (810px `scrollWidth` / 326px
`clientWidth`, contenido oculto) a 1 columna (368px / 328px) — captura confirma "Texto Izq / Media
Der" y el resto de las cards visibles completas, sin recorte. Sin drawer, en 1440×900, el grid
pasó de 3 a 2 columnas (`936px / 936px`, sin overflow) por la razón explicada en AC-3 — verificado
visualmente, se ve correcto y sin overflow. `npm run lint:arch`: 0 errores. Consola: 0 errores.
