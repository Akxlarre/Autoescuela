# Plan 0032-b — Pre-inscritos: content unificado + app-like fill-screen

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-07-16
> **Talla:** Spec-S (refactor acotado: 2 crear + 2 modificar, sin facade nuevo, sin migración)

---

## 1. Resumen ejecutivo

Extraer el bloque `filtros + tabla` (hoy duplicado ~95% entre `admin-pre-inscritos` y `secretaria-alumnos-pre-inscritos`) a un nuevo Dumb `app-pre-inscritos-content` en `shared/`, con **buscador y tabla en un solo card** y layout **app-like fill-screen** (reusa `.bento-grid--fill-screen-kpi` + `.bento-fill`, cero SCSS nuevo). Cada Smart queda reducido a: inyectar el facade, cablear inputs/outputs, calcular `maxVisible` por contenedor y abrir el drawer. Orden: (1) Dumb + spec.ts, (2) reconectar admin, (3) reconectar secretaría, (4) validar.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/shared/components/pre-inscritos-content/pre-inscritos-content.component.ts` | Dumb | Hero + card único (toolbar de filtros + tabla fill-screen). Dueño del estado de filtros y del `filtered()`/`visible()`. |
| `src/app/shared/components/pre-inscritos-content/pre-inscritos-content.component.spec.ts` | Test | Cubre `filtered()` (nombre/RUT/estado/licencia), `visible()` (budget) y `isDesktopLayout()`. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/alumnos/pre-inscritos/admin-pre-inscritos.component.ts` | Reemplazar template inline por `<app-pre-inscritos-content>`; agregar `LayoutService` + `maxVisible()`; pasar `showSede=true`, KPIs, `backRoute`; manejar `(rowSelected)`. | Consumir el Dumb; conservar `effect()` de sede + `setProfessionalOnly`. |
| `src/app/features/secretaria/alumnos-pre-inscritos/secretaria-alumnos-pre-inscritos.component.ts` | Igual, con `showSede=false` y `backRoute` de secretaría. | Consumir el mismo Dumb. |
| `indices/COMPONENTS.md` (SINCRONIZAR, exento) | Registrar `pre-inscritos-content`. | Índice vivo. |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| — | Ninguno (los dos Smart se conservan, solo adelgazan). |

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `<app-section-hero>` — hero con `density="slim"`, `[kpis]`, `[animateOnInit]="false"`, back nav.
- `<app-empty-state>` — estado vacío ("limpiar filtros").
- `<app-skeleton-block>` — skeletons de carga.
- `<app-icon>`, PrimeNG `p-table` / `p-select` / `p-tag` / `pTooltip`.
- Directivas `appBentoGridLayout`, `appCardHover`.
- Molde estructural: `alumnos-profesional-list-content` (toolbar+tabla en 1 card) y `ciclos-teoricos-content` (host `.bento-fill`, `:host{display:flex}`, input `isDesktop`).

### Facades/Services existentes que extendemos
- **`AdminPreInscritosFacade`** — sin cambios. El Dumb NO lo inyecta; recibe `preInscritos()`, `isLoading()` y los KPIs (`total/pendientesTest/aprobados`) como inputs desde el Smart.
- **`LayoutService.tier()`** — el Smart deriva `maxVisible = tier()==='desktop' ? null : 6`.
- **`sliceByBudget`** (`core/utils/layout-tier.utils.ts`) — el Dumb recorta las filas al budget.
- **`LayoutDrawerFacadeService`** — el Smart abre `AdminPreInscritoDrawerComponent` en `(rowSelected)`.

### Componentes/Facades que NO existen y debemos crear
- `pre-inscritos-content` — no existe equivalente; es la pieza faltante de la campaña. Justificación: hoy el markup vive duplicado inline en 2 Smart Components.

---

## 4. Modelo de datos

**N/A** — sin cambios de BD/RLS. Reusa `PreInscritoTableRow` (`core/models/ui/pre-inscrito-table.model.ts`) tal cual. Opcional: tipo local `FilterOption` para las options de select (o dejarlas como literales, igual que el exemplar).

---

## 5. Arquitectura del feature

```
Ruta admin  ─┐
Ruta secret ─┴─► <SmartComponent> (features/, adelgazado)
                    ├─ inject(AdminPreInscritosFacade)          // datos + KPIs
                    ├─ inject(LayoutService) → maxVisible()      // densidad por contenedor
                    ├─ inject(LayoutDrawerFacadeService)         // abrir drawer
                    ├─ inject(BranchFacade) [solo admin: effect + setProfessionalOnly]
                    └─ <app-pre-inscritos-content>  (shared/, Dumb, host = celda .bento-fill)
                          inputs:  preInscritos, isLoading, heroKpis,
                                   maxVisible (number|null), showSede, backRoute, backLabel, title, subtitle
                          state:   searchQuery / filterStatus / filterLicencia (locales)
                          derived: filtered() → visible() (sliceByBudget), isDesktopLayout()=maxVisible()===null
                          output:  rowSelected(PreInscritoTableRow)   // click fila / ojo
```

