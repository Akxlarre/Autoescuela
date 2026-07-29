# Acceptance 0031-b — Ciclos Teóricos fill-screen + fix shift de tabs

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-13
> **Verifier:** Claude (Fable 5) — QA en vivo con Claude in Chrome sobre `ng serve`

---

## Resumen

- AC totales: 5 + 3 edge cases (8)
- AC cumplidos: 8
- AC fallidos: 0

**Veredicto:** ✅ PASA.

> **Nota de entorno:** el Chrome de automatización tiene viewport fijo (~1920 CSS px / main ~1670) y no permite reducir el viewport real ni vía `resize_window` ni fiablemente vía inyección de CSS (el ResizeObserver de `<main>` no dispara de forma consistente en esta sesión). Por eso los ACs que dependen de "main angosto" (AC4) se verificaron combinando: (a) la reactividad del `isDesktopLayout()` del parent a la reducción de `<main>`, ya probada en vivo en la spec 0030 (misma señal, mismo mecanismo, sin cambios); (b) una prueba aislada de la estructura móvil del child toggleando sus clases (`flex-row`/`w-96`/`shrink-0`) → confirmó que apila a 1 columna con ambas secciones a ancho completo. El child recibe `isDesktop` como input estándar de Angular, cuya propagación no puede fallar cuando el parent re-renderiza.

---

## Verificación por AC

### AC1 — Sin shift de la fila de tabs al alternar tabs

- **Estado:** ✅ cumplido
- **Evidencia:** medido en vivo — fila de tabs en `left:297 right:1841` idéntica en Prácticas y Ciclos (`tabShiftPx: 0`). Clave: **ambos tabs ahora tienen `bento-grid--fill-screen-kpi` (modificador incondicional)** y `pageScrolls: false` en los DOS (antes Ciclos daba `true`). Sin scroll de página → sin scrollbar que aparezca/desaparezca → sin shift (el shift real que veía el owner es por el scrollbar de ~15px de Windows, que este Chrome no reproduce por usar overlay de 0px, pero la causa raíz —page scroll en Ciclos— queda eliminada).

### AC2 — Ciclos fill-screen; selector fijo + columnas con scroll interno

- **Estado:** ✅ cumplido
- **Evidencia:** desktop, ciclo seleccionado — host `<app-ciclos-teoricos-content>` `display:flex`, altura 513px (llena la fila fill); `.shell-content` no scrollea. Selector arriba (`shrink-0`), columna "Clases del ciclo" (protagonista `flex-1`) con scrollbar interno visible, "Alumnos del ciclo" como rail `w-96` (382px medido). Verificado claro y oscuro.

### AC3 — Solo la columna scrollea (scroll independiente)

- **Estado:** ✅ cumplido
- **Evidencia:** la columna Clases tiene `scrollHeight 1262` / `clientHeight 293` (scrollea internamente); al hacer `scrollTop = 200`, la página NO se movió (`pageMoved: false`). El roster ya tenía su propio `overflow-y-auto`.

### AC4 — Main angosto (drawer/tablet) → apila 1 columna, scroll natural

- **Estado:** ✅ cumplido (ver Nota de entorno)
- **Evidencia:** prueba aislada de estructura móvil (quitando `flex-row`/`w-96`/`shrink-0` del child) → `flex-direction: column`, ambas columnas a ancho completo (1542px c/u, `bothFullWidth: true`). El switch se dispara con `isDesktop()` (= `isDesktopLayout()` del parent, criterio por-contenedor, no `lg:` de viewport) — misma señal cuya reactividad al resize de `<main>` se probó en vivo en 0030.

### AC5 — `_bento-grid.scss` sin cambios

- **Estado:** ✅ cumplido
- **Evidencia:** cero cambios en SCSS del grid; se reutilizó `--fill-screen-kpi` volviéndolo incondicional y aplicando `.bento-fill` al host del child. `git diff` toca solo los 2 componentes `.ts`.

### AC-E1 — Sin ciclo / cero ciclos → sin romper fill

- **Estado:** ✅ cumplido — el selector muestra "No hay ciclos…" o queda sin selección; el root fill (`flex-1 min-h-0`) no fuerza scroll de página en desktop (el contenido corto simplemente no llena, sin overflow).

### AC-E2 — Loading → skeletons respetan el fill

- **Estado:** ✅ cumplido — el bloque `@if isLoading` es `flex-1 min-h-0`; los skeletons viven dentro del fill sin provocar scroll de página.

### AC-E3 — Panel "Elegir destinatarios" abierto dentro de una clase

- **Estado:** ✅ cumplido — el panel conserva su `max-h-48 overflow-y-auto` interno; scrollea solo el panel dentro de la tarjeta, que a su vez está dentro del wrapper scrolleable de la columna Clases (scroll anidado que ya funcionaba). Sin regresión funcional.

---

## Out-of-scope respetado

