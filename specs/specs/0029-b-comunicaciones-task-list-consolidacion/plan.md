# Plan 0029-b — Comunicaciones: consolidar 3 implementaciones + patrón dual

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-07-12
> **Talla:** M (10 archivos: 2 crear, 8 modificar; sin migración, sin facade nuevo; 1 decisión CSS resuelta abajo)

---

## 1. Resumen ejecutivo

Se extrae `<app-task-list-content>` (Dumb, `shared/`) que encapsula tabs + lista de `<app-task-card>` + densidad adaptativa (mismo mecanismo `LayoutService.tier()` + `sliceByBudget` de la spec 0028), y los 3 Smart Components (`AdminTareasComponent`, `SecretariaObservacionesComponent`, `InstructorTareasComponent`) pasan a delegarle la lista, conservando cada uno su propio hero/KPIs/lógica de tabs. Se resuelve una fricción de CSS real (ver §5): Secretaria/Instructor tienen KPIs como celdas separadas del hero, algo que el `--fill-screen` de 2 filas (hero + lista) no contempla — se agrega un modificador nuevo de 3 filas. Orden grueso: Dumb + su spec (TDD) → SCSS → Admin (caso simple, 2 filas) → Secretaria/Instructor (caso con KPI-row, 3 filas) → QA.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/shared/components/task-list-content/task-list-content.component.ts` | Dumb | Tabs + lista de tareas + densidad adaptativa, reutilizado por los 3 roles |
| `src/app/shared/components/task-list-content/task-list-content.component.spec.ts` | Test | TDD: `visibleTasks`/`remainingCount` computed, reset de `mobileShown` al cambiar `activeTab`/`tasks` |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/tareas/admin-tareas.component.ts` | Reemplazar el bloque tabs+lista por `<app-task-list-content>`; inyectar `LayoutService`, computar `maxVisible` | AC1, AC2, AC3 |
| `src/app/features/secretaria/observaciones/secretaria-observaciones.component.ts` | Ídem + migrar el grid raíz de `bento-grid` plano a `bento-grid--fill-screen-kpi` (nuevo modificador, ver §5) | AC1, AC2, AC3 |
| `src/app/features/instructor/tareas/instructor-tareas.component.ts` | Ídem que Secretaria | AC1, AC2, AC3 |
| `src/styles/layout/_bento-grid.scss` | Nuevo modificador `.bento-grid--fill-screen-kpi` (3 filas: hero auto / KPI-row auto / lista fill) | Resuelve la composición hero+KPIs-separados+lista que `--fill-screen`/`--fill-screen-2` no cubren |
| `src/styles/layout/_bento-grid.README.md` | Documentar el nuevo modificador + cuándo usar cada variante fill-screen | Mantener el canon como fuente única (mismo criterio que spec 0028) |
| `indices/COMPONENTS.md` | Registrar `app-task-list-content` | Sync obligatorio |
| `indices/STYLES.md` | Registrar `.bento-grid--fill-screen-kpi` | Sync obligatorio |
| `indices/USAGE-MAP.md` | Actualizar consumidores de `TaskCardComponent`/`TabsComponent` | Vía `npm run indices:sync` |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-task-card>` (`shared/components/task-card/`) — input `task`/`loading`, sin cambios.
- `<app-tabs>` (`shared/components/tabs/`) — input `tabs`/`activeId`, output `activeIdChange`, sin cambios. Exporta `TabOption`.
- `<app-empty-state>` — sin cambios, mensaje/subtítulo siguen siendo decisión de cada Smart (varían por rol y por tab).
- `.bento-fill` + `LayoutService.tier()` + `sliceByBudget` (`core/utils/layout-tier.utils.ts`) — mecanismo completo de la spec 0028, sin modificar.
- `bento-grid--fill-screen` (2 filas) — se mantiene tal cual para Admin, que no tiene KPI-row separado.

### Facades/Services existentes que extendemos
- Ninguno. `TasksFacade` no se toca (fuera de scope, spec §4).

### Componentes/Facades que NO existen y debemos crear (justificación)
- `<app-task-list-content>` — no hay ningún Dumb que combine tabs+lista+densidad hoy; el más parecido (`alumnos-list-content`) está acoplado a la tabla/tarjetas de alumnos y no aplica.

---

## 4. Modelo de datos

N/A — sin cambios de persistencia. `TaskRow` (`core/models/ui/task.model.ts`) se reutiliza tal cual como tipo de `tasks` input del nuevo Dumb.

---

## 5. Arquitectura del feature

### La fricción CSS y su resolución

`bento-grid--fill-screen` (spec 0028) define 2 filas: `auto minmax(0,1fr)` — hero arriba, una única celda `.bento-fill` abajo que llena el resto. Eso alcanza para Admin (KPIs viven *dentro* del hero, vía `heroKpis`) y para Alumnos B (hero + tabla). Pero Secretaria/Instructor tienen los KPIs como **celdas `.bento-square` separadas**, entre el hero y la lista — una fila conceptual extra que ningún modificador actual contempla.

**Se agrega `.bento-grid--fill-screen-kpi`** (3 filas): `grid-template-rows: auto auto minmax(0,1fr)` en `layoutmain ≥ lg`. Fila 1 = hero (`.bento-hero`, full-width, auto); fila 2 = KPIs (`.bento-square` × N, auto — al ser el hero full-width, el `grid-auto-flow: dense` ya empuja las squares a la fila 2 sin necesidad de `data-row-start`); fila 3 = lista (`.bento-fill`, full-width, `minmax(0,1fr)`, igual que hoy). No requiere wrapper divs ni placement manual: el flujo natural del grid (hero full-width que agota la fila 1, luego las squares que no alcanzan a completar la fila 2 dejando hueco, luego la lista full-width que no cabe en ese hueco y cae a la fila 3) resuelve la posición sola.

Admin **no** adopta este modificador — sigue con `--fill-screen` (2 filas) sin cambios, porque no tiene KPI-row.

### Diagrama de flujo

```
AdminTareasComponent / SecretariaObservacionesComponent / InstructorTareasComponent (Smart)
  ├─ inject(TasksFacade)      → sentTasks/receivedTasks/observationTasks (según rol)
  ├─ inject(LayoutService)    → tier()
  ├─ activeTab = signal(...)  → semántica de tabs específica de cada rol (sin cambios)
  ├─ tabs = computed(...)     → TabOption[] con counts (sin cambios)
  ├─ activeTasks = computed(...) → filtra según activeTab() (sin cambios, lógica ya existente)
  ├─ maxVisible = computed(() => layoutService.tier() === 'desktop' ? null : 5)
  └─ <app-task-list-content>              ← NUEVO Dumb compartido
        [tabs]="tabs()"
        [activeTab]="activeTab()"
        [tasks]="activeTasks()"
        [loading]="facade.isLoading()"
        [maxVisible]="maxVisible()"
        [emptyMessage]="..." [emptySubtitle]="..." [emptyIcon]="..."
        (activeTabChange)="activeTab.set($event)"
        (taskClicked)="openDetail($event)"

  <app-task-list-content> (Dumb, interno):
    visibleTasks = computed(sliceByBudget(tasks(), maxVisible()))
    remainingCount = computed(max(0, tasks().length - mobileShown))
    mobileShown: signal local, reset vía effect() al cambiar activeTab()/tasks()
    "Cargar más" incrementa mobileShown; oculto si remainingCount === 0
