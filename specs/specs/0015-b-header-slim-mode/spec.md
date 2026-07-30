# Spec 0015-b — Header Slim Mode (Section Hero Compacto)

> **Status:** done
> **Created:** 2026-06-18
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Investigación UI 2026-06-18 — comparación con mockup "Header C operativo" de design system

**Persona afectada:** Todos los roles (Admin, Secretaria, Instructor, Alumno)

**Problema que resuelve:**
El `app-section-hero` actual ocupa ≈180px de alto en modo `full` (bento-hero). En páginas con KPIs separados, el bloque hero + bento-squares suma ≈320px antes de llegar al contenido real. En pantallas de resolución media (1280×800, laptops comunes), el usuario ve casi la mitad de la pantalla ocupada solo por el header de sección. Esto empuja el contenido operativo (tablas, agendas, formularios) fuera del viewport inicial.

**Hipótesis de valor:**
Un modo `density="slim"` en el section-hero reduce el bloque header+KPIs a ≈110px (-65%), permitiendo que el contenido operativo sea visible sin scroll en resoluciones estándar.

---

## 2. User Stories

- **US1**: Como admin, quiero que las métricas del dashboard (alumnos, clases, ingresos, vehículos) sean visibles junto al título de la sección sin que ocupen la mitad de la pantalla, para trabajar más eficientemente sin scroll.
- **US2**: Como cualquier usuario, quiero que el header de cada sección sea compacto pero conserve los botones de acción, el botón "Volver" y el contexto (fecha, rol), para no perder información ni acceso a las acciones principales.
- **US3**: Como instructor con pantalla pequeña, quiero que la sección "Mi Horario" muestre la semana sin tener que hacer scroll inicial, para ver mis clases del día de inmediato.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given que `density="slim"` está activado, When se renderiza `app-section-hero`, Then la altura total del componente es ≤ 60px (sin KPIs) o ≤ 120px (con KPIs integrados), medida en Playwright.
- **AC2**: Given `density="slim"` con `actions` no vacío, When se renderiza el hero, Then todos los botones de acción son visibles y clickeables en la fila 1.
- **AC3**: Given `density="slim"` con `backRoute` definido, When se renderiza el hero, Then el botón "Volver" aparece a la izquierda de la fila 1 con un divisor vertical.
- **AC4**: Given `density="slim"` con `kpis` no vacío, When se renderiza el hero, Then se muestra una segunda fila con métricas + sparkline inline (SVG simple).
- **AC5**: Given `density="slim"` con `kpis=[]` o sin kpis, When se renderiza, Then NO se muestra la segunda fila de KPIs (sin espacio vacío).
- **AC6**: Given `density="full"` (default), When se renderiza el hero, Then el comportamiento es idéntico al actual (sin regresión).
- **AC7**: Given cualquier página del proyecto que usa `app-section-hero` sin el input `density`, When se carga la página, Then el hero se comporta exactamente igual que antes (retrocompatible, `density` es opcional con default `'full'`).
- **AC8**: Given `density="slim"` con `chips` definidos, When se renderiza, Then los chips se muestran como íconos+número inline en la fila 1 (versión compacta), no como pills de texto completo.
- **AC9**: Given `density="slim"`, When el subtitle está definido, Then se muestra como eyebrow debajo del título (texto muted xs), no se omite.

### Edge cases obligatorios

- **AC-E1**: Given `density="slim"` con un título muy largo (> 50 chars), When se renderiza, Then el título usa `text-overflow: ellipsis` y no desborda el layout flex.
- **AC-E2**: Given `density="slim"` con 4 KPIs y sparklines, When el viewport es < 768px, Then los KPIs colapsan a 2 columnas (grid responsive) sin overflow horizontal.
- **AC-E3**: Given que el dashboard usa `@if loading()` para el hero, When `loading=true`, Then el skeleton del hero en modo slim muestra solo una barra (no el full hero skeleton de 180px).

---

## 4. Out of scope

- ❌ Migración masiva de las 61 páginas existentes a `density="slim"` (se hace progresivamente, esta spec solo agrega la capacidad)
- ❌ Reemplazar el topbar global (`app-topbar`) ni el shell (`app-shell`)
- ❌ Sparklines con datos históricos reales desde Supabase (en esta spec son datos que pasan como input, sin query propia)
- ❌ Animación GSAP diferente para el modo slim (usa la misma que `animateBentoGrid`, sin cambio)
- ❌ Modo slim en páginas de auth (login, force-password-change) — esas páginas no usan bento-grid
- ❌ Rediseño del `SectionHeroKpi` model con sparklineData complejo — dato simple: array de 6-8 números

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante. Las fixes de homogeneidad (fix-021, fix-022) son complementarias pero no requisito.

### Capacidades del proyecto que se asumen existentes
- `app-section-hero` estable en `shared/components/section-hero/`
- `SectionHeroAction`, `SectionHeroChip` en `core/models/ui/section-hero.model.ts`
- `GsapAnimationsService` disponible con `animateBentoGrid()`
- Tailwind v4 + tokens `--color-*`, `--bg-*` funcionales

### Capacidades nuevas requeridas
- Input `density: 'full' | 'slim'` en `SectionHeroComponent`
- Input `kpis: SectionHeroKpi[]` en `SectionHeroComponent` (nuevo model)
- Interface `SectionHeroKpi` en `core/models/ui/section-hero.model.ts`

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna (puramente UI)
- Modelos UI nuevos:
  ```ts
  // Agregar en core/models/ui/section-hero.model.ts
  export interface SectionHeroKpi {
    id: string;
    label: string;
    value: string | number;
    trend?: number;        // positivo = verde, negativo = rojo
    trendLabel?: string;
    sparkline?: number[];  // 6-8 puntos normalizados 0-1 para el SVG
  }
  ```
- RLS requerida: ninguna

---

## 7. UX y flujos (preliminar)

- Pantallas afectadas: `app-section-hero` (shared) — todas las páginas que opten por `density="slim"`
- Flujo principal: componente recibe `density="slim"` + opcionalmente `[kpis]` → renderiza 1 fila (44px) o 2 filas (≈110px)
- Estados especiales:
  - Loading: skeleton inline de 1 fila (no el hero grande)
  - Sin KPIs: solo fila 1, sin segunda fila
  - Con `backRoute`: fila 1 inicia con botón volver + divisor

---

## 8. Métricas de éxito post-launch

- En dashboard con `density="slim"`: contenido principal visible sin scroll en viewport 1280×800
- Zero regresiones visuales en páginas que usan `density="full"` (verificar con Playwright)

---

## 9. Notas / decisiones abiertas (RESUELTAS 2026-06-18)

- [x] **Scope:** PILOTO — `DashboardComponent` + `liquidaciones-content`. Migración masiva diferida hasta validar en producción.
- [x] **KPIs en hero (opción A):** Los KPIs del dashboard pasan como `[kpis]` al hero slim; los `bento-square` separados se eliminan del grid del dashboard
- [x] **Default del componente:** `density="slim"` será el nuevo default al finalizar la migración. Durante la migración se mantiene `"full"` como default para no romper nada. El `"full"` queda como opt-out explícito para onboarding/bienvenida futura.
- [x] **Sparkline:** Dato opcional `sparkline?: number[]` (6-8 puntos 0-1). Si no viene, se omite el SVG. Trend (▲▼ número) siempre se muestra si hay `trend`.
- [ ] Stub pages (14 Tier A sin section-hero): se incluyen en scope pero se implementan como último grupo — requieren reescritura completa de bento-grid

---

## Changelog

- 2026-06-18 — draft inicial por Akxlarre