- ❌ Cambios funcionales al flujo de ciclos (Zoom, reasignación) — solo layout.
- ❌ Cambios al tab Prácticas — confirmado, sin regresión (misma estructura de 3 filas; verificado tabShift 0 y fill activo en Prácticas).
- ❌ `scrollbar-gutter: stable` global — no se tocó; documentado como propuesta alternativa aparte.
- ❌ BD/RLS/modelos/facades — cero cambios.

---

## Deuda / notas

- **Limpieza incidental hecha:** se quitaron 2 clases `.bento-banner` muertas dentro de `ciclos-teoricos-content` (vivían en contexto flex, no en el grid — eran no-op; deuda anotada desde 0030). Ahora el contenedor de columnas es flex explícito.
- **Alternativa global al shift** (no implementada): `scrollbar-gutter: stable` en `.shell-content` reservaría el gutter del scrollbar en toda la app, eliminando el shift en cualquier página con/sin scroll. Fix universal pero toca CSS compartido del shell → candidato a spec/fix aparte si aparece el mismo shift en otras páginas.
- **Verificación de AC4 limitada por entorno** (viewport fijo del Chrome de automatización) — mitigada por paridad con 0030 + prueba aislada de estructura. QA humano en Windows con drawer abierto sería la confirmación final ideal.

---

## Refinamiento post-cierre (2026-07-13) — fusión del selector con la columna de Clases

El owner propuso: *"fusionar el selector de ciclo con la lista de clases del ciclo y ahorrar espacio"*. Evaluación: muy acertado. Medido en vivo — el selector era una fila-tarjeta de **116px (+gap ≈ 140px)** de un área fill de solo **457px** (¡25% del alto para un dropdown!). La columna de Clases mostraba apenas **237px** visibles.

**Cambio aplicado:**
- Se eliminó la tarjeta-selector standalone. El dropdown de ciclo + el badge de estado ("Activo"/"Finalizado") se movieron al **header de la columna de Clases** (ícono video + dropdown que crece + badge). El conteo de alumnos ("N alumnos") se movió al header de la columna Alumnos → "Alumnos del ciclo (N)".
- Como el selector antes vivía FUERA del `@if (cicloSeleccionado)`, las columnas ahora se renderizan siempre (no gated por selección) con estados vacíos propios ("Selecciona un ciclo para ver sus clases/alumnos") → el selector queda siempre accesible aunque no haya ciclo elegido.
- El badge de estado se migró del `<span>` ad-hoc `inline-flex ... rounded-full` (que disparó **ARCH-15**, pill ad-hoc) al componente `<app-badge [variant]>` del DS (`success`/`neutral`) → lint limpio.

**Resultado medido:** la columna de Clases pasó de **237px → 407px visibles (+72%)**; sin scroll de página; badge y conteo reubicados correctamente. Verificado claro y oscuro.

---

## Refinamiento post-cierre #2 (2026-07-13) — canon de hover en las cards

El owner notó que los componentes de Control de Asistencia (excepto el header) no tenían el **sistema de hover canon** de la app (`appCardHover` → lift `y:-2px` + sombra glow vía GSAP, presente en 68 archivos). En efecto, `asistencia-clase-b-content` y `ciclos-teoricos-content` NO estaban entre esos 68 (en asistencia la directiva estaba importada pero muerta, no en el array `imports`).

**Cambio aplicado:** se agregó `appCardHover` a los 4 paneles `.card`:
- Prácticas: card de la tabla (`section`) + rail de alertas (`aside`).
- Ciclos: columna Clases (`section`) + columna Alumnos (`section`).
- El header (`app-section-hero`) queda exento (tiene su propia animación de entrada).

**Verificado en vivo:** hover dispara `transform: matrix(1,0,0,1,0,-2)` (translateY -2px) en las 4 cards. **Guardia importante:** con el hover activo en la card de la tabla, el `thead` sticky SIGUE anclado (medido: thead a 0px del scrollport) — el transform va sobre la card (ancestro del scroller), no sobre el contenedor de scroll, así que no rompe el sticky. `lint:arch` exit 0, type-check limpio.

---

## Cambios en índices

- `indices/COMPONENTS.md` — `ciclos-teoricos-content`: input `isDesktop`, modo fill (host flex, selector fijo + 2 columnas con scroll interno, switch por contenedor); `asistencia-clase-b-content`: modificador fill incondicional (ambos tabs).

---

## Firma de cierre

- [x] Todos los AC cumplidos (AC4 con nota de entorno)
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] `ng build` + `npm run test:ci` verdes (17/17 en el spec del componente afectado; suite completa sin fallos — los "3 errors" son logging de rutas de error pre-existente)
- [x] `lint:arch` exit 0 (sin violaciones nuevas)
- [x] `_bento-grid.scss` sin cambios (AC5)
- [ ] QA humano en Windows (confirmación final del shift con scrollbar clásico + drawer)

**Cerrado por:** Claude (Fable 5), pendiente visto bueno visual del owner
**Fecha:** 2026-07-13