- **Shell fill-screen:** el root del Dumb es `.bento-grid bento-grid--fill-screen-kpi` (incondicional, evita shift de scrollbar); el card (toolbar+tabla) va marcado `.bento-fill` con `:host` no — ojo: aquí el Dumb es la PÁGINA completa (hero + card), no una celda única. Patrón = `alumnos-profesional-list-content` (root = `.bento-grid`), pero con el modificador `--fill-screen-kpi` y el card de tabla como `.bento-fill flex flex-col` para scroll interno.
- **Densidad/render (ampliación 0032-b):** **paginación** (no "cargar más"). `pageSize = isDesktopLayout() ? 12 : 6`; `pagedRows = filtered().slice(safePage*pageSize, …)`; `safePage` acota `currentPage` al `totalPages`. Solo la página actual llega al DOM (no sobrecargar). Barra prev/next canónica (como certificación), oculta si 1 página.
- **Responsive (ampliación 0032-b):** en desktop se renderiza **tabla**; en móvil/tablet (tier por CONTENEDOR) **cards canónicas** (avatar+datos), estilo `alumnos-profesional-list-content`. Switch por `isDesktopLayout()`, NO `md:`.
- **GSAP:** `animateBentoGrid()` en `ngAfterViewInit` del Dumb (como el exemplar).

### Capas tocadas
- **Smart**: `features/admin/.../admin-pre-inscritos.component.ts`, `features/secretaria/.../secretaria-alumnos-pre-inscritos.component.ts`
- **Dumb**: `shared/components/pre-inscritos-content/pre-inscritos-content.component.ts`
- **Facade/Migration**: sin cambios.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — OnPush, signals, Dumb sin Facade, Functional Core (`sliceByBudget`).
- [ ] `facades.md` — sin cambios de facade.
- [x] `models.md` — reusa `PreInscritoTableRow` (UI), sin DTO en la UI.
- [x] `visual-system.md` — tokens semánticos, bento fill-screen, `<app-icon>`, sin colores hardcodeados, sin SCSS nuevo.
- [ ] `swr-pattern.md` — el facade ya lo implementa; no se toca.
- [ ] `notifications.md` — no aplica.
- [x] `testing-tdd.md` — el Dumb tiene `computed()`/lógica de filtrado → `.spec.ts` obligatorio.
- [x] `ai-readability.md` — conservar `data-llm-*` de los inputs/botones al migrar.

---

## 7. Plan de testing

- **Unit (`pre-inscritos-content.spec.ts`)**: `filtered()` por nombre, por RUT, por estado, por licencia y combinado; `visible()` respeta budget (6 en móvil, todo en desktop); `isDesktopLayout()` = `maxVisible()===null`; `resetFiltros()`. Usar patrón de stub de signal inputs (`Object.defineProperty(component,'input',{value:signal(v)})`).
- **Build**: `ng build` limpio (no hay tests de componente en vitest; se valida por build).
- **lint:arch** exit 0 y **test:ci** verde.
- **QA `/verify` (Playwright)**: ambos portales (admin/secretaría), dark+light, desktop (fill-screen, tabla scrollea, sin scroll de documento) + móvil (scroll nativo), abrir drawer, columna Sede solo en admin. 0 errores de consola.

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Fill-screen recorta la tabla / doble scrollbar (trampa clásica specs 0030/0031) | Media | Seguir el canon exacto: `--fill-screen-kpi` incondicional, card de tabla `.bento-fill flex flex-col`, `flex` no `grid`; validar con `/verify`, no solo geométrico. |
| Backticks en comentarios del `template` literal → build stale silencioso | Media | No usar backticks dentro de comentarios del template; correr `ng build` real y hard-reload. |
| Corchetes en binding de clase (`[class.flex-[2]]`) rompen el binding | Baja | Usar clases estáticas o `[style.*]`, nunca corchetes anidados en bindings. |
| Perder atributos `data-llm-*` al migrar el markup | Baja | Copiar los botones/inputs con sus `data-llm-*` intactos. |
| Divergencia admin/secretaría (Sede, backRoute, effect de sede) | Baja | Todo lo divergente se pasa por input; el `effect()` de sede queda solo en el Smart de admin (igual que hoy). |

---

## 9. Orden de implementación

1. **Dumb `pre-inscritos-content`** (markup del exemplar `alumnos-profesional-list-content` + fill-screen de `ciclos-teoricos-content`; inputs/outputs/estado local).
2. **`pre-inscritos-content.spec.ts`** (TDD del `filtered()`/`visible()`).
3. **Reconectar `admin-pre-inscritos`** (adelgazar; `showSede=true`, `maxVisible()`, `(rowSelected)`→drawer; conservar effect de sede).
4. **Reconectar `secretaria-alumnos-pre-inscritos`** (`showSede=false`).
5. **Validar**: `ng build` + `npm run test:ci` + `npm run lint:arch` + `/verify` (ambos portales, dark/light, desktop/móvil).
6. **Sincronizar** `indices/COMPONENTS.md` + `/spec-verify`.

---

## 10. Estimación

Spec-S — < 1 día.

---

## Changelog

- 2026-07-16 — plan inicial (talla S) para spec 0032-b.
- 2026-07-16 — **approved** por el owner. Habilita el Spec Gate para implementar.
- 2026-07-16 — **ampliación de scope** (AC4 paginación + AC8 cards responsive). El Dumb reemplaza `sliceByBudget`/"Cargar más" por paginación (12/6) y agrega layout de cards en móvil (switch por contenedor). Sin facade/BD/SCSS nuevo. Sigue talla S.
