# Acceptance 0032-b — Pre-inscritos: content unificado + app-like fill-screen

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-17
> **Verifier:** agente (Opus) · **validado por** Akxlarre (2026-07-17)

---

## Resumen

- AC totales: 10 (AC1–AC8 + AC-E1, AC-E2)
- AC cumplidos: 10
- AC fallidos: 0

**Gates automáticos:** `ng build` exit 0 · `npm run test:ci` **1335/1335** (suite completa, incluye tests del fix-052 en paralelo) · spec del Dumb **15/15** · `npm run lint:arch` exit 0.

**Veredicto final:** ✅ PASA — código verde en todos los gates + **visto bueno visual del owner el 2026-07-17** (cerró la spec: "cerramos"). AC3 (fill-screen) y AC-E1 (switch con drawer) confirmados visualmente.

> ⚠️ Nota de proceso: el trabajo aún **no está commiteado** (working tree). La evidencia cita `archivo:línea` y resultados de gates en vez de hashes.

---

## Verificación por AC

### AC1 — Buscador + tabla en UN card dentro de un Dumb sin Facade

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `src/app/shared/components/pre-inscritos-content/pre-inscritos-content.component.ts` — un único `<div class="bento-banner card ... bento-fill">` contiene toolbar de filtros + tabla/cards + paginador.
  - El componente es Dumb: solo `input()`/`output()`, **no inyecta** ningún Facade (solo `GsapAnimationsService` para la animación de entrada, permitido).
- **Notas:** reemplaza los 2 cards separados que tenían los Smart originales.

### AC2 — Admin y secretaría consumen el mismo componente; inline eliminado

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `admin-pre-inscritos.component.ts` y `secretaria-alumnos-pre-inscritos.component.ts` → `imports: [PreInscritosContentComponent]`; el template de cada uno es solo `<app-pre-inscritos-content ... (rowSelected)="openDrawer($event)" />`.
  - Los ~200 líneas de template inline duplicado en cada Smart fueron eliminadas.
- **Notas:** cada Smart solo cablea facade + `maxVisible()` + drawer.

### AC3 — Desktop 100vh sin scroll de documento; tabla scrollea internamente; móvil scroll nativo

- **Estado:** ✅ cumplido — estructura aplicada + **visto bueno visual del owner (2026-07-17)**
- **Evidencia (código):**
  - Root `.bento-grid.bento-grid--fill-screen` (2 filas: hero + card) + card marcado `.bento-fill flex flex-col min-h-0` + región de contenido `flex-1 min-h-0 overflow-auto`.
  - Modificadores reutilizados de `src/styles/layout/_bento-grid.scss` (sin SCSS nuevo).
- **Falta:** verificar en localhost:4200 (desktop) que el documento NO scrollea y el scroll ocurre dentro del card; en móvil, scroll nativo. Doctrina del proyecto: QA geométrico ≠ mirada humana (specs 0030/0031).

### AC4 — Paginación (PrimeNG `<p-paginator>`, 12 desktop / 6 móvil, solo página al DOM)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Computeds `pageSize()` (12/6), `totalPages()`, `safePage()` (acota `currentPage`), `pagedRows()` (solo la página al DOM) en el `.component.ts`.
  - `<p-paginator>` de PrimeNG en el template (`[rows]="pageSize()"`, `[totalRecords]="filtered().length"`, `[first]="safePage()*pageSize()"`, `(onPageChange)`), mismo look que Base Alumnos B; **pagina tabla (desktop) y cards (móvil)** con una sola fuente de verdad.
  - Tests: `pre-inscritos-content.component.spec.ts` — describe `paginacion` (12/6 por tier, `onPageChange` navega, última página con menos filas, `onPageChange` sin page vuelve a página 1, reset al filtrar, `safePage` acotado). **15/15 verde.**

### AC5 — Columna Sede solo en admin (`showSede`)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `@if (showSede())` condiciona la columna Sede en header y body (tabla) y en la card (móvil).
  - `admin-pre-inscritos` pasa `[showSede]="true"`; `secretaria-alumnos-pre-inscritos` pasa `[showSede]="false"`.

