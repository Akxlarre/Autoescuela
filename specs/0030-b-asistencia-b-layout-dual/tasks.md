# Tasks 0030-b — Asistencia B: layout dual (fill-screen desktop / scroll móvil) + densidad adaptativa

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** in_progress
> **Created:** 2026-07-12

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

> Sin Fase de Datos ni Facade: la spec no toca BD, modelos ni facades (plan §4).

---

## Fase 1 — Lógica de densidad en el Dumb (TDD)

- [x] **T1.1** — Escribir tests de presupuesto/reset en `asistencia-clase-b-content.component.spec.ts` PRIMERO
  - **AC ref:** AC5, AC6, AC-E1, AC-E2
  - **DoD:**
    - [ ] Casos: `maxVisible=null` → todas; `maxVisible=6` con 15 filas → 6; "Cargar más" → 12 → 15 (tope); reset al cambiar filtro de estado, instructor, fecha y tab; sin botón con ≤6 filas; sin botón con 0 filas
    - [ ] Tests class-level (mismo estilo de los tests de badges existentes)
    - [ ] Tests FALLAN (no hay implementación aún); los tests de badges existentes siguen verdes

- [x] **T1.2** — Implementar la lógica de presupuesto en `asistencia-clase-b-content.component.ts`
  - **AC ref:** AC5, AC6, AC8, AC-E1, AC-E2
  - **DoD:**
    - [ ] Input `maxVisible = input<number | null>(null)` (NO inyecta LayoutService — AC8)
    - [ ] Señales privadas `loadMoreTab`/`loadMoreClicks` (patrón `task-list-content.component.ts:165-173`)
    - [ ] Computeds `scopeKey` (`tab|estado|instructor|fecha`), `visiblePracticas` (via `visibleWithLoadMore`), `hasMorePracticas`
    - [ ] `@for` de la tabla usa `visiblePracticas()`; `countByStatus` sigue sobre el total
    - [ ] Botón "Cargar más (N restantes)" con `data-llm-action="load-more-practicas"`, visible solo si `hasMorePracticas()`
    - [ ] Skeletons acotados: count = `maxVisible() ?? 5` (AC-E3)
    - [ ] Tests de T1.1 PASAN (`npm run test:ci`)

---

## Fase 2 — Reestructura de layout del Dumb

- [x] **T2.1** — Grid de 3 filas con celda fill condicional por tab
  - **AC ref:** AC1, AC2, AC3, AC4, AC-E4
  - **DoD:**
    - [ ] `[class.bento-grid--fill-screen-kpi]="activeTab() === 'practicas'"` en el div raíz
    - [ ] Doble wrapper `div.bento-banner > section.bento-banner.card` aplanado: alertas + card tabla viven en UN único hijo directo `div.bento-fill` (flex-col, `min-h-0`)
    - [ ] Alertas pinned: bloque `shrink-0` fuera del área scrolleable
    - [ ] Card tabla `flex-1 min-h-0 flex-col`; header+filtros `shrink-0`; wrapper único de scroll (Y desktop, X siempre) alrededor de la `<table>`
    - [ ] `thead` sticky (`top: 0`, fondo `var(--bg-surface)`)
    - [ ] Tab Ciclos intacto: `<app-ciclos-teoricos-content class="bento-banner">` sin fill
    - [ ] `src/styles/layout/_bento-grid.scss` SIN cambios (verificar con `git diff`)
    - [ ] `ng build` limpio; tests de Fase 1 y de badges siguen verdes
    - [ ] Sin estilos inline de layout (`contain`, `min-height` px) — canon 0028

---

## Fase 3 — Wiring en los Smarts

- [x] **T3.1** — `admin-asistencia.component.ts` + `secretaria-asistencia.component.ts`: pasar `maxVisible`
  - **AC ref:** AC7, AC8
  - **DoD:**
    - [ ] Ambos: `inject(LayoutService)` + `maxVisible = computed(() => this.layoutService.tier() === 'desktop' ? null : 6)` (patrón `admin-tareas.component.ts:147`)
    - [ ] Binding `[maxVisible]="maxVisible()"` en `<app-asistencia-clase-b-content>`
    - [ ] Los dos Smarts quedan idénticos en este aspecto (AC8)
    - [ ] `ng build` limpio

---

## Fase 4 — Validación

