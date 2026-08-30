# Fix: Cuadratura Diaria — hero con franja de KPIs y dos columnas Ingresos/Egresos
> id: fix-230-m-cuadratura-diaria-hero-con-kpis-y-dos-columnas
> refs: 0004-i-cuadratura-app-like
> status: done
> closed: 2026-08-29
> created: 2026-08-29

## Root Cause
La vista `app-cuadratura-content` cumple el contrato app-like (sin scroll de
página, scroll interno en las cards) pero desperdicia el alto vertical y no deja
ver la cuadratura de un vistazo:

1. **Sin franja de KPIs.** El número que la pantalla existe para mostrar — el
   saldo esperado en caja (apertura + ingresos − egresos) — no está visible sin
   scrollear; vive al pie de un card o dentro del drawer de arqueo. Apertura,
   ingresos y egresos tampoco se ven como métricas.
2. **Ingresos y Egresos apilados en una sola columna** (`.cuadratura-stack`,
   `flex: 3` / `flex: 2` vertical, 3ª iteración de 0004-i). Con Ingresos como
   protagonista alto, "Egresos / Retiros" queda apenas asomando al fondo del
   viewport y obliga a scrollear la celda para verlo. Se leen como dos bloques
   inconexos cuando representan los dos términos de una resta.
3. **Empty state pegado arriba.** `app-empty-state` se renderiza sin wrapper de
   centrado dentro de una celda `.bento-fill` que mide "el resto del viewport"
   (500px+), dejando un hueco vacío enorme debajo — el mismo hazard que
   `visual-system.md` §"Estados vacíos y skeletons dentro de un .bento-fill"
   describe como regla proactiva.

## ACs Afectados
Ninguno — fix autónomo de UX. No cambia inputs/outputs de `app-cuadratura-content`
ni ninguna facade/query/modelo; es reorganización de la misma información ya
disponible como inputs (`fondoInicial`, `totalIngresosHoy`, `totalEgresosHoy`,
`saldoTeorico`, `pagosHoy`, `gastosHoy`).

> **Nota sobre 0004-i:** la 3ª iteración de esa spec eligió deliberadamente
> columna única sobre dos columnas ("sin dividir la pantalla en Ingresos/Egresos").
> Este fix revierte esa decisión puntual — con la franja de KPIs cubriendo el
> resumen, las dos columnas dejan de competir por el alto y Egresos deja de
> quedar oculto. Decisión del owner (Matías) tras revisar el mockup, 2026-08-29.
> El botón "Arqueo y Cierre" sigue siendo solo una acción del hero (no vuelve
> como columna).

## Cambio
- **Archivo principal:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
- **Functional Core (nuevo, exento de Spec Gate):**
  `src/app/core/utils/cuadratura-hero-kpis.utils.ts` + `.spec.ts` — función pura
  `buildCuadraturaHeroKpis()` que ordena/formatea los 4 KPIs. Se extrae para
  testear la decisión sin TestBed (los inputs signal-based de este componente no
  se pueden setear en el entorno de test actual — ver nota en su `.spec.ts`).
