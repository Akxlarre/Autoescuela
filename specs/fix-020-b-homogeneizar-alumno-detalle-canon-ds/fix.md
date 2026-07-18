# Fix: Homogeneizar alumno-detalle al canon del Design System
> id: fix-020-b-homogeneizar-alumno-detalle-canon-ds
> refs: fix-018-refactor-animaciones-entrada-bento-premium, indices/UI-HOMOGENEITY-AUDIT.md
> status: done
> created: 2026-06-15

## Root Cause
`admin-alumno-detalle` se siente distinto al resto de páginas porque, aunque su hero ya es
el `app-section-hero` canónico aplicado directo (`class="bento-hero"`), su cuerpo diverge
del Design System en dos ejes:

1. **Entrada doble del hero (Tier D del audit):** no pasa `[animateOnInit]="false"` al
   `app-section-hero`, así que el hero anima dos veces (su propio `animateHero` + el stagger
   del grid). El canon es una sola entrada vía `animateBentoGrid`.
2. **Tipografía ad-hoc en vez de clases semánticas del DS:** las cards bespoke usan
   `text-[10px]/[11px] font-bold uppercase tracking-*` (micro-labels) y `kpi-value text-3xl`
   en lugar de las clases semánticas `.kpi-label` / `.kpi-value`. Viola la regla
   "Clases Semánticas vs Tailwind Genérico" de `architecture.md`. Esto rompe la coherencia
   tipográfica con las páginas de listado/dashboard que sí usan los componentes/clases del DS.

(La diferencia de *contenido* —progreso de un alumno vs KPIs+tabla— es legítima por ser una
página de detalle; el objetivo NO es igualar la estructura sino usar los mismos ladrillos DS.)

## ACs Afectados
Ninguno — homogeneización visual autónoma (continuación del UI-HOMOGENEITY-AUDIT, Tier C/D).

## Cambio
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`
- **Qué cambia:**
  1. `[animateOnInit]="false"` en el `app-section-hero` → entrada única (canon).
  2. Micro-labels uppercase ad-hoc (`text-[10px]/[11px] font-bold uppercase tracking-*`) →
     `.kpi-label` (la clase semántica del DS para etiquetas de métrica).
  3. Limpiar overrides ad-hoc sobre `.kpi-value` cuando rompan la escala del DS.

## Test de Regresión
- ✅ `npm run build` verde (chunk `admin-alumno-detalle-component` compila).
- ✅ Verificación visual en vivo (Playwright, screenshots antes/después): layout intacto,
  labels renderizando con `.kpi-label`, entrada única del hero. Sin regresión de layout.

## Hallazgo relevante
La página **ya era bastante coherente con el DS** visualmente (hero estándar, cards tintadas,
barras de progreso, labels uppercase). La divergencia real era de **código** (tipografía
ad-hoc) + la **entrada doble**, no una ruptura visual grosera. Por eso el cambio visible es
sutil: el valor está en (a) entrada única limpia y (b) código canónico que se mantiene
consistente si el DS evoluciona. No se tocaron `.kpi-value` (su `text-3xl` es un cap de
tamaño razonable para cards inline, no una ruptura del DS).

> status: listo para `/fix-close`. Rollout a otras páginas de detalle (instructor/clase-detail,
> instructor/ficha, relator/alumno-detail) pendiente si se quiere extender el canon.
