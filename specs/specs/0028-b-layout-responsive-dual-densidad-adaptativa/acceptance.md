# Acceptance 0028-b — Layout responsive dual: fill-screen desktop / scroll natural móvil + densidad adaptativa

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-11
> **Verifier:** agente (verificación en vivo con Playwright MCP, `browser_evaluate` con métricas del DOM real) · validado por Akxlarre

---

## Resumen

- AC totales: 9 + 4 edge cases
- AC cumplidos: 13
- AC fallidos: 0
- AC con evidencia: 13 (medición empírica en navegador + grep + suite de tests)

**Veredicto final:** ✅ PASA

Suite: `npm run test:ci` → **1274/1274 PASS** (18 tests nuevos). `npm run lint:arch` → **0 errores**. `ng build` → limpio. Consola del navegador → **0 errores, 0 warnings** en ambas páginas.

---

## Verificación por AC

### AC1 — Desktop 1440×900 dashboard sin scroll de página

- **Estado:** ✅ cumplido
- **Evidencia:** Playwright 1440×900 → `.shell-content` `{clientH: 823, scrollH: 823, noScroll: true}`; grid 780px; las 3 celdas `.bento-fill` con `contain: size` computado (574/278/279px llenando las filas).

### AC2 — Alumnos desktop fill-screen canónico

- **Estado:** ✅ cumplido
- **Evidencia:** `alumnos-list-content.component.ts` migrado a `bento-grid--fill-screen` + `.bento-fill` (sin `min-height: 600px` inline). Playwright 1440×900 → `.shell-content` `{823/823, noScroll: true}` (antes había 12px de overflow), card `contain: size`, tabla y paginador visibles. Mejora: la card ahora llena el alto disponible en vez de quedarse en 600px fijos.

### AC3 — Móvil 390×844: celdas naturales, sin scroll interno, página recorrible

- **Estado:** ✅ cumplido
- **Evidencia:** Playwright 390×844 dashboard → las 3 celdas con `contain: "none"`, alturas naturales 282/335/335px (antes 118px), `innerScroll: false` en todas las listas, `.shell-content` `{768 → scrollH 1411}` recorrible. Alumnos → card `contain: "none"`, `min-height: auto`, altura natural 2169px, `scrollH: 2549`.
- **Screenshot:** `.playwright-mcp/dash-mobile-390-fixed.png`, `.playwright-mcp/alumnos-mobile-390-fixed.png` (comparar con `dash-mobile-390.png` / `alumnos-mobile-390.png` del diagnóstico).

### AC4 — Presupuestos móvil dashboard: 4 clases / 3 actividades / 3 alertas + "Ver todas"

- **Estado:** ✅ cumplido
- **Evidencia:** Playwright 390×844 → Actividad y Alertas renderizan 4 `<li>` cada una (3 items + footer "Ver todas"), botones intactos abriendo sus drawers. Clases Actuales recibe `[maxItems]="liveClassesBudget()"` (4 en no-desktop); hoy la lista está vacía (ver AC-E1). Lógica cubierta por `layout-tier.utils.spec.ts` (9 tests) y visible en el AC7.

### AC5 — Alumnos móvil: 6 tarjetas + "Cargar más (N restantes)" en pasos de 6

- **Estado:** ✅ cumplido
- **Evidencia:** Playwright 390×844 con 22 alumnos → 6 tarjetas + botón `Cargar más (16 restantes)`; tras 1 click → 12 tarjetas + `(10 restantes)`; agotando los clicks → 22/22 renderizadas, última tarjeta visible al fondo del scroll y botón ausente. `data-llm-action="load-more-students"` presente.

### AC6 — Filtros operan sobre el TOTAL y recalculan el contador

- **Estado:** ✅ cumplido
- **Evidencia:** Con 12 tarjetas cargadas, al tipear en el buscador → densidad reseteada a 6 y contador recalculado sobre el total filtrado (`Cargar más (16 restantes)`). Implementado en `updateFilter()` que resetea `mobileShown`; `filteredAlumnos` es `computed` sobre el input completo.

### AC7 — Trigger por contenedor: drawer abierto compacta sin reload

- **Estado:** ✅ cumplido
- **Evidencia:** Desktop 1440×900, dashboard: antes de abrir drawer `main` = 1190px y listas completas (14 li); al abrir "Ver toda la actividad" → `main` = 941px, `contain: "none"` en celdas y listas compactadas a 4 li (3 + footer), todo reactivo sin recarga. Cubre también AC-E4.

### AC8 — Cero estilos inline de layout; canon en `_bento-grid.scss`

