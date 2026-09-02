# Fix: El filtro de fechas no afecta la pestaña Rentabilidad + UX del filtro en Reportes Contables

> id: fix-237-m-conectar-filtro-mes-rentabilidad-cursos
> status: in-progress
> created: 2026-09-02
> refs: ASG-i-004 (specs/assignments/ASG-i-004-conectar-filtro-mes-rentabilidad-cursos.md)

## Root Cause

[Heredado de ASG-i-004, a confirmar]: Detectado durante QA visual de `0003-i-app-like-reportes-contables`.
En `/admin/contabilidad/reportes` y `/secretaria/contabilidad/reportes`, cambiar el rango de fechas y
hacer clic en "Aplicar" actualiza Hero, Categorías, Evolución Mensual, Detalle Diario y Gastos Fijos —
pero **la pestaña "Rentabilidad" no cambia nunca**.

Causa raíz (confirmada por lectura de código):

1. **Rentabilidad es mock.** `rentabilidad-cursos.component.ts` tiene `datosRentabilidad` como
   `signal<RentabilidadCurso[]>([...])` con 4 filas **hardcodeadas** (Clase B, Profesional, SENCE,
   Psicotécnico) y `mesActual` es un `computed()` sobre `new Date()` — nunca recibe el rango ni datos
   reales. El componente no tiene ningún `input()`; `reportes-contables-content.component.ts` lo
   instancia con `<app-rentabilidad-cursos />` sin pasar nada.
2. **No existe el dato "gastos directos por tipo de curso" en BD.** `expenses` tiene `category`
   (`fuel`, `rent`, `materials`, …) pero ningún campo que atribuya el gasto a un `license_group` /
   tipo de curso. Los *ingresos* por tipo de curso sí se pueden calcular (ya se agrupan por
   `license_group` en `computeIngresosCategoria`).

Bugs de UX del filtro reportados por el dueño en la misma pantalla (mismo fix):

3. **Botón "Aplicar" innecesario.** El dueño quiere que el reporte se recargue automáticamente al
   cambiar el filtro, sin un paso extra de confirmación.
4. **Al aplicar, el contenido inferior desaparece en vez de mantenerse.** El panel de Categorías y el
   panel único de tabs están envueltos en `@if (!isLoading())` en el template. `aplicarFiltros()` del
   Facade hace `this._isLoading.set(true)` → esas secciones se desmontan por completo (no muestran
   skeletons; quedan en blanco) hasta que llega la respuesta. Viola el patrón SWR
   (`.claude/rules/swr-pattern.md`): "Nunca mostrar skeleton si ya tenemos datos cacheados" — con más
   razón no dejarlo en blanco.

## Decisiones (confirmadas con el dueño, 2026-09-02)

- **Rentabilidad = ingresos reales + gastos directos estimados por prorrateo** (sin cambio de modelo
  de datos; es una estimación explícita, no exacta).
- **Prorrateo híbrido:**
  - **Bencina (`fuel`) + Reparaciones (`repair`)** del período → se reparten entre tipos de curso
    según **nº de clases prácticas realizadas** de cada tipo (Clase B y Profesional consumen
    vehículo; psicotécnico / singulares casi no).
  - **Materiales (`materials`)** del período → se reparten según **participación en ingresos** de cada
    tipo de curso.
  - **Gastos fijos NO entran** (arriendo, sueldos, servicios, seguros, aseo, otros).
  - **Pagos a instructores NO entran** en v1 (se descartó la opción de sumar
    `instructor_advances` + `instructor_monthly_payments` al pool).
- **Auto-aplicar:** se elimina el botón "Aplicar". Los rangos preset ("Este mes", "Mes pasado", …)
  recargan al instante al seleccionarlos. El rango "Personalizado" recarga solo cuando **Desde y
  Hasta** están ambas puestas y `desde <= hasta`.
- **SWR en el cambio de filtro:** recargar el reporte al cambiar el filtro es un **refresco
  silencioso** — los datos previos quedan visibles hasta que llegan los nuevos. Nada se desmonta ni
  parpadea a skeleton (el skeleton completo solo en la primera carga, sin datos previos).

## ACs de Regresión

- **AC-1:** En `/admin/contabilidad/reportes` y `/secretaria/contabilidad/reportes`, cambiar el rango
  de fechas actualiza la pestaña **Rentabilidad** igual que las demás secciones (ingresos, gastos
  estimados, margen y % recalculados para el rango).
- **AC-2:** La columna "Ingresos" de Rentabilidad por tipo de curso coincide con los ingresos reales
  del período agrupados por tipo de curso (misma fuente que "Ingresos por Categoría", sin desglose
  por sede).