- [x] **T4.1** — Semáforos estáticos
  - **AC ref:** AC4
  - **DoD:**
    - [ ] `npm run test:ci` verde (1209+ tests, incluye los nuevos)
    - [ ] `npm run lint:arch` exit 0
    - [ ] `git diff --stat` NO incluye `_bento-grid.scss`

- [x] **T4.2** — QA visual `/verify` (ejecutado con Claude in Chrome — no había Playwright MCP en la sesión; mismas verificaciones)
  - **AC ref:** AC1, AC2, AC3, AC5, AC6, AC7, AC-E3, AC-E4, AC-E5
  - **DoD:**
    - [ ] 1440×900 tab Prácticas (admin Y secretaria — login multi-rol vía navegación SPA, canon 0029): `.shell-content` sin scroll, tabla scrollea interna, alertas pinned, thead sticky
    - [ ] 1440×900 tab Ciclos: scroll natural, grid sin modificador
    - [ ] 390×844: apilado nativo, 6 filas + "Cargar más" funcional (si falta seed → insertar clases QA vía PostgREST con token admin)
    - [ ] Desktop + drawer lateral abierto → densidad compacta sin recarga
    - [ ] Loading: skeletons acotados, fill no se rompe
    - [ ] Modal justificar + drawers Iniciar/Finalizar operativos
    - [ ] Modo oscuro y claro sin regresiones visuales; 0 errores de consola

- [x] **T4.3** — Ejecutar `/spec-verify`
  - **DoD:**
    - [ ] `acceptance.md` generado con evidencia por AC
    - [ ] AC Verifier devuelve `{ok: true}` o tickets restantes resueltos

---

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/` (`/sync-indices`): entrada de `asistencia-clase-b-content` en `COMPONENTS.md` (nuevo input `maxVisible`, modo dual) + eliminada entrada duplicada obsoleta
- [x] **T5.2** — Mover la spec a `done` en `specs/ROADMAP.md`
- [x] **T5.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [x] **TD-1** — Cap de alertas pinned: el seed real tiene **20 alertas** (riesgo del plan §8 activado). `max-h-[45%] overflow-y-auto` en la sección de alertas — el % solo computa con altura definida (desktop fill), en móvil es inerte → dual sin container query.
- [x] **TD-2** — Cambio de estrategia de tests: los signal inputs NO son escribibles en la infra vitest (JIT sin initializer-transform; `ComponentRef.setInput` y bindings de host se descartan). Patrón adoptado: stub de InputSignals con `signal()` locales vía `Object.defineProperty` — sin render de template, cubre setters + computeds reales.
- [x] **TD-3** — Reset explícito del contador en los setters (`setStatusFilter`/`setInstructorFilter`/`selectTab`/`onDateChange`) además del scope del util: garantiza el reset también en el roundtrip de tab (AC6 estricto).
- [x] **TD-4** — (2026-07-13, post-cierre) Feedback visual del owner: rediseño de alertas de card pesada a fila compacta de 1 línea (avatar 20px, detalle en `title`); botones acortados. 4 tests nuevos.
- [x] **TD-5** — (2026-07-13) Fix de bug real: `formatIsoDate()` no manejaba timestamps ISO completos (`recorded_at`/`scheduled_at` son `timestamptz`, no date-only) — corregido con `.slice(0,10)`.
- [x] **TD-6** — (2026-07-13) `text-[9px]` en el avatar disparó ARCH-17 (tamaño arbitrario, regresión real) — corregido a `text-2xs` (piso del DS).
- [x] **TD-7** — (2026-07-13, 2ª ronda de feedback) Redistribución a 2 columnas: tabla protagonista (`order-1 flex-1`) + alertas en `<aside order-2 w-80>`. Análisis visual previo de ambos tabs (Ciclos ya era 2col → se deja). Ver acceptance.md §"Revisión post-cierre #2".
- [x] **TD-8** — (2026-07-13) El switch col/row usa `isDesktopLayout()` (= `maxVisible()===null`, tier por contenedor) en vez de `lg:` de Tailwind (viewport): con el drawer abierto `<main>` se angosta pero el viewport no → debe apilar igual que la densidad. Verificado en vivo (main 718px → column).
- [x] **TD-9** — (2026-07-13) Bug de proceso: 4 backticks en comentarios del `template` literal rompieron el build; uno llegó a disco y `ng serve` sirvió bundle stale → verificación inicial sobre código viejo. Confirmar `className` real del DOM tras cada cambio, no asumir rebuild.