```

### Capas tocadas
- **Dumb (nuevo)**: `shared/components/task-list-content/task-list-content.component.ts`
- **Smart (modificados)**: `features/admin/tareas/`, `features/secretaria/observaciones/`, `features/instructor/tareas/`
- **DS**: `styles/layout/_bento-grid.scss` (+ README)
- **Facade**: sin cambios

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush, Signals, Dumb sin Facades (el Dumb recibe `maxVisible` ya calculado por input, igual que `live-classes-panel.maxItems` en spec 0028; NO inyecta `LayoutService`)
- [ ] `facades.md` — no se toca `TasksFacade`
- [x] `models.md` — reutiliza `TaskRow`/`TabOption` existentes, sin nuevos modelos
- [x] `visual-system.md` — canon bento en SCSS del DS, `.bento-fill`, sin estilos inline de layout
- [ ] `swr-pattern.md` — no cambia fetching
- [ ] `notifications.md` — no aplica
- [x] `testing-tdd.md` — `.spec.ts` del Dumb obligatorio (tiene `computed()` con lógica: `visibleTasks`, `remainingCount`)
- [x] `ai-readability.md` — `data-llm-action="load-more-tasks"` en el botón "Cargar más" (mismo patrón que `load-more-students` de spec 0028)

---

## 7. Plan de testing

- **Unitario (TDD, primero)**: `task-list-content.component.spec.ts` — `visibleTasks` con budget null/N, `remainingCount`, reset de `mobileShown` al cambiar `activeTab` input y al cambiar la referencia de `tasks`.
- **Suite completa**: `npm run test:ci` + `npm run lint:arch`.
- **QA visual (`/verify`, Playwright)** en las 3 páginas, 1440×900 y 390×844, claro/oscuro:
  - Admin: confirmar que sigue igual que en la spec 0028 (no debería cambiar visualmente, solo migra internamente al Dumb compartido).
  - Secretaria/Instructor: confirmar que el nuevo `--fill-screen-kpi` ubica hero/KPIs/lista en las 3 filas esperadas, sin scroll de página en desktop, sin colapso en móvil.
  - Los 3: presupuesto de densidad móvil + "Cargar más" + reset al cambiar de tab.
  - Drawer abierto en desktop (si aplica en esas rutas): densidad reactiva.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El nuevo modificador `--fill-screen-kpi` no ubica las celdas donde se espera (dense auto-flow es sensible al ancho de las squares) | Media | Diseño verificado en el análisis (§5) contando columnas: 3× `.bento-square` (3 col c/u a lg) = 9 de 12, dejan hueco insuficiente para la lista full-width → cae sola a fila 3. Verificar con `/verify` antes de dar por cerrado. |
| Cambiar el layout de Secretaria/Instructor a fill-screen altera flujos ya validados por usuarios reales | Baja-Media | Confirmado explícitamente por el owner en spec §9. Screenshot antes/después en el `/verify`. |
| Reset de `mobileShown` al cambiar `tasks()` por referencia puede disparar de más si el Facade recrea el array en cada refresh silencioso (SWR) | Media | Resetear por `activeTab()` (cambio real de intención del usuario), NO por cada cambio de `tasks()` — solo por longitud/tab, evitando reset espurio en cada refresh de Realtime. |
| Admin no debe cambiar visualmente al migrar al Dumb compartido | Baja | Es el caso ya cubierto por la spec 0028 y verificado; el refactor es de extracción, no de rediseño. Screenshot antes/después. |

---

## 9. Orden de implementación

1. `task-list-content.component.spec.ts` (TDD) → `task-list-content.component.ts`
2. `_bento-grid.scss`: `.bento-grid--fill-screen-kpi` + README
3. Migrar `AdminTareasComponent` (caso simple, sin cambio de grid) — valida que el Dumb no rompe nada
4. Migrar `SecretariaObservacionesComponent` (caso con KPI-row, valida el modificador nuevo)
5. Migrar `InstructorTareasComponent` (mismo patrón que Secretaria)
6. `npm run lint:arch` + `npm run test:ci` + `/verify` en las 3 páginas
7. Sincronizar `indices/*.md`

---

## 10. Estimación

M — 1 día. El riesgo principal está concentrado en el paso 4 (validar el modificador CSS nuevo); una vez resuelto ahí, el paso 5 es una réplica directa.

---

## Changelog

- 2026-07-12 — plan inicial (agente, tras discovery de COMPONENTS/STYLES + análisis de las 3 páginas existentes)