- **AC-3:** "Gastos Directos" de cada fila = (share de `fuel`+`repair` por nº de clases prácticas del
  tipo) + (share de `materials` por participación en ingresos). La fila TOTAL suma exactamente
  `fuel`+`repair`+`materials` del período (sin pérdida ni doble conteo por redondeo). Gastos fijos y
  pagos a instructores NO se incluyen.
- **AC-4:** El encabezado de mes/período de la pestaña Rentabilidad refleja el rango del filtro
  (`filtros()`), no la fecha de hoy.
- **AC-5:** Un tipo de curso sin clases prácticas en el período (p. ej. Psicotécnico) recibe 0 de
  `fuel`+`repair` y solo su share de `materials`; no divide por cero ni muestra `NaN`/`Infinity`.
- **AC-6:** El botón "Aplicar" ya no existe en el template. Seleccionar un rango preset recarga el
  reporte automáticamente.
- **AC-7:** En rango "Personalizado", el reporte recarga automáticamente en cuanto Desde y Hasta
  están ambas definidas y `desde <= hasta`; no dispara queries con una sola fecha o con rango
  invertido.
- **AC-8:** Al recargar por cambio de filtro (ya habiendo datos), el panel de Categorías y el panel
  de tabs **permanecen montados con los datos anteriores** hasta que llegan los nuevos — no quedan en
  blanco ni parpadean a skeleton. El skeleton completo solo aparece en la primera carga (sin datos
  previos).
- **AC-9:** El guard contra respuestas fuera de orden (`createRequestGuard`) protege `fetchReporte()`
  — dos cambios de filtro rápidos aplican siempre el resultado del más reciente.

## Cambio (plan)

### Núcleo funcional — `core/utils/reportes-contables.utils.ts`

- Nueva función pura `computeRentabilidadCursos(payments, expenses, classCountsByGroup)` →
  `RentabilidadCurso[]` + fila TOTAL:
  - Ingresos por tipo de curso: reagrupar `payments` por tipo de curso **sin** desglose por sede
    (`class_b`, `professional`, `standalone`, `complement`→"Clases Extra", `special_service`→
    "Psicotécnico / Servicios"). Reutilizar/−factorizar el mapeo de `incomeCategoryLabel`.
  - Pool vehículo = Σ `expenses` con `category IN ('fuel','repair')`; repartir por
    `classCountsByGroup` (nº de clases prácticas por tipo). Si Σ clases = 0 → pool vehículo se
    reparte por participación en ingresos (fallback, evita perder el gasto).
  - Pool materiales = Σ `expenses` con `category === 'materials'`; repartir por participación en
    ingresos.
  - `gastosDirectos = shareVehiculo + shareMateriales`; `margenNeto = ingresos - gastosDirectos`;
    `rentabilidadPorcentaje = ingresos > 0 ? round(margenNeto/ingresos*100) : 0`.
  - Ajuste de redondeo: la última fila absorbe el residuo para que el TOTAL cuadre exacto.
- `buildReporte()` pasa a devolver también `rentabilidadCursos` en `ReporteContable`.
- Modelo: `ReporteContable` (en `reportes-contables.model.ts`) suma `rentabilidadCursos: RentabilidadCurso[]`.
  `RentabilidadCurso` (en `pagos.model.ts`) — evaluar mover a `reportes-contables.model.ts` o
  reexportar; mantener `colorVisual` derivado del mismo mapa de colores de `INCOME_COLORS`.

### Facade — `core/facades/reportes-contables.facade.ts`

- Nueva query `queryClassCounts(desde, hasta, branchId)`: cuenta clases prácticas completadas por
  tipo de curso en el rango:
  - Clase B ← `class_b_sessions` (`status='completed'`, fecha en rango) join `enrollments.license_group`.
  - Profesional ← `professional_practice_sessions` (equivalente; confirmar tabla/estado en
    `indices/DATABASE.md` al implementar).
  - "Clases Extra" (`complement`) — si no hay tabla de sesiones propia, cuenta 0 (recibe solo
    materiales); documentar el supuesto.
  - Aplicar filtro de sede igual que las demás queries (`branchId !== null → .eq('branch_id', …)`).
- `fetchReporte()`: agregar `queryClassCounts` al `Promise.all`; pasar el conteo a `buildReporte()`.
- **SWR:** `aplicarFiltros(filtros)` deja de hacer `_isLoading.set(true)` cuando `_reporte()` ya
  tiene valor → solo `this._filtros.set(filtros)` + `await this.fetchReporte()` (refresco
  silencioso). El `_isLoading` completo queda reservado a `initialize()` en su primera carga.
  Extraer `refreshSilently()` como en el resto de Facades SWR.
