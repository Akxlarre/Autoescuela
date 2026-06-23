# Guía de Migración a `density="slim"` (Section Hero)

> Versión: hotfix-011 | Fecha: 2026-06-19  
> Para el rollout masivo de `density="slim"` en las ~61 páginas del sistema.

## ¿Por qué slim?

`density="full"` ocupa ~180px (bento-hero gradient). `density="slim"` ocupa ~52px de row1
+ ~56px opcionalmente para KPIs. Ahorra espacio vertical en páginas que no necesitan la
superficie de marca completa (listados, formularios de gestión, pantallas secundarias).

---

## Checklist de migración (por página)

### 1. Cambiar el atributo en el template

```html
<!-- ANTES -->
<app-section-hero
  density="full"
  ...
/>

<!-- DESPUÉS -->
<app-section-hero
  density="slim"
  [loading]="loading()"
  [actions]="heroActions()"
  ...
/>
```

> ⚠️ **`[actions]` es un input required.** Si la página no tiene acciones, pasar `[actions]="[]"` explícitamente.
> Omitirlo causa error de compilación NG8008.

### 2. Eliminar el `@if` externo de loading (si existe)

El patrón antiguo duplicaba el hero para el estado de carga:

```html
<!-- PATRÓN VIEJO — eliminar -->
@if (loading() && !datos()) {
  <app-section-hero density="slim" [title]="'...'" [actions]="[]" />
} @else if (datos()) {
  <app-section-hero density="slim" [loading]="false" ... />
}

<!-- PATRÓN NUEVO — un solo hero -->
<app-section-hero
  density="slim"
  [loading]="loading()"
  [title]="title()"
  ...
/>
```

### 3. Agregar `[loading]` desde el Facade

```typescript
// En el Smart Component
readonly loading = computed(() => this.facade.isLoading());
```

### 4. Acciones — siempre visibles, el layout se adapta solo

**No uses `hiddenOnMobile: true`** en las acciones del hero slim. El componente maneja el
responsive automáticamente:

- **`< sm` (< 640px)**: row1 se parte en 2 filas — título arriba, botones + chips abajo con `flex-wrap`
- **`sm+` (≥ 640px)**: fila única — título a la izquierda, botones a la derecha

Con cualquier cantidad de botones, el slot derecho wrappea naturalmente sin comprimir el título.

```typescript
// CORRECTO — sin hiddenOnMobile
readonly heroActions = computed((): SectionHeroAction[] => [
  { id: 'primary',   label: 'Acción principal',   icon: 'plus',    primary: true  },
  { id: 'secondary', label: 'Acción secundaria',  icon: 'calendar', primary: false },
  { id: 'tertiary',  label: 'Otra acción',         icon: 'dollar-sign', primary: false },
]);
```

### 5. KPIs opcionales

Si la vista tiene métricas relevantes, exponer un array `SectionHeroKpi[]` al hero:

```typescript
readonly heroKpis = computed((): SectionHeroKpi[] => [
  { id: 'total', label: 'Total', value: this.facade.count() },
  { id: 'activos', label: 'Activos', value: this.facade.activeCount(), color: 'success' },
]);
```

```html
<app-section-hero density="slim" [kpis]="heroKpis()" ... />
```

Sin `[kpis]`, el hero muestra solo la row1 (sin segunda fila).

### 6. Botón Volver (opcional)

Para páginas de detalle o sub-secciones:

```html
<app-section-hero density="slim" backRoute="/app/admin/alumnos" backLabel="Base de Alumnos" ... />
```

---

## Animaciones — no requiere cambio

| Mecanismo | Aplica a slim | Acción requerida |
|-----------|--------------|-----------------|
| `animateBentoGrid()` | ✅ Sí — entrada stagger del shell | Ninguna |
| `animateHero()` | ❌ No — condicionado a `density === 'full'` | Ninguna |
| `[appBentoReveal]` (fix-018) | ✅ Sí — anti-flash antes del stagger | Ninguna |

El slim hero entra como cualquier otra celda del bento-grid. No necesita `animateHero()`.
Si el Smart Component llama `animateHero()` explícitamente, se puede eliminar.

---

## Host class automática

`SectionHeroComponent` aplica la clase host correcta automáticamente:

- `density="full"` → clase host `bento-hero`
- `density="slim"` → clase host `bento-banner`

