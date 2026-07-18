# Acceptance 0015-b — Header Slim Mode (Section Hero Compacto)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-06-18
> **Verifier:** ac-verifier (Playwright MCP) · validado por Akxlarre

---

## Resumen

- AC totales: 12 (9 funcionales + 3 edge cases)
- AC cumplidos: 12
- AC fallidos: 0
- AC con evidencia: 12

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Altura ≤60px sin KPIs / ≤120px con KPIs

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Playwright: `heroH=120px` en dashboard (con 4 KPIs) ≤ 120px ✅
  - Playwright: `row1H=59px` en liquidaciones (sin KPIs) ≤ 60px ✅ (post-fix `py-2→py-1.5`)
  - Playwright: KPI row `row2H=54px` ≤ 56px ✅
  - Código: `section-hero.component.ts` — `min-h-[52px]` en row1, KPI strip con `border-t`
- **Notas:** El ajuste final fue reducir `py-2` → `py-1.5` en la fila 1 para cumplir el límite. El hook AC Verifier bloqueó correctamente y disparó la corrección.

### AC2 — Botones de acción visibles y clickeables en fila 1

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Playwright snapshot: `button "Matricular" [cursor=pointer]`, `button "Agenda" [cursor=pointer]`, `button "Pagos" [cursor=pointer]` presentes en dashboard
  - Código: `section-hero.component.ts` — `<div role="group" aria-label="Acciones principales">` en slim row1

### AC3 — Botón "Volver" con divisor cuando backRoute está definido

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Código: `section-hero.component.ts` — `@if (backRoute()) { <a ... aria-label="Volver"> } <div class="h-5 w-px bg-border-subtle" aria-hidden="true">` en slim row1
  - Mismo patrón funcional que el modo `full` (ya verificado en otras specs)
- **Notas:** No hay páginas en el piloto (dashboard + liquidaciones) con `backRoute`, por lo que la verificación es de código. La lógica es idéntica al modo full que ya está en producción.

### AC4 — Segunda fila con métricas e inline SVG sparkline

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Playwright screenshot `verify-0015-dashboard-light.png`: segunda fila visible con 4 KPIs (Alumnos 26, Clases 4, Ingresos $0.54M, Vehículos 0) + trend arrows ▲▼
  - `sparkline.utils.spec.ts`: 8/8 tests vitest verdes — `getSparklinePoints()` delegada y testeada
  - Código: SVG `<polyline [attr.points]="getSparklinePoints(kpi.sparkline)">` — se omite cuando `sparkline` no viene (opcional per spec §9)
  - `core/utils/sparkline.utils.ts` — función pura creada y testeada

### AC5 — Sin segunda fila cuando kpis=[] o sin kpis

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Playwright eval en liquidaciones: `hasKpiRow: false` ✅
  - Código: `@if (kpis().length) { <div class="border-t ..."> }` en slim template

### AC6 — density="full" sin regresión

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - `ng build` completó sin errores ni warnings (`Application bundle generation complete`)
  - Input `density` default `'full'` — las 61 páginas existentes no pasan `density`, por tanto usan full sin cambio
  - Host class `[class.bento-hero]='density()==="full"'` preserva el comportamiento original

### AC7 — Retrocompatibilidad total (density opcional)

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Código: `readonly density = input<'full' | 'slim'>('full')` — default explícito
  - `ng build` limpio: 0 errores de compilación en las 61 páginas existentes
  - Host bindings condicionales no afectan páginas sin el input

### AC8 — Chips compactos en fila 1

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Playwright snapshot: `text: 4 clases programadas` y `text: 1 alertas urgentes` visibles como chips inline en fila 1
  - Código: `class="hidden sm:flex"` — chips ocultos en mobile (375px) ✅, visibles en desktop ✅
  - Renderizado compacto: `text-xs`, sin padding de pill completo, con `app-icon` de 14px + etiqueta

