# Spec 0015 — Evolución Mensual (Reportes Contables): selector de rango propio de la pestaña

> **Status:** done
> **Created:** 2026-09-09
> **Owner:** Matías
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** iniciativa interna — revisión visual del owner sobre Reportes Contables (2026-09-09).

**Persona afectada:** Admin / dueño (única persona que ve la pestaña Evolución Mensual).

**Problema que resuelve:**
El reporte tiene **un solo selector de rango en el header** compartido por todas las pestañas
(Categorías, Evolución Mensual, Rentabilidad, Gastos Fijos). La pestaña **Evolución Mensual**
ignora por completo ese selector: desde fix-242-m usa una ventana fija de 6 meses hardcodeada
en el facade (`EVOLUCION_MONTHS = 6`), precisamente porque "Mes actual" daba un único mes y el
gráfico no tenía sentido. Resultado hoy: en Evolución Mensual, elegir "Mes actual", "Mes
anterior" o "Último trimestre" **no cambia nada** — siempre se ven los mismos 6 meses. Los
nombres de esas opciones confunden ("dice Mes actual pero muestra 6 meses"). Además no hay
forma de ver más historia (12 meses, un año calendario) aunque los datos existan.

**Hipótesis de valor:**
Un selector cuyas opciones **coinciden con lo que la pestaña realmente hace** elimina la
confusión y habilita las vistas de historia que el dueño pide (12 meses, año actual, año
anterior) para leer estacionalidad del negocio.

---

## 2. User Stories

- **US1**: Como dueño, en la pestaña Evolución Mensual quiero que el selector de rango ofrezca
  solo opciones que tengan sentido para un gráfico mensual (ventanas de varios meses), sin las
  opciones de un solo mes / trimestre que no cambian nada.
- **US2**: Como dueño, quiero poder elegir **Últimos 6 meses** (default), **Últimos 12 meses**,
  **Año actual** y **Año anterior** para leer la evolución con distinta profundidad de historia.
- **US3**: Como dueño, quiero que el gráfico muestre **todos los meses del rango elegido**,
  incluso los que no tuvieron ingresos ni gastos, con una aclaración discreta de "sin
  movimientos" sobre ese mes, para no malinterpretar un hueco como un mes faltante.
- **US4**: Como dueño, quiero que al cambiar entre Evolución Mensual y las otras pestañas cada
  grupo recuerde su propio rango, sin que se me "rompa" la selección.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given estoy en la pestaña **Evolución Mensual**, When abro el selector de rango del
  header, Then las únicas opciones son: `Últimos 6 meses` (seleccionada por defecto),
  `Últimos 12 meses`, `Año actual`, `Año anterior`. No aparecen `Mes actual`, `Mes anterior`,
  `Último trimestre` ni `Personalizado`.
- **AC2**: Given estoy en cualquier otra pestaña (Categorías / Rentabilidad / Gastos Fijos),
  When abro el selector, Then las opciones son las actuales (`Mes actual`, `Mes anterior`,
  `Último trimestre`, `Año actual`, `Personalizado`) — sin cambios respecto a hoy.
- **AC3**: Given estoy en Evolución Mensual con `Últimos 6 meses`, Then el gráfico muestra
  exactamente 6 barras: del 1° del mes 5 meses atrás hasta el fin del mes en curso, una barra
  por mes calendario, en orden cronológico.
- **AC4**: Given elijo `Últimos 12 meses`, Then el gráfico muestra exactamente 12 barras (mes
  −11 … mes en curso).
- **AC5**: Given elijo `Año actual`, Then el gráfico muestra los meses de **enero del año en
  curso hasta el mes en curso, inclusive** (p. ej. en septiembre → 9 barras: ene…sep). NO
  muestra los meses futuros del año.
- **AC6**: Given elijo `Año anterior`, Then el gráfico muestra los **12 meses** del año
  calendario anterior (enero…diciembre).