- **RequestGuard:** envolver `fetchReporte()` con `createRequestGuard()`
  (`core/utils/request-guard.utils.ts`) — `next()` al inicio, `isCurrent()` antes de aplicar a los
  signals. Requerido por `.claude/rules/facades.md` §7 para Facades branch-scoped con SWR.

### UI — `shared/components/reportes-contables-content/reportes-contables-content.component.ts`

- `<app-rentabilidad-cursos>` pasa a recibir `[datos]="rentabilidadCursos()"` y
  `[periodoLabel]="periodoLabel()"` (derivado de `filtros()`).
- Nuevo `input<RentabilidadCurso[]>('rentabilidadCursos', [])`.
- **Quitar el botón "Aplicar".** `onRangoChange()`:
  - preset → setear locales + `emitirFiltros()` inmediato.
  - `personalizado` → no emitir todavía.
- `localDesde`/`localHasta` (personalizado): al cambiar, si ambas definidas y `desde <= hasta` →
  `emitirFiltros()`. (Sin `Aplicar`; sin debounce — decisión del dueño.)
- Envolver Categorías + panel de tabs para que **no se desmonten** en recarga silenciosa: el
  `@if (!isLoading())` pasa a `@if (!isLoading() || tieneReporte())` (o equivalente) — con datos
  previos, se mantienen montados. Skeleton completo solo cuando no hay `kpis()`/reporte.

### UI — `shared/components/rentabilidad-cursos/rentabilidad-cursos.component.ts`

- De componente con mock a **Dumb puro**: `datos = input<RentabilidadCurso[]>('datos', [])`,
  `periodoLabel = input<string>('periodoLabel', '')`.
- Borrar `datosRentabilidad` (signal mock) y `mesActual` (computed sobre `new Date()`).
- `totales` computed pasa a derivar de `datos()`.
- Empty state cuando `datos().length === 0` (sin movimientos en el período), centrado en el alto
  disponible (regla `.bento-fill` de `visual-system.md`).

### Smart components

- `admin-contabilidad-reportes.component.ts` y `secretaria-contabilidad-reportes.component.ts`:
  pasar `[rentabilidadCursos]="facade.rentabilidadCursos()"` al content. Sin más cambios (el
  `effect()` sobre `branchFacade` + `initialize()` ya está).

### Tests

- `reportes-contables.utils.spec.ts`: casos nuevos para `computeRentabilidadCursos` — reparto
  híbrido correcto, TOTAL cuadra exacto, Σ clases = 0 (fallback a ingresos), tipo sin clases
  (solo materiales), ingresos = 0 (sin `NaN`), residuo de redondeo en la última fila.
- `reportes-contables.facade.spec.ts`: `aplicarFiltros()` no toca `_isLoading` con datos previos;
  `queryClassCounts` se incluye en la carga; requestGuard descarta respuesta stale.
- `reportes-contables-content.component.spec.ts`: preset emite `aplicarFiltros` inmediato;
  personalizado emite solo con ambas fechas válidas; Categorías/tabs no se desmontan en recarga
  con datos previos.

### Índices

- `COMPONENTS.md`: `RentabilidadCursosComponent` → de "✅ UI Ready (mock)" a Dumb con
  `datos`/`periodoLabel` inputs, alimentado por `ReportesContablesFacade`.
- `FACADES.md`: `ReportesContablesFacade` suma `rentabilidadCursos` + `queryClassCounts` +
  requestGuard.
- `UTILS.md`: `computeRentabilidadCursos` en `reportes-contables.utils.ts`.
- `MODELS.md`: `ReporteContable.rentabilidadCursos`.
- `DOMAIN-GOTCHAS.md`: registrar que "Rentabilidad por tipo de curso" es una **estimación por
  prorrateo** (fuel+repair por nº de clases, materials por ingresos), no un dato exacto — no
  existe atribución de gasto→curso en `expenses`.

## Test de Regresión

- Unit: `computeRentabilidadCursos` (funcional puro) — es el corazón del fix.
- `/verify` (Playwright): sesión admin → `/admin/contabilidad/reportes` → cambiar rango a "Mes
  pasado": Rentabilidad cambia; Categorías y tabs NO quedan en blanco durante la recarga; no hay
  botón "Aplicar". Repetir con rango "Personalizado" (una sola fecha no dispara nada; ambas sí).
  Repetir en sesión secretaría. Modo oscuro + ancho mobile.
