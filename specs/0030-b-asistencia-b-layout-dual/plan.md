# Plan 0030-b — Asistencia B: layout dual (fill-screen desktop / scroll móvil) + densidad adaptativa

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-07-12
> **Talla:** S (plan reducido — contexto de negocio, US y métricas viven en spec.md)

---

## 1. Resumen ejecutivo

Reestructurar el template de `asistencia-clase-b-content` a un grid fijo de 3 filas (hero / tabs / celda fill) donde lo condicional (alertas + tabla) vive DENTRO de la celda fill, activando `.bento-grid--fill-screen-kpi` solo cuando el tab Prácticas está activo. Agregar presupuesto de densidad con `visibleWithLoadMore()` usando una **clave de scope compuesta** (`tab|filtroEstado|instructor|fecha`) para que el reset del contador (AC6) salga gratis del util ya testeado. Wiring de `maxVisible` en los 2 Smarts calcado de `admin-tareas`. Cero SCSS nuevo (AC4), cero BD.

---

## 2. Inventario de impacto

### Archivos a CREAR

Ninguno.

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts` | Reestructura del template (grid 3 filas, aplanar doble wrapper, alertas pinned en celda fill, thead sticky, botón "Cargar más") + input `maxVisible` + computed `visiblePracticas`/`hasMorePracticas` + modificador condicional por tab | AC1–AC6, AC8, AC-E1–E4 |
| `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.spec.ts` | Tests class-level nuevos: presupuesto, "Cargar más", reset por filtro/instructor/fecha/tab | AC5, AC6 (TDD — este spec SÍ corre en vitest, no está excluido) |
| `src/app/features/admin/asistencia/admin-asistencia.component.ts` | `inject(LayoutService)` + `maxVisible = computed(() => tier()==='desktop' ? null : 6)` + binding `[maxVisible]` | AC7, AC8 |
| `src/app/features/secretaria/asistencia/secretaria-asistencia.component.ts` | Ídem admin | AC8 |

### Archivos a ELIMINAR

Ninguno.

**Verificación negativa (AC4):** `src/styles/layout/_bento-grid.scss` NO debe aparecer en el diff.

---

## 3. Reutilización (Discovery)

### Componentes/clases existentes que reutilizamos
- `.bento-grid--fill-screen-kpi` + `.bento-fill` (`_bento-grid.scss`, specs 0028/0029) — la fila de tabs ocupa el slot "KPI row" del modificador. **Sin tocar el SCSS** → se esquiva la trampa de los dos bloques (0029).
- `visibleWithLoadMore()` / `sliceByBudget()` (`core/utils/layout-tier.utils.ts`) — sin cambios. El parámetro `activeTab: string` acepta cualquier clave de scope; se le pasa la compuesta `` `${tab}|${status}|${instructorId}|${fecha}` `` y el reset al cambiar cualquiera de esos ejes ya está cubierto por su suite.
- `LayoutService.tier()` (`core/services/ui/layout.service.ts`) — wiring idéntico a `admin-tareas.component.ts:147` (`null` desktop / número en tablet-mobile-drawer).
- Patrón "Cargar más" (señales privadas `loadMoreTab`/`loadMoreClicks`) — calcado de `task-list-content.component.ts:165-173`.
- `app-skeleton-block`, `app-badge`, `app-icon`, `app-date-input`, `p-select`, `app-section-hero`, `ciclos-teoricos-content` — sin cambios.

### Componentes/Facades que NO existen y debemos crear
- Ninguno. (Se descartó crear un util nuevo para la clave de scope: es una composición de strings de una línea, testeable directo en el spec del componente, que sí corre en vitest.)

---

## 4. Modelo de datos

N/A — sin cambios de BD, DTOs ni modelos UI.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
AdminAsistenciaComponent (Smart)      SecretariaAsistenciaComponent (Smart)
  ├─ inject(LayoutService)              ├─ inject(LayoutService)
  ├─ maxVisible = computed(             ├─ (ídem, mismo computed)
  │    tier()==='desktop' ? null : 6)   │
  └──────────────┬──────────────────────┘
                 ▼  [maxVisible]="maxVisible()"
  <app-asistencia-clase-b-content>   ← Dumb: NO inyecta LayoutService (AC8)
    div.bento-grid [class.bento-grid--fill-screen-kpi]="activeTab()==='practicas'"
      ├─ fila 1 (auto): <app-section-hero>
      ├─ fila 2 (auto): fila de tabs (.bento-banner)
      ├─ fila 3 (1fr, solo tab Prácticas): div.bento-fill.flex.flex-col (hijo DIRECTO del grid)
      │     ├─ bloque alertas (shrink-0, pinned — fuera del scroll)
      │     └─ section.card flex-1 min-h-0 flex-col
      │           ├─ header + filtros (shrink-0)
      │           └─ wrapper overflow-y-auto (desktop) + overflow-x-auto
      │                 └─ <table> con thead sticky (top:0, bg-surface)
      │                       └─ @for visiblePracticas() + botón "Cargar más"
      └─ tab Ciclos: <app-ciclos-teoricos-content class="bento-banner"> (sin fill, scroll natural)
```

