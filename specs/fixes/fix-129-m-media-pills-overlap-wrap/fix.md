# Fix: Texto de `.media-pill` se desborda sobre el pill vecino en contenedores angostos
> id: fix-129-m-media-pills-overlap-wrap
> refs: fix-128-m-hero-tab-fluid-grids
> status: done
> closed: 2026-08-06
> created: 2026-08-06

## Root Cause
El fix-128 agregó `min-width: 0` a `.media-pill` para permitir que el flex-item se encoja por
debajo de su contenido — correcto para evitar que el `.media-type-pills` fuerce overflow del
padre. Pero `<button>` tiene `overflow: visible` por defecto y el `<span>` de la etiqueta no
tiene ningún control de desborde: cuando el pill se angosta lo suficiente (ej. drawer abierto),
el texto ("Tema (Degradado)") envuelve a 2 líneas, y la segunda línea puede ser más ancha que el
propio pill — como nada la recorta, esa línea se pinta **encima** del pill vecino ("Color
Personalizado"), ilegible.

Confirmado visualmente por el dueño y reproducido con Playwright: con el drawer "Ajustes del
Sistema" abierto sobre `/admin/configuracion-web` → tab "Sección Hero" → sección "2. Fondo de la
Sección", el texto "(Degradado)" se superpone visualmente a "Personaliz" del pill contiguo.

## ACs Afectados

- AC-1: `.media-pill` recorta su contenido (`overflow: hidden`) — el texto ya no puede pintarse
  fuera de los límites del botón.
- AC-2: La etiqueta de texto de cada pill (`.media-pill-label`) trunca con ellipsis
  (`white-space: nowrap; text-overflow: ellipsis`) en vez de envolver a 2 líneas cuando no cabe.
- AC-3: Cada botón `.media-pill` gana un atributo `title` con el label completo, para que el
  texto truncado siga siendo descubrible via tooltip nativo del navegador.
- AC-4: Reproducir el escenario reportado (drawer abierto, sección "2. Fondo de la Sección") y
  confirmar visualmente que ya no hay superposición de texto entre pills.

## Cambio
- **Archivo:** `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts`
  - `.media-pill`: agrega `overflow: hidden`.
  - Nueva clase `.media-pill-label` (aplicada al `<span>` de texto en los 7 botones de pills):
    `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;`.
  - Los 7 `<button class="media-pill">` ganan `title="<label completo>"` (accesibilidad/tooltip
    cuando el label queda truncado).

## Test de Regresión
`/verify` (Playwright MCP): reproducir el drawer "Ajustes del Sistema" abierto sobre
`/admin/configuracion-web` → tab "Sección Hero" → scrollear a "2. Fondo de la Sección", captura
confirmando que "Tema (Degradado)" y "Color Personalizado" ya no se superponen (cada pill trunca
su propio texto sin invadir al vecino). Confirmar también sin drawer que no hay regresión visual.

**Ejecutado 2026-08-06 (Playwright MCP):** `npm run lint:arch`: 0 errores. Con el drawer "Ajustes
del Sistema" abierto: cada pill ahora trunca su propio texto con ellipsis ("Tema...", "Color...",
"Imagen", "Video...") sin invadir al vecino — altura de pill volvió a 32.5px (antes 49px por el
wrap a 2 líneas), `title` presente con el label completo en los 4+3 botones. Sin drawer en
1440×900 (studio-controls en 2 columnas): mismo truncado limpio, sin overlap, comportamiento
esperado dado el espacio disponible — no es regresión, es el mismo fix aplicándose consistente.
Consola: 0 errores en ambos casos.
