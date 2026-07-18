# Tasks 0029-b — Comunicaciones: consolidar 3 implementaciones + patrón dual

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-07-12

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Dumb Component compartido (TDD)

> **Cambio de enfoque respecto al plan original:** un `.spec.ts` con `TestBed` renderizando el template de `TaskListContentComponent` choca con una limitación conocida del proyecto (`vitest.config` no compila templates Angular para `TestBed` — ver `alert-card.component.spec.ts`, `describe.skip` con el mismo TODO). Se extrajo la lógica de densidad/"Cargar más" a una función pura testeable en `core/utils/layout-tier.utils.ts` (`visibleWithLoadMore`), y el componente queda como wrapper delgado verificado con `ng build` (mismo patrón que el resto del proyecto para Dumb Components).

- [x] **T1.1** — Escribir tests de `visibleWithLoadMore` en `layout-tier.utils.spec.ts` PRIMERO
  - **AC ref:** AC3, AC4, AC-E1, AC-E2, AC-E3
  - **DoD:**
    - [x] `budget=null` devuelve todo, ignora el estado de "Cargar más"
    - [x] `budget=N` sin clicks previos → primeros N
    - [x] Clicks del tab activo expanden el presupuesto (`budget * (1+clicks)`)
    - [x] Clicks de OTRO tab se ignoran (tab-scoped reset)
    - [x] No genera duplicados ni excede el total real
    - [x] Tests FALLAN antes de implementar `visibleWithLoadMore`

- [x] **T1.2** — Implementar `visibleWithLoadMore` + `task-list-content.component.ts`
  - **AC ref:** AC1, AC3, AC4, AC-E1, AC-E2, AC-E3
  - **DoD:**
    - [x] `visibleWithLoadMore` pura en `core/utils/layout-tier.utils.ts`; tests PASAN (`npm run test:ci`)
    - [x] Componente OnPush, solo `input()`/`output()` — NO inyecta `LayoutService` ni Facades (recibe `maxVisible` ya resuelto)
    - [x] Inputs: `tabs`, `activeTab`, `tasks`, `loading`, `maxVisible`, `emptyMessage`, `emptySubtitle`, `emptyIcon`
    - [x] Outputs: `activeTabChange`, `taskClicked`
    - [x] Skeletons con `<app-task-card [loading]="true">` acotados al mismo presupuesto que la vista cargada
    - [x] Botón "Cargar más" con `btn-ghost` + `data-llm-action="load-more-tasks"`, oculto si `remainingCount() === 0`
    - [ ] Documentado en `indices/COMPONENTS.md` (Fase 6)

---

## Fase 2 — Canon CSS: modificador de 3 filas

- [x] **T2.1** — `.bento-grid--fill-screen-kpi` en `_bento-grid.scss`
  - **AC ref:** AC2
  - **DoD:**
    - [x] 3 filas en `@container layoutmain (min-width: $bp-lg)`: `grid-template-rows: auto auto minmax(0, 1fr)`
    - [x] Verificado por conteo de columnas que 3× `.bento-square` (9/12 col a lg) + hero full-width + lista full-width caen en filas 1/2/3 sin necesidad de `data-row-start` (según análisis del plan §5) — pendiente de confirmación visual en `/verify` (Fase 4)
    - [x] `_bento-grid.README.md` documenta cuándo usar `--fill-screen` (2 filas) vs `--fill-screen-kpi` (3 filas) vs `--fill-screen-2` (Dashboard)

---

## Fase 3 — Migración de las 3 páginas

- [x] **T3.1** — `AdminTareasComponent` (caso simple, sin cambio de grid)
  - **AC ref:** AC1, AC2, AC3, AC5
  - **DoD:**
    - [x] Bloque tabs+lista reemplazado por `<app-task-list-content>`
    - [x] Inyecta `LayoutService`; `maxVisible = computed(() => layoutService.tier() === 'desktop' ? null : 5)`
    - [x] Sigue usando `bento-grid--fill-screen` (2 filas) sin cambios — valida que el Dumb no altera el resultado visual actual
    - [x] `ng build` limpio

- [x] **T3.2** — `SecretariaObservacionesComponent` (caso KPI-row, valida el modificador nuevo)
  - **AC ref:** AC1, AC2, AC3, AC5, AC6
  - **DoD:**
    - [x] Grid raíz migra de `bento-grid` plano a `bento-grid--fill-screen-kpi`
    - [x] `.bento-fill` en la card de la lista
    - [x] KPIs (`.bento-square` × 3) mantienen su composición actual (AC6 — no se mueven al hero)
    - [x] Mismo wiring de `<app-task-list-content>` + `LayoutService.tier()` que Admin
    - [x] `ng build` limpio

- [x] **T3.3** — `InstructorTareasComponent` (mismo patrón que Secretaria)
  - **AC ref:** AC1, AC2, AC3, AC5, AC6
  - **DoD:**
    - [x] Mismos cambios que T3.2, adaptados a los tabs propios de instructor (all/task/question/observation)
    - [x] `ng build` limpio
    - [x] Spec existente (`instructor-tareas.component.spec.ts`, testea `filteredTasks`/`filterChips`/`activeFilter`/`inProgressCount` sin `detectChanges()`) sigue verde sin modificaciones

---

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` corre limpio (0 errores)
- [x] **T4.2** — `npm run test:ci` corre verde (1279/1279)
- [x] **T4.3** — `/verify` (Playwright) en las 3 páginas, 1440×900 y 390×844
  - **AC ref:** AC1, AC2, AC5, AC6
  - **DoD:**
    - [x] Admin: visualmente idéntico a antes de la migración (comparado contra spec 0028), sin scroll de página, `contain:size`
    - [x] Secretaria/Instructor: hero(fila1)/KPIs(fila2, 3 y 2 squares resp.)/lista(fila3) ubicados correctamente en desktop; sin scroll de página
    - [x] Los 3: móvil `contain:none` (natural), sin colapso visual
    - [x] Consola limpia en las 3 (0 errores; 1 warning de GoTrue lock, ruido de los re-logins de QA, no relacionado al código)
    - [x] Secretaria/Instructor verificados con login real (credenciales de prueba del login) vía SPA navigation — el full-page-reload pierde la sesión por timing de hidratación de Supabase, se navegó por el menú en cambio
    - [x] Modo claro verificado en Instructor (nueva variante `--fill-screen-kpi`)
    - [x] **Bug real encontrado y corregido en el camino:** el selector `.bento-fill` en `_bento-grid.scss` no incluía `.bento-grid--fill-screen-kpi` — la card de Secretaria/Instructor no recibía `contain:size` en desktop. Fix de una línea, revalidado.
    - [ ] ⚠️ **NO verificado en vivo con datos reales:** AC3/AC4/AC-E2 ("Cargar más" + reset de tab) — el seed solo tiene 1-2 tareas por tab en estos 3 roles, insuficiente para cruzar el presupuesto de 5. Cubierto indirectamente por los 5 tests unitarios de `visibleWithLoadMore` (incluye escenario de 12 items/budget 5). Ver nota en acceptance.md.
- [x] **T4.4** — Ejecutar `/spec-verify`
  - **DoD:** `acceptance.md` con evidencia por AC

---

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/` (`npm run indices:sync` — 6 índices, `app-task-list-content` auto-registrado en COMPONENTS.md)
- [x] **T5.2** — Marcar spec como `done` en `ROADMAP.md`
- [x] **T5.3** — Limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