**No agregar manualmente `class="bento-hero"` ni `class="bento-banner"` al elemento `<app-section-hero>`.**

---

## Skeleton interno (fix-026)

Con `[loading]="true"`, el componente muestra automáticamente:
- **Row 1**: circle 32px + dos barras de texto + rect de acción (shimmer via `app-skeleton-block`)
- **KPI strip**: grid de barras si `kpis().length > 0`

El skeleton respeta el mismo alto (`min-h-[52px]`) que el contenido real → cero Layout Shift.

---

## Transformar KPI cards al KPI strip (patrón clave)

Cuando la página tiene `app-kpi-card-variant` como celdas `bento-square` separadas del hero,
moverlos al `[kpis]` del hero slim elimina una fila completa del bento-grid y centraliza los
datos de contexto junto al título.

### Antes (patrón viejo — 3 celdas separadas)

```html
<div class="bento-banner">
  <app-section-hero density="slim" ... />
</div>

<div class="bento-square">
  <app-kpi-card-variant [value]="kpis().total" label="Total" icon="..." [loading]="isLoading()" />
</div>
<div class="bento-square">
  <app-kpi-card-variant [value]="kpis().pagados" label="Pagados" ... />
</div>
```

### Después (patrón nuevo — hero + KPI strip)

```html
<app-section-hero
  density="slim"
  [kpis]="heroKpis()"
  [loading]="isLoading()"
  ...
/>
```

```typescript
// En el Smart Component o en el Dumb Component que recibe el input de KPIs
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';

protected readonly heroKpis = computed((): SectionHeroKpi[] => {
  const k = this.kpis(); // signal o input de KPIs
  return [
    { id: 'total',   label: 'Total',   value: k.total,   color: 'default' },
    { id: 'pagados', label: 'Pagados', value: k.pagados, color: 'success' },
    { id: 'error',   label: 'Errores', value: k.errores, color: 'error'   },
  ];
});
```

### Guía de mapeo de campos

| `app-kpi-card-variant` | `SectionHeroKpi`     | Notas |
|------------------------|----------------------|-------|
| `[value]`              | `value`              | `string \| number` — formatea el número antes si es CLP |
| `[label]`              | `label`              | Igual |
| `[icon]`               | `icon`               | Igual (kebab-case Lucide) |
| `[color]`              | `color`              | `'default'\|'success'\|'warning'\|'error'` — igual |
| `[prefix]`             | `prefix`             | Igual |
| `[suffix]`             | `suffix`             | Igual |
| `[trend]`              | `trend`              | Igual — positivo=verde▲, negativo=rojo▼ |
| `[progressPercent]`    | _(no disponible)_    | El KPI strip no tiene barra de progreso |
| `[subValue]`           | `trendLabel`         | Usar como texto secundario junto al trend |
| `[loading]`            | `[loading]` en hero  | Un solo input en el `app-section-hero`, no por KPI |

### Valores CLP — formatear antes de pasar

El KPI strip solo hace interpolación, no formatea números. Para montos en CLP:

```typescript
import { formatCLP } from '@core/utils/formatters'; // si existe, o inline

{ id: 'nomina', label: 'Total Nómina', value: formatCLP(k.totalNomina) }
// → muestra "$ 1.250.000"
```

### Eliminar después de migrar

- Los `<div class="bento-square">` con `app-kpi-card-variant`
- `KpiCardVariantComponent` de los `imports: []` del componente (si ya no se usa en otro lugar)
- El `viewChild` de `kpiGrid` y su `animateBentoGrid()` en `ngAfterViewInit` (si aplica)

---

## Casos borde

| Caso | Solución |
|------|----------|
| Página sin Facade aún | Pasar `[loading]="false"` (hardcoded) mientras se implementa el Facade |
| Título siempre disponible (estático) | No necesita `[loading]` — omitir o pasar `false` |
| Página con `backClickable` (papelera) | Compatible — `backClickable` funciona en ambos modos |
| Página con chips dinámicos | Los chips se pasan igual — `[chips]="heroChips()"` |

---

## Reglas de posicionamiento del hero (hotfix-011)

### OBLIGATORIO: hero como hijo directo del bento-grid

`app-section-hero` debe ser **hijo directo** del `<div class="bento-grid">`.
**No envolver** en `<div class="bento-hero">` ni en ningún otro contenedor.

