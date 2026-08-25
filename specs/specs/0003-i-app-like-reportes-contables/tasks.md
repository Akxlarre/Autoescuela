# Tasks 0003-i — App-like: reportes contables (`admin` + `secretaria`)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-08-24

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Nota: revisión 1 vs revisión 2

La implementación pasó por 2 revisiones. La **revisión 1** (Hero+Filtros+Categorías+Gastos
Fijos todos fijos, 3 tabs) compiló, pasó lint y tests, pero **`/verify` en navegador real
encontró un bug**: el bloque fijo medía 954px, más que el viewport disponible (680-780px) — el
panel de tabs colapsaba a **0px**, invisible sin scroll posible. La **revisión 2** (esta, la que
quedó implementada) corrige eso: Filtros y Categorías en filas propias, Gastos Fijos pasó de
sección fija a 4º tab. El detalle de ambas queda abajo para que el historial sea trazable.

---

## Fase 3 — Capa UI

- [x] **T3.1** — Reestructurar el template en filas propias (Hero / Filtros+tabs / Categorías /
  panel de tabs), moviendo Evolución Mensual, Detalle Diario, Rentabilidad y Gastos Fijos a un
  `@switch` dentro de un `.bento-fill`
  - **AC ref:** AC1, AC1b, AC2
  - **DoD:**
    - [x] Hero y Filtros cada uno en su propia fila fija — **revisión 2**: Categorías también
      pasó a fila propia (`reportes-categorias-scroll`), separada de Filtros (revisión 1 los
      tenía agrupados en un solo contenedor con scroll compartido, causa raíz del feedback
      visual "se siente bugueado")
    - [x] `<app-tabs>` con `TabOption[]` — **revisión 2**: 4 tabs (Evolución Mensual / Detalle
      Diario / Rentabilidad / Gastos Fijos), Gastos Fijos filtrado por `isAdmin()` vía
      `tabOptions()` (computed) — revisión 1 tenía solo 3 tabs sin Gastos Fijos
    - [x] `.bento-fill @switch (activeTab())` contiene las 4 secciones (3 + Gastos Fijos movido
      desde su posición fija original), sin perder ningún dato/columna de las tablas originales
    - [x] `ng build` compila sin errores (verificado en ambas revisiones)

- [x] **T3.2** — Agregar el signal `activeTab()` y `tabOptions()` al componente
  - **AC ref:** AC1, AC1b
  - **DoD:**
    - [x] `activeTab = signal<ReporteTab>('evolucion')`, `ReporteTab` ahora incluye
      `'gastos-fijos'` (revisión 2)
    - [x] `(activeIdChange)` de `<app-tabs>` actualiza el signal vía `setActiveTab()`
    - [x] Tab por defecto al cargar: "Evolución Mensual" (`'evolucion'`)
    - [x] **Revisión 2**: `tabOptions` pasó de array constante a `computed<TabOption[]>()` que
      agrega `{ id: 'gastos-fijos', label: 'Gastos Fijos' }` solo si `isAdmin()`

- [x] **T3.3** — Resolver qué modificador `.bento-grid--fill-screen*` aplica, y garantizar que
  el panel de tabs nunca colapse
  - **AC ref:** AC1, AC3, AC-E1, AC-E2
  - **DoD:**
    - [x] Ninguno de los modificadores existentes soporta el caso. Se creó
      **`.bento-grid--fill-screen-4`** en `_bento-grid.scss` (registrado en
      `scripts/lib/bento-classes.allowlist.json` e `indices/STYLES.md`, pasa `ARCH-21`)
    - [x] **Revisión 1** (`auto auto auto auto minmax(0,1fr)`, 4 filas fijas + fill): compiló y
      pasó lint, pero **`/verify` encontró que colapsaba a 0px** — el contenido fijo (954px)
      excedía el viewport disponible (680-780px)
    - [x] **Revisión 2** (`auto auto minmax(0,1fr) minmax(280px,1fr)`): Hero y Filtros auto:
      la fila de Categorías cede espacio primero (`minmax(0,1fr)`, con scroll interno propio
      `.reportes-categorias-scroll`); el panel de tabs tiene alto mínimo **garantizado** de
      280px (`minmax(280px,1fr)`) que nunca colapsa. `.bento-fill` ancla a la última fila vía
      `grid-row: -2`, robusto sin importar el conteo de filas previas
    - [x] Confirmado visualmente en `/verify`: `documentScrolls: false`, grid no desborda su
      caja, Categorías scrollea internamente cuando no entra, panel de tabs siempre visible con
      contenido real
    - [x] 768px de alto — no probado explícitamente en esta pasada (probado 800/900px con
      resultado correcto); queda como seguimiento menor, no bloqueante

---

## Fase 3b — Fix de compacidad de tabs (feedback visual adicional)

- [x] **T3.4** — Las tabs deben compartir línea con "Mes actual"/"Aplicar", no una franja propia
  - **DoD:**
    - [x] Causa: `<app-tabs>` tiene `:host { display:block; width:100% }`, forzando su propia
      línea en cualquier contenedor flex
    - [x] Fix: `style="width:auto; flex:0 0 auto"` inline sobre `<app-tabs>` en el template
      consumidor — el inline style tiene mayor especificidad que el `:host` del hijo, sin tocar
      el componente compartido `app-tabs`
    - [x] Confirmado visualmente: Mes actual + Aplicar + 4 tabs en una sola línea compacta

