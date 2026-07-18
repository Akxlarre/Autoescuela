# Plan Técnico — Spec 0015-b Header Slim Mode

> Generado: 2026-06-18 | Scope piloto: DashboardComponent + liquidaciones-content

---

## Contexto clave descubierto

- `DashboardFacade.data()` expone `KpiModel[]` con: `id, label, value, trend, trendSuffix, icon, color, prefix, suffix, subValue, accent`
- `DashboardComponent` tiene 4 `bento-square` de KPIs como celdas hermanas del hero en el bento-grid
- `liquidaciones-content` usa `app-section-hero` sin KPIs — solo título, acciones, back
- `app-section-hero` host class `bento-hero` es ESTÁTICA hoy → hay que hacerla condicional para que slim no herede `min-height: 180px`
- `section-hero.model.ts` ya tiene `SectionHeroAction` y `SectionHeroChip` → agregar `SectionHeroKpi` ahí mismo

---

## Archivos a tocar

| Archivo | Tipo de cambio |
|---|---|
| `core/models/ui/section-hero.model.ts` | Agregar interface `SectionHeroKpi` |
| `shared/components/section-hero/section-hero.component.ts` | Inputs `density`/`kpis` + template slim + host class condicional |
| `features/dashboard/dashboard.component.ts` | Eliminar 4 bento-squares, agregar `[density]="'slim'"` + `[kpis]="heroKpis()"` |
| `shared/components/liquidaciones-content/liquidaciones-content.component.ts` | Agregar `[density]="'slim'"` |

---

## Paso 1 — Model

```ts
// section-hero.model.ts — agregar al final
export interface SectionHeroKpi {
  id: string;
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  trend?: number;          // positivo=verde, negativo=rojo
  trendLabel?: string;
  sparkline?: number[];    // 6-8 puntos 0-1 para SVG polyline (opcional)
  color?: 'default' | 'success' | 'warning' | 'error';
  icon?: string;
}
```

---

## Paso 2 — SectionHeroComponent

### Host class condicional
```ts
host: {
  class: 'block min-h-0',
  '[class.bento-hero]': 'density() === "full"',
  style: 'view-transition-name: section-hero',
  '[attr.title]': 'null',
}
```

### Nuevos inputs
```ts
readonly density = input<'full' | 'slim'>('full');
readonly kpis    = input<SectionHeroKpi[]>([]);
```

### Template — estructura slim (NEW)
La condición principal es `@if (density() === 'slim') { ... } @else { ... (full actual) }`

**Slim layout:**
```
┌────────────────────────────────────────────────────────┐
│ [← Volver] [icon 32px] [eyebrow / title] [chips] [actions] │
├────────────────────────────────────────────────────────┤  ← solo si kpis.length
│  [KPI1 label/val/trend/sparkline] │ [KPI2] │ [KPI3] │  │
└────────────────────────────────────────────────────────┘
```

Clases CSS slim:
- Contenedor: `rounded-lg border border-border-subtle bg-surface`
- Fila 1: `flex items-center gap-3 px-4 py-2.5 min-h-[52px]`  
- Divisor back: `w-px h-5 bg-border-subtle shrink-0`
- Título: `text-base font-semibold text-primary leading-tight`
- Eyebrow: `text-[11px] uppercase tracking-wide text-muted` (encima del título)
- Fila KPIs: `border-t border-border-subtle grid` con `repeat(auto-fit, minmax(110px, 1fr))`
- Celda KPI: `px-4 py-2 flex items-center gap-3 border-r border-border-subtle last:border-r-0`
- KPI value: `text-lg font-semibold text-primary`
- KPI label: `text-[11px] uppercase tracking-wide text-muted`
- Trend positivo: `text-state-success text-[11px]`
- Trend negativo: `text-state-error text-[11px]`

### Sparkline SVG (método auxiliar)
```ts
getSparklinePoints(data: number[], w = 40, h = 20): string {
  if (data.length < 2) return '';
  return data
    .map((v, i) => `${(i / (data.length - 1)) * w},${(1 - v) * h}`)
    .join(' ');
}
```

---

## Paso 3 — DashboardComponent

1. Agregar `heroKpis` computed que mapea `KpiModel[]` → `SectionHeroKpi[]`:
```ts
readonly heroKpis = computed((): SectionHeroKpi[] =>
  this.kpis().map(k => ({
    id: k.id,
    label: k.label,
    value: k.value,
    prefix: k.prefix,
    suffix: k.suffix,
    trend: k.trend,
    trendLabel: k.trendLabel,
    color: k.color,
    icon: k.icon,
  }))
);
```

2. En el template:
   - `app-section-hero`: agregar `[density]="'slim'"` y `[kpis]="heroKpis()"`
   - Eliminar los 4 `<div class="bento-square"><app-kpi-card-variant ...></div>`
   - Los bento-squares de loading skeleton de KPIs también se eliminan

3. `KpiCardVariantComponent` ya no se usa en dashboard → quitar del `imports[]`

---

## Paso 4 — liquidaciones-content

Solo agregar `[density]="'slim'"` al `app-section-hero`. Sin cambios de KPIs.
Remover `class.force-compact` si queda redundante con el nuevo slim.

---

## Consideraciones de borde

- **Loading state del dashboard**: cuando `loading()=true`, el hero slim muestra skeleton inline en la fila de KPIs (no el hero skeleton grande). El título sí muestra el fallback `"¡Bienvenido, Pepito!"` como hoy.
- **Chips en slim**: se renderizan como íconos + número (versión condensada). El pill de texto largo no cabe en slim.
- **`animateOnInit`**: en slim siempre `false` → entra por `animateBentoGrid` del shell.
- **GSAP `animateHero`**: no se llama en slim — no hay `cardRef` en esa rama.

---

## Tests requeridos

| Qué | Dónde | Razón |
|---|---|---|
| `getSparklinePoints()` con datos válidos, 0 puntos, 1 punto | `section-hero.component.spec.ts` | Lógica que puede fallar (edge cases) |
| `heroKpis()` mapeo completo (con y sin trend/prefix/suffix) | `dashboard.component.spec.ts` | computed() con transformación de datos |