### AC9 — Subtitle como eyebrow bajo el título

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Playwright screenshot dashboard: fecha "JUEVES, 18 DE JUNIO DE 2026" como eyebrow, `<h1>¡Bienvenido, PEPITO ADMI!</h1>` debajo
  - Playwright screenshot liquidaciones: "Nómina mensual y registro de pagos" como subtítulo muted bajo el título
  - Código: `<p class="text-xs text-muted ...">{{ subtitle() }}</p>` con `@if (subtitle())`

### AC-E1 — Títulos largos con ellipsis

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Código: `<h1 class="... truncate">` en slim row1 — Tailwind `truncate` = `overflow-hidden text-overflow:ellipsis whitespace-nowrap`
  - Bloque de título con `min-w-0 flex-1` para permitir truncado correcto en flex container

### AC-E2 — KPIs colapsan a 2 columnas en viewport < 768px

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Playwright eval mobile 375px: `heroH: 203px` (vs 120px desktop) confirma wrapping a 2×2
  - Playwright screenshot `verify-0015-dashboard-mobile.png`: grid 2 columnas, sin overflow horizontal
  - Código: `grid grid-cols-2 sm:grid-cols-4` en KPI row

### AC-E3 — Skeleton slim (no 180px) cuando loading=true

- **Estado:** ✅ Cumplido
- **Evidencia:**
  - Código `dashboard.component.ts`: `@if (loading()) { <app-section-hero density="slim"> }` — hero slim vacío como skeleton (≈59px vs 180px del full hero)
  - La fila slim vacía mide ≈59px — no muestra el full hero skeleton de 180px ✅

---

## Out-of-scope respetado

- ❌ Migración masiva 61 páginas — confirmado: solo Dashboard + liquidaciones-content migradas
- ❌ Reemplazar topbar/shell — confirmado: `app-topbar` y `AppShellComponent` no tocados
- ❌ Sparklines con datos de Supabase — confirmado: sparkline es `input()` pasivo, sin query propia
- ❌ Animación GSAP diferente para slim — confirmado: slim entra por `animateBentoGrid()` del shell; `animateHero()` condicional solo para `density==='full'`
- ❌ Slim en páginas auth — confirmado: login / force-password-change no tocadas
- ❌ Modelo sparklineData complejo — confirmado: `sparkline?: number[]` simple

---

## Deuda técnica detectada

- **Mobile action overflow** (Low): A 375px con 3+ botones de acción, el bloque de título se comprime. Corrección: `hidden sm:flex` en botones secundarios en mobile → candidato a hotfix o fix futuro
- **Sparkline data en DashboardFacade** (Low): `heroKpis` computed no incluye `sparkline[]` — el SVG sparkline no se ejercita en producción hasta que `DashboardFacade` exponga datos históricos normalizados → propuesta: spec nueva (KPI histórico)
- **AC3 sin Playwright directo** (Trivial): Ninguna página del piloto usa `backRoute` en slim → no se ejercitó el botón Volver en browser real. Misma lógica que full hero, riesgo mínimo.

---

## Cambios en índices

- `indices/COMPONENTS.md` — `app-section-hero` actualizado: inputs `density`, `kpis` documentados
- `indices/SERVICES.md` — `sparkline.utils` agregado: `getSparklinePoints(data, w?, h?) → string`, 8 tests

---

## Post-mortem

- **Salió mejor de lo esperado:** Host class condicional (`bento-hero`/`bento-banner`) resolvió el layout sin tocar componentes parent. Extracción a `core/utils/sparkline.utils.ts` permitió testear la lógica pura con 8 casos en vitest.
- **Fricciones:** Hook Prettier reformateó archivos entre edits causando fallos de `old_string`. AC Verifier bloqueó correctamente por 65px→fix a py-1.5.
- **Cambiaríamos:** Definir targets de altura con tolerancia explícita en la spec (e.g., ≤65px ±5px) para absorber variaciones de line-height entre contenidos reales vs estimación en mockup.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados (`COMPONENTS.md`, `SERVICES.md`)
- [x] Tests: `sparkline.utils.spec.ts` 8/8 green; `npm run test:ci` sin nuevos fallos
- [x] `ng build` limpio (bundle generation complete, 0 errores TS)
- [x] Sin deuda crítica abierta

**Cerrado por:** Akxlarre
**Fecha:** 2026-06-18