---

## Fase 4 — Conexión y animación

- [x] **T4.1** — Resolver el comportamiento de `GsapAnimationsService.animateBentoGrid()` al
  cambiar de tab
  - **DoD:**
    - [x] Decisión tomada y documentada (comentario en `ngAfterViewInit`): el stagger corre una
      sola vez en la carga inicial, igual que `fix-027-i` — no se re-anima al cambiar de tab

- [x] **T4.2** — Verificar `force-compact` (drawer abierto) sobre la página de reportes
  - **AC ref:** AC4
  - **DoD:**
    - [x] Verificado en código: esta ruta **no maneja `force-compact` hoy** — AC4 no aplica,
      documentado explícitamente en vez de asumir silenciosamente

---

## Fase 5 — Validación

- [x] **T5.1** — `.spec.ts` para `activeTab()` / `tabOptions()`
  - **AC ref:** AC1b, AC2
  - **DoD:**
    - [x] Tests PASAN (`npm run test:ci` — 4/4 en
      `reportes-contables-content.component.spec.ts`, reescrito en revisión 2)
    - [x] Caso: tab por defecto es "Evolución Mensual"
    - [x] Caso: `setActiveTab` cambia `activeTab()` (incluye `'gastos-fijos'`)
    - [x] Caso: admin ve 4 tabs (con Gastos Fijos al final)
    - [x] Caso: secretaria (no admin) ve solo 3 tabs, sin Gastos Fijos

- [x] **T5.2** — Lint arquitectónico y suite completa
  - **DoD:**
    - [x] `npm run lint:arch` → 0 errores (171 warnings preexistentes, ninguno nuevo)
    - [x] `npm run test:ci` → 2221 passed, 1 failed (preexistente y no relacionado —
      `secretaria-contabilidad-cuadratura.component.spec.ts`), 5 skipped

- [x] **T5.3** — `/verify` visual
  - **AC ref:** AC1, AC1b, AC2, AC3, AC-E1, AC-E2
  - **DoD:**
    - [x] **Revisión 1 encontró el bug** documentado en T3.3 (panel colapsado a 0px, Gastos
      Fijos cortado) — reportado al usuario con evidencia numérica, no maquillado
    - [x] Usuario dio feedback visual directo sobre el render real (screenshots propios) → 2
      rondas de ajuste (Filtros compacto + separación de filas, Gastos Fijos → tab)
    - [x] **Revisión 2 confirmada**: `/admin/contabilidad/reportes` en 1280×800 y 1920px de
      ancho — Hero/Filtros/tabs/Categorías/panel todos visibles y correctos
    - [x] Tab "Gastos Fijos" probado con click real — empty-state se renderiza bien
    - [x] `/secretaria/contabilidad/reportes` confirmado — solo 3 tabs, sin Gastos Fijos,
      mismo layout que admin
    - [x] Mobile 390×844 confirmado — scroll nativo real vía `.shell-content` (no
      `document.documentElement`, que es el contenedor de scroll de este shell), las 4
      secciones accesibles scrolleando
    - [x] Consola limpia en las 3 corridas (0 errores; 1 warning `NG0955` preexistente de
      `@for track` con keys "Otros" duplicadas en datos de prueba, no introducido por este
      track)
    - [x] **Ajuste 3 (feedback del usuario, 2026-08-25) — REVERTIDO:** a 1680×900 el panel de
      tabs se veía corto con espacio vacío debajo. Primer intento: `2fr` en la última fila (el
      doble de peso que Categorías) — funcionó para el panel pero **le robó espacio a
      Categorías**, que quedó visiblemente apretada (feedback directo del usuario con
      screenshot: "quedo peor al estar mas acortado"). Revertido a `1fr:1fr` — Categorías
      recupera su tamaño cómodo original, el panel se queda en su piso histórico (280px) sin
      inflar más
    - [x] **Ajuste 4 — 768px de alto probado explícitamente (AC-E1):** con `minmax(0,1fr)` en
      Categorías, a 768px de alto colapsaba a **0px** — invisible, no solo "necesita scroll".
      Se le dio un piso propio: `minmax(100px,1fr)`. Resultado a 768px: Categorías visible con
      100px + scroll interno, panel de tabs completo (280px) con datos — nada oculto. El grid
      se desborda ~98px de su caja fija en este viewport extremo, absorbido por el scroll del
      shell general (no rompe nada, no hay contenido invisible) — es un trade-off aceptado a
      propósito: a 768px de alto ya no es "cero scroll" perfecto, pero tampoco pierde
      información. Confirmado visualmente y sin errores de consola

---

## Fase 6 — Cierre

- [ ] **T6.1** — Actualizar `indices/APP-LIKE-ROLLOUT.md`
  - **DoD:**
    - [ ] Fila de `/admin/contabilidad/reportes` (y la equivalente de secretaria) marcada como
      cerrada, con referencia a `0003-i-app-like-reportes-contables`

- [ ] **T6.2** — `/spec-verify` para generar `acceptance.md`
  - **DoD:**
    - [ ] Todos los AC (AC1, AC1b, AC2-AC4, AC-E1, AC-E2) verificados con evidencia
    - [ ] Veredicto final: PASA