```html
<!-- ✅ CORRECTO -->
<div class="bento-grid" appBentoGridLayout>
  <app-section-hero density="slim" ... />
  <div class="bento-banner card"> ... </div>
</div>

<!-- ❌ INCORRECTO — wrapper bento-hero manual -->
<div class="bento-grid" appBentoGridLayout>
  <div class="bento-hero">
    <app-section-hero density="slim" ... />
  </div>
  <div class="bento-banner card"> ... </div>
</div>
```

El host de `app-section-hero` aplica automáticamente `bento-hero` (full) o `bento-banner` (slim)
via `@HostBinding`. Añadir el wrapper manualmente rompe el grid y desalinea la posición del hero
entre páginas.

### KPIs condicionales — retornar array vacío

Cuando los KPIs solo tienen sentido si hay un recurso seleccionado (ej: curso activo, vehículo,
período), retornar `[]` desde el computed cuando no aplica. El hero slim simplemente no renderiza
la segunda fila.

```typescript
// ✅ CORRECTO — array vacío cuando no hay contexto
protected readonly heroKpis = computed((): SectionHeroKpi[] => {
  if (!this.facade.selectedCursoId()) return [];
  return [
    { id: 'total',      label: 'Total alumnos', value: this.facade.kpis().totalAlumnos, icon: 'users' },
    { id: 'aprobados',  label: 'Aprobados',     value: this.facade.kpis().aprobados,    icon: 'check-circle', color: 'success' },
    { id: 'reprobados', label: 'Reprobados',    value: this.facade.kpis().reprobados,   icon: 'x-circle',     color: 'error'   },
    { id: 'pct',        label: '% Aprobación',  value: this.facade.kpis().pctAprobacion, icon: 'trending-up', suffix: '%'      },
  ];
});
```

### Contenido proyectado (ng-content) — extraer a bento-banner toolbar

`density="full"` soporta `<ng-content>` dentro del hero (aparece sobre el gradiente).
`density="slim"` **no** tiene slot de contenido proyectado.

Si el hero original proyectaba controles custom (navegador de mes, buscador, picker), extraerlos
a un elemento `bento-banner card` independiente **después** del hero:

```html
<!-- ✅ PATRÓN SLIM con controles custom -->
<div class="bento-grid" appBentoGridLayout>
  <!-- Hero: solo identidad de página -->
  <app-section-hero
    density="slim"
    [animateOnInit]="false"
    [loading]="isLoading()"
    title="Historial de Cuadraturas"
    icon="calendar"
    [backRoute]="backRoute()"
    [backLabel]="backLabel()"
  />

  <!-- Toolbar: controles que antes vivían en ng-content del hero -->
  <div class="bento-banner card px-4 py-2.5 flex items-center justify-between relative overflow-visible">
    <!-- navegador de mes / buscador / picker -->
    <div class="flex items-center border border-border-subtle rounded-xl overflow-hidden">
      <button class="px-3 py-2 text-text-secondary hover:bg-subtle border-0 bg-transparent"
        (click)="mesAnterior.emit()">
        <app-icon name="chevron-left" [size]="16" />
      </button>
      <span class="text-sm font-bold px-4 text-text-primary uppercase">{{ mesLabel() }}</span>
      <button class="px-3 py-2 text-text-secondary hover:bg-subtle border-0 bg-transparent"
        (click)="mesSiguiente.emit()">
        <app-icon name="chevron-right" [size]="16" />
      </button>
    </div>
    <!-- botón de exportación con dropdown posicionado relativo al toolbar -->
    <button type="button" class="... relative" (click)="exportMenuOpen.set(!exportMenuOpen())">
      <app-icon name="download" [size]="15" />
      Exportar
    </button>
    @if (exportMenuOpen()) {
      <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
      <div class="export-menu absolute top-12 right-0 z-20"> ... </div>
    }
  </div>

  <!-- Contenido principal -->
  <div class="bento-banner overflow-hidden"> ... </div>
</div>
```

**Restyling del toolbar:** Los controles que antes usaban colores blancos sobre gradiente
(`text-white`, `bg-white/10`, `border-white/20`) deben cambiarse a tokens neutrales:
`text-text-secondary`, `hover:bg-subtle`, `border-border-subtle`.