### Detalles de implementación clave

- **Aplanar wrappers:** hoy alertas y tabla son `div.bento-banner > section.bento-banner.card` (doble wrapper). Pasan a un ÚNICO hijo directo del grid: `div.bento-fill` que contiene alertas + card. Requisito estructural del modo dual (la celda fill debe ser hija directa).
- **Scope compuesto:** `scopeKey = computed(() => \`${activeTab()}|${activeStatusFilter()}|${selectedInstructorId()}|${selectedDate()}\`)`; `visiblePracticas = computed(() => visibleWithLoadMore(filteredPracticas(), maxVisible(), scopeKey(), { forTab: loadMoreTab(), clicks: loadMoreClicks() }))`.
- **Botón "Cargar más":** `data-llm-action="load-more-practicas"`, visible solo si `visiblePracticas().length < filteredPracticas().length`; incrementa en pasos del presupuesto (semántica de `visibleWithLoadMore`).
- **Skeletons:** count = `maxVisible() ?? 5` (hoy hardcodea 5) — cumple AC-E3.
- **thead sticky:** el wrapper de la tabla es el único contenedor con scroll (Y en desktop, X siempre); `position: sticky; top: 0` con `background: var(--bg-surface)` para no transparentar filas debajo.
- **Contadores de filtros** (`countByStatus`) siguen calculándose sobre `clasesPracticas()` total — el presupuesto solo recorta el render (AC6: "filtros operan sobre el total").

### Capas tocadas