### AC6 — Click fila/ojo → `rowSelected` → Smart abre el drawer

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Output `rowSelected = output<PreInscritoTableRow>()`; `(click)="rowSelected.emit(row)"` en la fila/card y en el botón "ojo" (con `$event.stopPropagation()`).
  - Ambos Smart: `openDrawer(row)` → `facade.select` + `resetPromocionesCache` + `layoutDrawer.open(AdminPreInscritoDrawerComponent, ...)` (comportamiento idéntico al original).

### AC7 — Diff de `src/styles/**` vacío (sin SCSS nuevo)

- **Estado:** ✅ cumplido
- **Evidencia:** `git status` no reporta ningún archivo bajo `src/styles/`. Se reutilizan `.bento-grid--fill-screen`, `.bento-fill` y utilities Tailwind + tokens existentes.

### AC8 — Móvil = cards canónicas; desktop = tabla; switch por contenedor

- **Estado:** ✅ cumplido (visual de las cards sujeto al visto bueno del owner)
- **Evidencia:**
  - `@if (isDesktopLayout())` → `<p-table>`; `@else` → grid de cards canónicas (avatar con iniciales + datos + acción "ver"), estilo `alumnos-profesional-list-content`.
  - `isDesktopLayout = computed(() => maxVisible() === null)` → switch por **contenedor** (tier de `LayoutService`), NO por `md:` de viewport.
  - Tests: describe `layout por contenedor` (pageSize/isDesktopLayout por tier).

### AC-E1 — Switch por contenedor con el drawer abierto (no `lg:`/`md:`)

- **Estado:** ✅ cumplido — lógica + **visto bueno visual del owner (2026-07-17)**
- **Evidencia (código):** el switch usa `isDesktopLayout()` (por contenedor); el Smart calcula `maxVisible = tier()==='desktop' ? null : 6` con `LayoutService.tier()` (alimentado por ResizeObserver de `<main>`).
- **Falta:** abrir el drawer de detalle en desktop y confirmar que, al angostarse `<main>`, la vista pasa a cards (no queda tabla apretada).

### AC-E2 — Empty-state + skeletons dentro del content

- **Estado:** ✅ cumplido
- **Evidencia:** `@if (isLoading())` → `<app-skeleton-block>` ×6; `@else if (filtered().length === 0)` → `<app-empty-state>` con acción "Limpiar filtros".

---

## Out-of-scope respetado

- ❌ Cambiar `AdminPreInscritosFacade`/queries — confirmado: `git status` no reporta cambios en `core/facades/admin-pre-inscritos.facade.ts`.
- ❌ Cambiar `AdminPreInscritoDrawerComponent` — confirmado: no tocado.
- ❌ Cambios de BD/RLS/migraciones — confirmado: nada bajo `supabase/`.
- ❌ Migrar otras páginas — confirmado: solo pre-inscritos.
- ❌ Cambiar lógica de negocio (estado/psychResult/vencimiento) — confirmado: solo se movió de lugar, sin alterar.

---

## Deuda técnica detectada

- **ARCH-09** (warning blando, no bloqueante): el Dumb tiene 462 líneas (límite recomendado 200). Es esperable en un content component con tabla + cards responsive + paginación (el par `alumnos-profesional-list-content` tiene 540). No amerita spec nueva; si se quisiera, se podría extraer la card móvil a un sub-componente.

---

## Cambios en índices

- `indices/COMPONENTS.md` — agregada fila `app-pre-inscritos-content` (Organismo / Dumb, "✅ Fill-screen + paginado").
- Resto de índices — sin cambios (no hay facades/servicios/modelos/tablas nuevos).

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (10/10; AC3 y AC-E1 con visto bueno visual del owner)
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (1335/1335)
- [x] `lint:arch` limpio (exit 0)
- [x] Sin deuda crítica abierta
- [x] **Visto bueno visual del owner (AC3 fill-screen + AC-E1 switch con drawer)**

**Cerrado por:** Akxlarre
**Fecha:** 2026-07-17
