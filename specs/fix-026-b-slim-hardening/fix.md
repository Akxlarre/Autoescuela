# Fix: Slim Mode Hardening — Pre-requisito migración masiva density="slim"
> id: fix-026-b-slim-hardening
> refs: 0015-header-slim-mode
> status: done
> closed: 2026-06-18
> created: 2026-06-18

## Root Cause

La spec 0015 implementó el piloto `density="slim"` en Dashboard + liquidaciones-content y
pasó todos los ACs. Sin embargo, tres deudas técnicas impiden el rollout masivo a las ~61
páginas restantes de forma segura:

1. **Mobile overflow**: A 375px, 3+ botones de acción en row1 comprimen el bloque de título
   a ancho cero porque no hay mecanismo para ocultar acciones secundarias en mobile.
2. **Skeleton no estandarizado**: El patrón de loading en slim se hace con `@if (loading())`
   externo en cada página (dashboard lo hace así), pero las 61 páginas necesitan un patrón
   declarativo uniforme con shimmer visible — actualmente el slim vacío no da feedback visual.
3. **Sin canon documentado**: No existe un checklist/patrón de referencia para migrar una
   página de `density="full"` a `density="slim"`, lo que haría el masivo propenso a errores.

## ACs Afectados

- AC-E2 (spec 0015): KPIs colapsan a 2 columnas en < 768px sin overflow — cumplido,
  pero el título en row1 sí overflowea por los botones de acción (deuda adyacente).
- AC-E3 (spec 0015): Skeleton slim ≈59px — cumplido estructuralmente, pero sin shimmer
  visual (skeleton invisible = posible flash de contenido vacío).

## Cambios

### T1 — hiddenOnMobile en SectionHeroAction + slim template

- **Archivo:** `src/app/core/models/ui/section-hero.model.ts`
- **Qué cambia:** Agregar `hiddenOnMobile?: boolean` a la interfaz `SectionHeroAction`

- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts`
- **Qué cambia:** En el `@for` de acciones del slim template, aplicar
  `[class.hidden]="action.hiddenOnMobile" [class.sm:inline-flex]="action.hiddenOnMobile"`
  (equivalente a `hidden sm:inline-flex` condicional)

- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
- **Qué cambia:** Marcar "Agenda" y "Pagos" con `hiddenOnMobile: true` en el array de acciones

### T2 — loading input + skeleton shimmer interno en slim

- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts`
- **Qué cambia:** Agregar `readonly loading = input<boolean>(false)`. En el template slim:
  `@if (loading()) { skeleton row1 con app-skeleton-block } @else { contenido real }`
  El skeleton muestra: circle 32px (icon placeholder) + dos text bars (eyebrow + title) +
  rect 100px (action placeholder). Si `kpis().length > 0`, agrega skeleton KPI strip.

- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
- **Qué cambia:** Reemplazar el `@if (loading())` externo del hero por `[loading]="loading()"`
  en el `app-section-hero` existente. Eliminar el segundo hero del bloque loading.

### T3 — Canon de migración documentado

- **Archivo:** `docs/SLIM-MIGRATION-GUIDE.md` (nuevo)
- **Qué cambia:** Checklist + patrones de referencia para migrar una página a slim mode.
  Incluye: animaciones (sin cambio — usa animateBentoGrid), loading (usar `[loading]`),
  acciones mobile (usar `hiddenOnMobile`), KPIs opcionales, backRoute, casos borde.

## Test de Regresión

- `ng build` limpio tras los cambios (0 errores TS)
- `npm run test:ci` sin regresiones (suite completa verde)
- Playwright manual: dashboard desktop + mobile 375px → título visible, skeleton shimmer
  visible antes de cargar datos, botones secundarios ocultos en mobile

## Notas de animaciones (para referencia en el masivo)

El slim hero entra por `animateBentoGrid()` del shell — no requiere cambio.
`animateHero()` ya está condicionado a `density() === 'full'` en `ngAfterViewInit`.
`[appBentoReveal]` (fix-018) aplica el anti-flash antes del stagger — compatible con slim.
**No se requiere ningún cambio de animaciones para la migración masiva.**