- **Smart**: `features/admin/asistencia/admin-asistencia.component.ts`, `features/secretaria/asistencia/secretaria-asistencia.component.ts`
- **Dumb**: `shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
- **Facade / Service / Migration**: sin cambios

---

## 6. Restricciones aplicables

Reglas aplicables: `architecture.md` (OnPush, Dumb estricto sin LayoutService — AC8), `visual-system.md` (canon bento fill-screen, tokens, skeletons acotados), `testing-tdd.md` (spec del Dumb primero, TDD), `ai-readability.md` (`data-llm-action` en el botón "Cargar más").

---

## 7. Plan de testing

- **Unit (vitest, TDD — extender el spec existente del Dumb, class-level):**
  1. `maxVisible = null` (desktop) → `visiblePracticas()` devuelve todas las filas filtradas.
  2. `maxVisible = 6` con 15 filas → devuelve 6; `hasMorePracticas()` true.
  3. Click "Cargar más" → 12; segundo click → 15 (tope); `hasMorePracticas()` false.
  4. Contador incrementado + cambio de filtro de estado → vuelve a 6 (reset por scope).
  5. Ídem cambio de instructor, de fecha (`selectedDate` input) y de tab.
  6. Menos filas que presupuesto → sin botón (AC-E2). Cero filas → mensaje vacío sin botón (AC-E1).
- **Suites existentes intactas:** `layout-tier.utils.spec.ts` (sin cambios), tests actuales de badges del Dumb deben seguir verdes tras la reestructura del template.
- **QA `/verify` (Playwright, ambas rutas admin y secretaria — login multi-rol vía navegación SPA, canon 0029):**
  - 1440×900 tab Prácticas: `.shell-content` sin scroll, scroll interno de tabla, alertas pinned, thead sticky (AC1, AC3).
  - 1440×900 tab Ciclos: scroll natural de página, grid sin el modificador (AC2).
  - 390×844: apilado nativo, 6 filas + "Cargar más" (AC5, AC-E4). Si el seed no alcanza, generar clases QA vía REST directo (canon memoria `feedback_qa_rest_directo_rls_admin`).
  - Desktop con drawer lateral abierto → densidad compacta sin recarga (AC7).
  - Loading: skeletons acotados sin romper el fill (AC-E3). Modal justificar + drawers Iniciar/Finalizar funcionan (AC-E5).
- **Verificación estática:** `git diff --stat` sin `_bento-grid.scss` (AC4); `ng build` + `npm run test:ci` + `npm run lint:arch` verdes.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| `thead` sticky no funciona combinado con `overflow-x-auto` + `overflow-y-auto` en el mismo wrapper | Media | Un solo contenedor de scroll para X e Y (sticky funciona respecto al ancestro scrolleable más cercano). Validar en `/verify`; fallback: sticky solo en desktop (≥lg). |
| La reestructura del template rompe los tests class-level existentes del Dumb (TestBed compila el template) | Baja | Correr `npm run test:ci` inmediatamente después de la reestructura, antes del wiring de Smarts. |
| Muchas alertas (>3) se comen el alto de la tabla en desktop | Baja | Hoy el caso típico es 0–3. Si aparece en QA, `max-height` + scroll interno en la zona pinned (sin cambiar el grid). |
| Seed insuficiente para ejercitar "Cargar más" en vivo (gap declarado en la 0029) | Media | Elegir fecha con muchas prácticas o insertar clases QA vía PostgREST con token admin; los unit tests cubren la lógica en cualquier caso. |
| GSAP `animateBentoGrid` con hijos que aparecen/desaparecen por tab | Baja | Ya ocurre hoy con el mismo `@if`; la animación corre solo en `ngAfterViewInit`. Sin cambios de comportamiento. |

---

## 9. Orden de implementación

1. **TDD:** extender `asistencia-clase-b-content.component.spec.ts` con los casos de presupuesto/reset (fallan en rojo).
2. **Dumb (lógica):** input `maxVisible`, señales `loadMoreTab`/`loadMoreClicks`, computeds `scopeKey`/`visiblePracticas`/`hasMorePracticas`, botón "Cargar más" → tests verdes.
3. **Dumb (layout):** reestructura a 3 filas — aplanar wrappers, `div.bento-fill` flex-col con alertas pinned + card `flex-1 min-h-0`, wrapper de scroll único con thead sticky, modificador condicional por tab, skeletons acotados.
4. **Smarts:** wiring `maxVisible` en admin y secretaria (patrón `admin-tareas`).
5. **Validación:** `ng build`, `npm run test:ci`, `npm run lint:arch`, diff sin `_bento-grid.scss`.
6. **QA:** `/verify` Playwright (390/1440, ambas rutas, checklist §7) → `/spec-verify` → acceptance.md.

---

## 10. Estimación

S — medio día (una sesión).

---

## Changelog

- 2026-07-12 — plan inicial (talla S confirmada por el owner)
- 2026-07-12 — refinamientos durante implementación: (1) el "scope compuesto" se reemplazó por scope de tab (`visibleWithLoadMore` intacto) + **reset explícito en los setters** de filtro/instructor/fecha/tab — cubre también el roundtrip de tab; (2) riesgo "muchas alertas" (catalogado Baja) resultó ser el caso real del seed (20 alertas) → mitigación del §8 aplicada: `max-h-[45%] overflow-y-auto` (inerte en móvil por spec CSS); (3) los tests class-level con inputs requirieron stub de InputSignals vía `Object.defineProperty` (setInput/bindings no propagan en la infra vitest JIT). Detalle en tasks.md TD-1..TD-3 y acceptance.md.