- **Qué cambia:**
  1. **Franja de KPIs en el hero.** Se pasa `[kpis]="heroKpis()"` a
     `<app-section-hero density="slim">` (mismo patrón que
     `servicios-especiales-content`). `heroKpis` = computed que delega en
     `buildCuadraturaHeroKpis()`. Los 4 KPIs son la **cuadratura en efectivo**
     (el arqueo físico) y **cuadran entre sí**: `Fondo inicial` +
     `Ingresos del día (efectivo)` (success) − `Egresos del día (efectivo)`
     (warning) = `Saldo esperado en caja`. Los totales por todos los métodos de
     pago siguen en el pie de cada panel. Decisión del owner (2026-08-29). Sin
     datos nuevos: usa `fondoInicial`, `ingresosEfectivoHoy`,
     `totalEgresosEfectivoHoy`, `saldoTeorico`, todos ya cableados en los dos
     wrappers.
  2. **Dos columnas.** `.cuadratura-stack` pasa de `flex-col` a `flex-row` en
     desktop (`lg+`), Ingresos `flex-[3]` / Egresos `flex-[2]`, cada una con su
     scroll interno como hoy. Vuelve a `flex-col` cuando `isDrawerOpen()` o en
     `<lg` (contenedor comprimido), reutilizando el criterio "switch de layout
     por contenedor, no por `lg:` de Tailwind" (spec 0030): se usa
     `isDrawerOpen()` + container query (`@container cuadratura-stack (min-width:
     1200px)`), no breakpoint de viewport. El `container-type` va en un wrapper
     interno, NO en la celda `.bento-fill` (romp­e su size-containment).
  3. **Empty state centrado.** Los dos `<app-empty-state>` (ingresos y egresos)
     se envuelven en `flex-1 flex items-center justify-center` para centrarse en
     el alto disponible de su celda.
  4. **Simetría de los dos paneles** (visible recién al ponerlos lado a lado):
     Egresos recibe el mismo tratamiento que Ingresos — header con ícono `w-10`
     + título + subtítulo ("Retiros y gastos pagados desde la caja."), header de
     columnas fijo (`shrink-0`, visible también con la lista vacía), y footer con
     "Mostrando N egresos" + total en pastilla (tono warning).
  5. **Claridad efectivo vs. todos los métodos en los pies** (decisión del owner,
     2026-08-29): la cuadratura es de efectivo físico, pero los pies de panel
     sumaban todos los métodos sin avisar.
     - **Columna "Método" en Egresos** — cada fila muestra Efectivo (`neutral`) /
       Transferencia / Tarjeta (`info`) vía `app-badge`. Grid pasa a
       `[1fr_Xpx_Ypx_24px]` (motivo · método · monto · borrar); se quita el badge
       de método inline que estaba en la celda "Motivo". `PAYMENT_METHOD_LABELS`
       suma la clave `efectivo: 'Efectivo'` (antes solo mapeaba no-efectivo).
       Ingresos NO la necesita: ya tiene las 4 columnas por método.
     - **"Total Día" → "Total Ingresos"** en el pie de Ingresos.
     - **Pastilla de 2 líneas** en ambos pies: total de todos los métodos
       (prominente) + "en efectivo $Y" (línea chica, secundaria) — Ingresos usa
       `ingresosEfectivoHoy`, Egresos usa `totalEgresosEfectivoHoy` (ambos ya
       cableados). El número de efectivo del hero y el del pie coexisten a
       propósito: glance (hero) vs. detalle (pie).
  7. **Descripción del egreso legible** (reportado por el owner): en la fila de
     Egresos la descripción se truncaba muy pronto porque el ícono + el badge de
     categoría le robaban ancho a la celda `1fr`. Fix: se quita el badge de
     categoría (el ícono de color ya la identifica; su nombre va en
     `title`/`aria-label`) y la descripción pasa de `truncate` a `line-clamp-2`
     (hasta 2 líneas). Fila `items-start` para alinear bien con la descripción
     multilínea.
  6. **Alto de las cards según modo fill-screen** (bug reportado por el owner con
     el drawer de Arqueo abierto): `_bento-grid.scss` solo da alto definido a la
     celda `.bento-fill` dentro de `@container layoutmain (min-width: 1024px)`.
     Cuando un drawer angosta `<main>` a <1024px (fill-screen OFF), `flex: 3/2 1
     0%` en las cards las colapsa a su alto mínimo y deja un hueco enorme abajo
     (era el bug pre-refactor, reaparecía con drawer). Fix: el DEFAULT de
     `.cuadratura-stack-{ingresos,egresos}` pasa a `flex: none` (alto natural, el
     panel scrollea nativo); el `flex: 3/2 1 0%` se aplica **solo** bajo
     `@container layoutmain (min-width: 1024px)`. Los `<app-empty-state>` reciben
     `min-h-50` para no colapsar cuando la card es de alto natural.
- **Sin cambios** en: los dos smart wrappers (`admin-` / `secretaria-contabilidad-cuadratura`),
  facades, modelos, migraciones, `section-hero.component.ts` (ya soporta `kpis`).

## Test de Regresión
- `src/app/core/utils/cuadratura-hero-kpis.utils.spec.ts > buildCuadraturaHeroKpis` ✓
  (orden de los 4 KPIs, labels "(efectivo)" explícitos en los de flujo, cada monto
  en su slot, colores success/warning, el saldo usa el teórico recibido sin
  recalcular, y que los 4 valores cuadran: apertura + ingresos efvo. − egresos
  efvo. = saldo).