- **AC7**: Given un mes dentro del rango elegido no tiene ningún ingreso ni gasto, Then igual
  se dibuja su posición en el eje con valores en 0 y aparece una **nota discreta "sin
  movimientos"** encima (o junto a) la etiqueta del mes. El mes no se omite.
- **AC8**: Given cambio de `Últimos 6 meses` (en Evolución) a la pestaña Categorías y vuelvo a
  Evolución, Then Evolución sigue en `Últimos 6 meses` y Categorías conserva el rango que
  tenía. Cada grupo de pestañas mantiene su propio rango de forma independiente.
- **AC9**: Given estoy en Evolución con un rango elegido, Then el chip de fechas del header
  (`DD/MM/YYYY – DD/MM/YYYY`) refleja la ventana efectiva de ese rango.
- **AC10**: Los KPIs del header (Total Ingresos / Total Gastos / Total Neto / % margen) y el
  resto de pestañas **no cambian su cálculo** por esta spec — siguen respondiendo al rango del
  grupo "general".

### Edge cases obligatorios

- **AC-E1**: Given `Año actual` y estamos en **enero**, Then el gráfico muestra una sola barra
  (enero) con su nota de "sin movimientos" si corresponde — sin errores ni gráfico vacío roto.
- **AC-E2**: Given el rango elegido (hasta 12 meses) no cabe cómodamente en el ancho del panel,
  Then la solución de layout (barras más finas, etiquetas rotadas/abreviadas, o scroll
  horizontal interno) mantiene legibles todas las barras y no rompe el contrato app-like
  (`.bento-fill`, sin scroll del documento). Validar con `/verify`.
- **AC-E3**: Given TODOS los meses del rango están sin movimientos, Then se ven N barras en 0
  con sus notas, no un `app-empty-state`.
- **AC-E4**: Given el rango tiene meses con solo ingresos o solo gastos (no ambos), Then esos
  meses NO llevan nota de "sin movimientos" (la nota es solo para 0 ingresos **y** 0 gastos).

---

## 4. Out of scope

- ❌ Cambiar el cálculo de los KPIs del header o de las otras 3 pestañas.
- ❌ Rango `Personalizado` (fechas libres) para Evolución Mensual.
- ❌ Granularidad distinta a mensual (semanal, diaria, trimestral agregada).
- ❌ Cambiar el export Excel/PDF (`generate-financial-report`) — sigue usando el rango del
  grupo general. Si el owner quiere exportar la serie de Evolución, es otra spec.
- ❌ Persistir la última selección del usuario entre sesiones.
- ❌ Realtime / auto-refresh de la serie.

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante. Contexto: fix-242-m (desacopló Evolución del filtro y fijó los 6 meses),
  0003-i-app-like-reportes-contables (estructura de la vista), fix-244-m / hotfix-101-m
  (misma familia de fixes recientes en `reportes-contables.utils.ts`).

### Capacidades del proyecto que se asumen existentes
- `ReportesContablesFacade` con SWR + `requestGuard` (regla facades §7).
- `reportes-contables-content.component.ts` con `Tabs`, `p-select` de rango y
  `linkedSignal` sobre `filtros()`.
- `<app-evolucion-mensual-chart>` (Dumb, creado en fix-242-m) — recibe `datos: EvolucionMensual[]`.
- `computeEvolucionMensual()` puro en `reportes-contables.utils.ts`.

### Capacidades nuevas requeridas
- Nuevos valores de `RangoReporte` (o un tipo aparte `RangoEvolucion`): `ultimos_6_meses`,
  `ultimos_12_meses`, `anio_anterior` (más `anio_actual` que ya existe, con semántica
  "ene → mes actual" para esta vista).
- El selector de rango del header debe volverse **consciente de la pestaña activa** para
  cambiar su lista de opciones.
- El estado de rango pasa de uno a **dos** (grupo general vs grupo Evolución), coordinados al
  cambiar de pestaña.
