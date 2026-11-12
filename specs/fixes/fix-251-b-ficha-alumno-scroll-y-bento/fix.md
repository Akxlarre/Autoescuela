---
id: fix-251-b-ficha-alumno-scroll-y-bento
type: fix
status: done
author: b
created: 2026-11-11
closed: 2026-11-11
spec: 0006-i-app-like-alumno-detalle
---

# Fix: Scroll interno en Clases Prácticas, proporciones bento y paridad visual en Ficha del Alumno

## Síntoma reportado

En `/app/admin/alumnos/:id?enrollment=:id` (viewport ~`1354 × 907`, `<main>` ~`1106px`), la columna central (**Clases Prácticas**) recorta las clases `#6`–`#12` sin mostrar scrollbar ni permitir desplazar hacia abajo. Adicionalmente, los botones operativos de Columna 1 se truncan (`Ver Contra...`, `Generar C...`, `Inasistenc...`, `Ficha Técn...`), la card central carece de paridad de cabecera con **Estado Financiero**, y las clases `.ficha-3col-*` / `.ficha-pagos-*` / `.kpi-label` presentan deuda de responsividad y tokens.

## Causa raíz

1. **P1 (Scroll atrapado en Columna 2):** El wrapper externo de Columna 2 tiene `.ficha-3col-scroll` (`overflow-y: auto`), pero la card interna `.bento-card` combina `shrink-0` con `.ficha-3col-grow` (`flex-grow: 1; flex-basis: 0%; min-height: 0`). Eso fija la altura de `.bento-card` exactamente al alto de la fila (`634px`), por lo que el wrapper externo detecta `scrollHeight === clientHeight`, mientras `.bento-card { overflow: hidden }` recorta las clases que desbordan internamente (`1040px`). Además `content-center` sobre una grilla que desborda empuja los ítems por encima/debajo del área visible.
2. **P2 (Proporciones y tiles a ancho compacto de escritorio):** Columna 1 (`320px`) y Columna 3 (`340px`) fijas suman `660px` + `gaps`, dejando `~278px` internos en Columna 2 cuando `layoutmain = 1106px`, forzando `repeat(auto-fit, minmax(200px, 1fr))` a colapsar en 1 sola columna (`1×12`).
3. **P3 (Jerarquía visual y truncamiento):**
   - Los botones operativos de Columna 1 usan `grid-cols-2` dentro de `278px` internos, truncando 4 de 5 labels y dejando una fila impar.
   - Los tiles de clase muestran `Clase #N`, fecha y hora apilados a la izquierda sin separación ni `tabular-nums`.
   - **Clases Prácticas** usa cabecera simple y `appCardHover`, mientras **Estado Financiero** usa cabecera bordeada `p-5 border-b border-border-subtle bg-elevated/30` con icono circular y sin `appCardHover`. El padding/gap superior de **Estado Financiero** deja solo ~2 pagos visibles a `907px`.
4. **P4 (Higiene App-like / Bento / Tokens):**
   - Bajo `1024px`, `.bento-grid--fill-screen.has-enrollment-selector` no resetea a `grid-template-rows: auto`.
   - Con drawer abierto (`force-compact`) sobre `layoutmain >= 1024px`, `.ficha-3col-row` y `.ficha-pagos-h100` siguen forzando fila y `height: 100%`.
   - Falta `#bentoGrid` en el root (dejando muerto el `viewChild('bentoGrid')` + `animateBentoGrid()`), figura el atributo huérfano `appBentoReveal` no importado, y persisten `.kpi-label` deprecados.

## Plan de cambios

- **P1:** Mantener la altura acotada en la card (`ficha-3col-h100`) con cabecera + barra de progreso `shrink-0` y un scroller interno (`ficha-3col-grow ficha-3col-scroll custom-scrollbar pr-1`) sobre la grilla de 12 clases (sin `content-center`), replicando estructura en el skeleton y habilitando `.custom-scrollbar` en Columna 1 y Columna 2.
- **P2:** Usar `clamp(284px, 26.5cqi, 320px)` para Columna 1 y `clamp(276px, 25cqi, 340px)` para Columna 3 en `@container layoutmain (min-width: 1024px)` (`:not(.force-compact)`), bajar el mínimo de los tiles de clase a `minmax(175px, 1fr)`, y asegurar `width: 100%` en apilado vertical (`max-width: 1023px` y `.force-compact`).
- **P3:** Cambiar acciones operativas de Columna 1 a 1 columna (`flex flex-col gap-2`), permitir wrapping natural del nombre del alumno (`leading-snug break-words`), alinear `Clase #N` a la izquierda y fecha/hora (`tabular-nums`) a la derecha, igualar cabecera bordeada con icono circular `car` en **Clases Prácticas** (y quitar `appCardHover` en las cards full-height Col 1 y Col 2), y compactar suavemente la zona superior de `AdminHistorialPagosComponent`.
- **P4:** Agregar `@container layoutmain (max-width: 1023px)` para `.bento-grid--fill-screen` (`grid-template-rows: auto; grid-auto-rows: auto`), restringir `.ficha-3col-*` y `.ficha-pagos-*` cuando `.force-compact` está activo, conectar `#bentoGrid` / quitar `appBentoReveal`, y migrar `.kpi-label` → `.micro-label`.

## Archivos afectados

- `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`
- `src/app/features/admin/alumno-detalle/components/historial-pagos/admin-historial-pagos.component.ts`
- `indices/COMPONENTS.md`

## Verificación

- `npx.cmd tsc --noEmit`: OK (exit 0 tras la edición final).
- `npm.cmd run lint:arch`: OK (`0 errores`, `192` advertencias pre-existentes).
- `npx.cmd ng build --configuration development`: OK (bundle generado sin errores).
- `npm.cmd run test:ci`: `331` archivos passed, `1` skipped pre-existente (`5064` tests passed, `5` skipped pre-existentes; `alumno-detalle` `7/7` archivos / `62/62` tests passed).
- Navegador real (`http://localhost:4200/app/admin/alumnos/8787?enrollment=8495`): verificado a `1354 × 907` (Col 1 `294.65px`, Col 2 `372.59px`, Col 3 `278.35px`, altura uniforme `~641px`, cabecera `Clases Prácticas` en 1 línea, nombre y botones sin truncamiento, scroll hasta `Clase #12`, 0 errores de consola/red), mobile `390 × 844` (3 cards uniformes al 100%), modo `.force-compact` con drawer y tema claro/oscuro.