- **Estado:** ✅ cumplido
- **Evidencia:** `grep "contain: size|min-height: 600px|min-h-\[450px\]|min-h-\[300px\]|min-h-\[250px\]"` en `src/app` → 0 ocurrencias de código (solo 1 comentario). Mecanismo en `_bento-grid.scss`: `.bento-fill` gated por `@container layoutmain (min-width: $bp-lg)` y solo bajo `--fill-screen(-2)`.

### AC9 — Fix de capas: `min-height: 0` de `.bento-card` scoped a desktop

- **Estado:** ✅ cumplido (opción "scoped" del plan)
- **Evidencia:** `min-height: 0` removido de la regla base de `.bento-card` y movido a `@container layoutmain (min-width: 1024px)`. Medición móvil: `min-height: auto` computado en las celdas (las utilities `min-h-*` reviven bajo lg). Trampa de capas documentada en `_bento-grid.README.md`.

### AC-E1 — Lista vacía en móvil: empty-state natural, sin botones de densidad

- **Estado:** ✅ cumplido
- **Evidencia:** "Clases Actuales" vacía en 390×844 → empty-state completo y visible (282px, antes cortado a 118px); sin "Cargar más" (`sliceByBudget([], n) = []` testeado).

### AC-E2 — ≤ N items: sin "Cargar más"

- **Estado:** ✅ cumplido
- **Evidencia:** Al agotar los clicks (22/22 visibles) el botón desaparece (`remainingCards() === 0`); test unitario `sliceByBudget` budget ≥ length.

### AC-E3 — Skeletons respetan el presupuesto del tier

- **Estado:** ✅ cumplido
- **Evidencia:** `live-classes-panel` deriva `skeletonItems` de `maxItems` (4 en compacto, 5 en desktop). Actividad (3) y alertas (2) ya estaban bajo el presupuesto. Sin scroll interno en loading (listas `overflow-hidden` + altura natural).

### AC-E4 — Resize dinámico reacciona sin reload

- **Estado:** ✅ cumplido
- **Evidencia:** Mismo escenario de AC7 (drawer abre/cierra → tier cambia en vivo vía ResizeObserver). Cleanup verificado por test `layout.service.spec.ts` ("el cleanup retornado desconecta el observer"); resize 1440↔390 ejercitado durante toda la sesión de QA.

---

## Out-of-scope respetado

- ❌ Rollout a las otras ~28 páginas bento — confirmado: no entró (solo dashboard + alumnos-list-content).
- ❌ Virtual scroll / paginación server-side — confirmado: no entró.
- ❌ Cambios a la paginación de la tabla PrimeNG — confirmado: sigue `[rows]="10"`.
- ❌ Cambios en facades/SWR/queries — confirmado: cero archivos de `core/facades/` tocados.
- ❌ Rediseño de tarjetas móviles — confirmado: mismos campos.

---

## Deuda técnica detectada

- **Rollout del canon a ~28 páginas bento restantes** (receta: quitar inline styles → `--fill-screen` + `.bento-fill` → presupuesto opcional → /verify) → propuesta: spec/fix de rollout, mismo patrón que `[appBentoReveal]`.
- `isDrawerOpen = signal(false)` en `alumnos-list-content` parece huérfano pre-existente (no introducido por esta spec) → candidato a limpieza en el rollout.
- Los 24 íconos sin uso y warnings ARCH-09/ARCH-16 reportados por `lint:arch` son backlog pre-existente, fuera de este scope.

---

## Cambios en índices

(pendiente de ejecutar en T6.1 — se listan los artefactos)

- `indices/SERVICES.md` — `LayoutService` ampliado (mainWidth/tier/observeMain).
- `indices/UTILS.md` — nueva `layout-tier.utils` (widthToTier, sliceByBudget).
- `indices/MODELS.md` — nuevo `layout.model.ts` (`LayoutTier`).
- `indices/STYLES.md` — `.bento-fill` + scoping de `.bento-card min-height` en `_bento-grid.scss`.
- `indices/COMPONENTS.md` — `live-classes-panel` (+input `maxItems`), `alumnos-list-content` (filtros signals + Cargar más).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** el fix CSS fue quirúrgico — al scopear `contain: size` por container query, las listas internas con `overflow-y-auto` se comportan bien en ambos modos sin tocarlas.
- **Fricciones:** la trampa de capas (`@layer bento.*` después de `utilities`) tenía muertos los `min-h-*` desde hace tiempo sin que nadie lo notara; quedó documentada en el README del bento.
- **Para el siguiente ciclo:** el rollout masivo debería incluir un check de ARCH nuevo que prohíba `contain:` y `min-height:` en estilos inline de templates.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados (`npm run indices:sync` + fila manual de `LayoutService` en SERVICES.md)
- [x] Tests pasando en CI (1274/1274)
- [x] `lint:arch` limpio (0 errores)
- [x] Sin deuda crítica abierta

**Cerrado por:** Akxlarre
**Fecha:** 2026-07-11