- `computeEvolucionMensual()` (o un wrapper) debe **rellenar** todos los meses del rango con
  ceros y marcar `sinMovimientos: boolean` por mes (nuevo campo en `EvolucionMensual`).

---

## 6. Datos y modelo (preliminar)

- Sin cambios de BD. Todo es cliente.
- `EvolucionMensual` (UI model) gana `sinMovimientos: boolean` (true ⇔ `ingresos === 0 && gastos === 0`).
- `RangoReporte` / nuevo `RangoEvolucion` + helper de ventana de fechas por opción
  (análogo a `computeDateRange`, pero para las 4 opciones de Evolución y devolviendo además la
  lista de `YYYY-MM` a renderizar).
- `RANGOS_REPORTE` se divide (o se filtra) según el "grupo" del selector.

---

## 7. UX y flujos (preliminar)

- **Pantalla:** Reportes Contables → pestaña "Evolución Mensual" (admin; ruta admin y la
  variante de secretaría con acceso si aplica).
- **Happy path:** entro a Evolución → selector muestra `Últimos 6 meses` → 6 barras (con
  meses en cero + nota si aplica) → cambio a `Últimos 12 meses` → refetch SWR silencioso →
  12 barras.
- **Estados especiales:**
  - Loading primera carga: skeleton del chart (patrón actual).
  - Todos los meses en 0: N barras planas con nota "sin movimientos", NO empty-state.
  - Nota "sin movimientos": texto muy tenue (`text-text-muted`, `micro-label` o menor),
    encima del label del mes, sin ícono (o `app-icon` si el DS lo pide). Sin emojis.
- **Layout 12 meses:** decidir en `plan.md` entre (a) barras más finas + labels abreviados
  (Ene, Feb…), (b) scroll horizontal interno del chart, (c) rotar labels. Restricción:
  respetar `.bento-fill` y app-like. Validación final con `/verify` en claro/oscuro y en
  desktop + móvil.

---

## 8. Métricas de éxito post-launch

- El owner deja de reportar confusión con el selector en esta vista.
- Uso de `Últimos 12 meses` / `Año anterior` al menos una vez por el owner en QA de aceptación.

---

## 9. Notas / decisiones abiertas

- [x] Selector: **mismo selector del header, con opciones distintas según la pestaña activa**
  (decidido con el owner, 2026-09-09).
- [x] Meses vacíos: **se rellenan con barras en 0** + nota discreta "sin movimientos" sobre el
  nombre del mes (decidido, 2026-09-09).
- [x] `Año actual` en Evolución = **enero → mes en curso** (no ene–dic completo) (decidido,
  2026-09-09).
- [x] `Año anterior` = 12 meses completos del año calendario anterior.
- [ ] ¿La nota "sin movimientos" va sobre el label, como tooltip, o como subtítulo bajo la
  barra? — resolver con `/verify` visual en `plan.md`.
- [ ] Layout para 12 barras: ¿barras finas + abreviatura, o scroll horizontal interno? —
  `plan.md` + `/verify`.
- [ ] ¿`RangoReporte` se extiende con los 4 valores nuevos o se crea `RangoEvolucion` aparte?
  Preferencia: tipo aparte para no contaminar `computeDateRange` y las otras 3 pestañas.
- [ ] Al entrar por primera vez a Evolución, ¿el rango general se preserva para cuando el
  usuario vuelve? (AC8 dice que sí — confirmar implementación: dos signals de rango).
- [ ] Chip de fechas del header en Evolución: mostrar la ventana de meses (AC9) — confirmar
  formato cuando el rango es "Año anterior" (01/01/2025 – 31/12/2025).

---

## Changelog

- 2026-09-09 — draft inicial por Matías. Decisiones de selector, relleno de meses y semántica
  de "Año actual" ya tomadas con el owner; pendientes de UX fina y tipo de datos para `/spec-plan`.
