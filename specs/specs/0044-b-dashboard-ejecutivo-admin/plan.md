# Plan 0044-b — Dashboard Ejecutivo de Admin (fase 1: Clase B)

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-09-27
> **Talla:** **L** — ⚠️ Revisar plan antes de implementar (tamaño alto). Estimación > 3 días.

---

> ⚠️ **Posible duplicación con `ReportesContablesFacade` / `/admin/contabilidad-reportes`** — ya
> calcula ingresos, gastos, neto, margen y evolución de 6 meses. **Confirmado con el owner
> (2026-09-27): se construye aparte a propósito**, porque las definiciones difieren (Reportes =
> todos los cursos + cursos singulares, sin filtro de status, sin sueldos; Dashboard = solo Clase
> B, `status IN ('paid','completado')`, + sueldos devengados). La métrica §8 de la spec se ajustó
> a eso. Alinear Reportes es ticket aparte.
>
> ⚠️ **`DashboardFacade` es compartido con `SecretariaDashboardComponent`** (y con los drawers de
> iniciar/finalizar clase). **No se modifica** — es la forma más barata de garantizar AC21
> (secretaria intacta). Todo lo nuevo va en un Facade nuevo.

## 1. Resumen ejecutivo

Se agregan funciones SQL de agregación (una migración) que devuelven los números ya calculados
por rango de fechas y sede, un `ExecutiveDashboardFacade` nuevo que las llama en paralelo (rango
actual, período anterior y mismo rango del año anterior) y funciones puras que calculan Δ% y
rangos. Luego se reescribe el template de `/admin/dashboard` como página app-like con 8 KPIs, 2
gráficos de líneas (componente SVG propio, sin librería nueva) y 4 paneles. Orden: SQL → utils
puros → Facade → componentes Dumb → página.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260927120000_executive_dashboard_rpcs.sql` | Migration | 6 funciones de agregación (§4). Idempotente (`CREATE OR REPLACE`). |
| `src/app/core/models/dto/executive-dashboard.model.ts` | DTO | Shape exacto del JSON/filas que devuelve cada RPC (snake_case). |
| `src/app/core/models/ui/executive-dashboard.model.ts` | UI Model | `ExecPeriodPreset`, `ExecDateRange`, `ExecKpi` (valor + `deltaPrev` + `deltaYoy`), `ExecMonthlyPoint`, `InstructorHoursRow`, `StudentStageCounts`, `ReceivableAgingBucket`, `TodayOpsSummary`. |
| `src/app/core/utils/executive-dashboard.utils.ts` | Util puro | `resolvePresetRange(preset, today)`, `previousRange(range)`, `yoyRange(range)` (AC-E4), `computeDelta(curr, base)` → `{ pct, kind: 'up'\|'down'\|'new'\|'none' }` (AC11/AC12), `deltaTone(kind, invert)`, `marginPct(res, ing)` (AC5), `formatMinutesAsHours(min)` → `10 h 30 min` (AC16), `safeRatePct(num, den)` (AC10/AC18). |
| `src/app/core/utils/executive-dashboard.utils.spec.ts` | Test | TDD de todo lo anterior, incluidos bordes (base 0, rango que cruza años, 29-feb). |
| `src/app/core/facades/executive-dashboard.facade.ts` | Facade | Branch-scoped + SWR + `createRequestGuard()` por fetch. Llama RPCs, mapea DTO → UI, expone signals + `error()` por sección (AC-E2). |
| `src/app/core/facades/executive-dashboard.facade.spec.ts` | Test | Mock de `supabase.rpc`: rangos correctos a las 3 llamadas, filtro de sede, guard de respuestas viejas (AC-E3), SWR sin skeleton en re-entrada (AC23), error parcial (AC-E2). |
| `src/app/shared/components/line-comparison-chart/line-comparison-chart.component.ts` | Dumb | Gráfico de líneas SVG 12 meses × 2 series (actual vs anterior), tokens del DS, eje Y compacto (`$1,2M`), tooltip por mes, `loading` con skeleton, `:host` flex para `.bento-fill`. Mismo enfoque que `app-evolucion-mensual-chart` (SVG propio, sin librería). |
| `src/app/shared/components/instructor-hours-table/instructor-hours-table.component.ts` | Dumb | Tabla AC16 (input `rows`, `loading`). |
| `src/app/shared/components/student-stages-panel/student-stages-panel.component.ts` | Dumb | Etapas AC17 + aprobación de ensayos AC18 (input `stages`, `examPassRate`, `loading`). |
| `src/app/shared/components/receivables-aging-panel/receivables-aging-panel.component.ts` | Dumb | Cartera por antigüedad AC6 (reusa `app-horizontal-bar-chart` para la barra apilada). |
| `src/app/shared/components/today-ops-strip/today-ops-strip.component.ts` | Dumb | Bloque compacto AC19. |
| `src/app/shared/components/exec-period-filter/exec-period-filter.component.ts` | Dumb | Filtro AC1: `p-select` de presets + `app-date-input` rango personalizado. Output `rangeChange`. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/dashboard/dashboard.component.ts` | Reescritura del template y del TS: inyecta `ExecutiveDashboardFacade` + `DashboardAlertsFacade` (alertas); **deja de inyectar `DashboardFacade`**; se van accesos rápidos, actividad reciente y panel de clases en vivo. | AC20, AC22, estructura §7 de la spec. |
| `src/app/features/dashboard/dashboard.component.scss` | Ajustes de grilla app-like. | AC22. |
| `src/app/app.config.ts` | Registrar íconos Lucide nuevos (si aparecen). | Regla de íconos. |
| `indices/COMPONENTS.md`, `FACADES.md`, `MODELS.md`, `UTILS.md`, `DATABASE.md`, `USAGE-MAP.md` | Documentar artefactos nuevos. | Paso SINCRONIZAR. |

### Archivos a ELIMINAR (evaluar al final — solo si quedan huérfanos)

| Path | Motivo |
|------|--------|
| `src/app/features/dashboard/recent-activity-drawer/`, `daily-agenda-drawer/` | Solo se abren desde el dashboard de admin. Verificar con `USAGE-MAP.md` que secretaria no los use antes de borrar; si los usa, quedan. |

> `DashboardFacade`, `SecretariaDashboardComponent` y `app-live-classes-panel` **no se tocan**.

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `app-section-hero` (`density="slim"`) — título + filtro de período como acción.
- `app-kpi-card-variant` — los 8 KPIs (tiene `trend`, `trendLabel`, `loading`, `color`). El Δ
  YoY va en `trendLabel` o como segunda línea (ver riesgo R5).
- `app-horizontal-bar-chart` — barra apilada de la cartera por antigüedad.
- `app-empty-state`, `app-skeleton-block`, `app-icon`, `app-date-input`.
- Clases DS: `.bento-grid--fill-screen-kpi`, `.bento-fill`, `.card`, `.micro-label`, `.kpi-value`.

### Facades/Services existentes que reutilizamos (sin modificar)
- `BranchFacade.selectedBranchId()` — filtro de sede (AC2).
- `DashboardAlertsFacade` — bloque de alertas (ya lo usa hoy el dashboard admin).
- `GsapAnimationsService` — `animateBentoGrid()`.
- `createRequestGuard()` — AC-E3.
- `formatCLP()` (`core/utils/date.utils.ts`), `formatKpiEsCl()`.

### Lo que NO existe y se crea
- **Facade ejecutivo:** `DashboardFacade` es compartido con secretaria → modificarlo arriesga AC21.
- **Gráfico de líneas comparativo:** no hay librería de charts en `package.json` y el único chart
  temporal (`app-evolucion-mensual-chart`) es de barras ingresos/gastos, no 2 series de años.
  Se construye un SVG propio, siguiendo el precedente del proyecto, en vez de sumar Chart.js.
- **RPCs de agregación:** decisión D3.

---

## 4. Modelo de datos

Sin tablas nuevas. Una migración con funciones. Todas:
- `LANGUAGE sql` o `plpgsql`, `STABLE`, **`SECURITY INVOKER`** (respetan RLS del admin) y
  `SET search_path = public, pg_temp`.
- Primera línea: `IF auth_user_role() <> 'admin' THEN RAISE EXCEPTION 'forbidden'` (solo admin).
- Parámetro `p_branch_id INT` → `NULL` = todas las sedes.
- Filtro Clase B vía `enrollments.license_group = 'class_b'` (AC-E5).
- `GRANT EXECUTE ... TO authenticated`.

```sql
-- 1) KPIs de un rango. El Facade la llama 3 veces (actual, anterior, YoY).
exec_dashboard_kpis(p_from DATE, p_to DATE, p_branch_id INT) RETURNS jsonb
--  ingresos            = SUM(p.total_amount) payments p JOIN enrollments e
--                        WHERE p.status IN ('paid','completado') AND p.payment_date BETWEEN ...
--                          AND e.license_group='class_b' AND (branch filter)          -- AC3
--  gastos_variables    = SUM(expenses.amount) WHERE date BETWEEN ...                  -- AC4
--  gastos_fijos        = SUM(fixed_expenses.amount) WHERE date BETWEEN ...            -- AC4
--  costo_instructores  = exec_instructor_accrued_cost(p_from, p_to, p_branch_id)      -- AC4/D2
--  nuevas_matriculas   = COUNT enrollments class_b created_at in range, status NOT IN ('draft','cancelled') -- AC7
--  clases_realizadas   = COUNT class_b_sessions status='completed' scheduled_at in range   -- AC9
--  clases_en_agenda    = COUNT status IN ('scheduled','reserved') scheduled_at >= now() AND <= p_to -- AC9
--  sesiones_agendadas  / canceladas / inasistencias (status IN ('cancelled') / ('no_show','absent')) -- AC10
--  ensayos_total / ensayos_aprobados (class_b_exam_scores.date in range)          -- AC18
--  etapas: nuevos / en_curso / pendiente_examen / finalizados                     -- AC17

-- 2) Costo devengado de instructores (D2), prorrateado por días.
exec_instructor_accrued_cost(p_from DATE, p_to DATE, p_branch_id INT) RETURNS bigint
--  por cada mes 'YYYY-MM' tocado por el rango:
--    por instructor (sede = users.branch_id):
--      COALESCE(imp.base_salary,                                    -- mes liquidado (congelado)
--               imh.total_equivalent * bpc.amount_per_hour)          -- mes no liquidado
--    × (días del mes dentro del rango / días del mes)

-- 3) Series mensuales año actual + anterior (AC13/AC14) — 24 filas.
exec_dashboard_monthly_series(p_year INT, p_branch_id INT)
  RETURNS TABLE(year INT, month INT, ingresos BIGINT, matriculas INT)

-- 4) Horas por instructor (AC16).
exec_dashboard_instructor_hours(p_from DATE, p_to DATE, p_branch_id INT)
  RETURNS TABLE(instructor_id INT, nombre TEXT, clases INT, minutos INT)
--  instructores activos de la sede LEFT JOIN sesiones completed en el rango (0 incluidos)

-- 5) Cartera por antigüedad (AC6) — foto del momento, no depende del período.
exec_dashboard_receivables(p_branch_id INT)
  RETURNS TABLE(bucket TEXT, monto BIGINT, alumnos INT)   -- '0-30','31-60','61-90','90+'
--  enrollments class_b, pending_balance > 0, status <> 'cancelled', edad = now() - created_at

-- 6) Operación de hoy (AC19).
exec_dashboard_today_ops(p_branch_id INT) RETURNS jsonb
--  clases hoy programadas/realizadas/canceladas, instructores activos, vehículos disponibles /
--  en mantención (valores de vehicles.status a confirmar en la tarea contra FlotaFacade)
```

### RLS

| Objeto | Rol | Operación | Política |
|--------|-----|-----------|----------|
| 6 funciones `exec_dashboard_*` | admin | EXECUTE | Guard `auth_user_role() = 'admin'` dentro de la función + `SECURITY INVOKER` (las tablas base mantienen su RLS). |
| 6 funciones | secretary / instructor / student | EXECUTE | Rechazado con `forbidden`. |

### Modelos UI/DTO
- `core/models/dto/executive-dashboard.model.ts` — `ExecKpisDto`, `ExecMonthlySeriesRowDto`,
  `ExecInstructorHoursRowDto`, `ExecReceivablesRowDto`, `ExecTodayOpsDto`.
- `core/models/ui/executive-dashboard.model.ts` — ver §2.

---

## 5. Arquitectura del feature

```
/admin/dashboard → DashboardComponent (Smart, features/dashboard)
   ├─ inject(ExecutiveDashboardFacade)
   ├─ inject(DashboardAlertsFacade)            (sin cambios)
   ├─ inject(BranchFacade)  → effect(): selectedBranchId() → facade.load(range)
   ├─ ngOnInit: facade.initialize() ; destroyRef → facade.dispose()
   │
   ├─ <app-section-hero slim> + <app-exec-period-filter (rangeChange)>
   ├─ 8 × <app-kpi-card-variant [value] [trend]=deltaPrev [trendLabel]=YoY [loading]>
   ├─ <app-line-comparison-chart [series]=ventas>     <app-line-comparison-chart [series]=matrículas>
   ├─ <app-instructor-hours-table>  <app-student-stages-panel>  <app-receivables-aging-panel>
   └─ <app-today-ops-strip> + alertas

ExecutiveDashboardFacade
   load(range):
     guard.next()
     Promise.allSettled([
       rpc(exec_dashboard_kpis, range), rpc(..., previousRange(range)), rpc(..., yoyRange(range)),
       rpc(exec_dashboard_monthly_series, year), rpc(exec_dashboard_instructor_hours, range),
       rpc(exec_dashboard_receivables), rpc(exec_dashboard_today_ops) ])
     if !guard.isCurrent → return
     mapeo DTO→UI + computeDelta() ; error por sección si esa promesa falló (AC-E2)
```

- **Smart:** `features/dashboard/dashboard.component.ts`
- **Dumb:** 6 componentes nuevos en `shared/components/` (§2)
- **Facade:** `core/facades/executive-dashboard.facade.ts`
- **Utils:** `core/utils/executive-dashboard.utils.ts`
- **Migration:** `supabase/migrations/20260927120000_executive_dashboard_rpcs.sql`

Sin Realtime: es una vista analítica; se refresca al entrar (SWR) y al cambiar filtros. Evita
suscribir 6 tablas por un dashboard que no necesita actualizarse al segundo.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade estricto, OnPush, signals, `input()/output()`, Dumb sin Facades, lógica en funciones puras.
- [x] `facades.md` — branch-scoped vía `BranchFacade`; `effect()` en el Smart, no en el Facade; `createRequestGuard()` por fetch.
- [x] `models.md` — DTO (snake_case, forma de la RPC) y UI separados; el Smart solo importa `ui/`.
- [x] `visual-system.md` — tokens, `.micro-label`/`.kpi-value`, bento app-like, regla 3-2-1, `loader-circle`, `app-icon`, sin backticks en comentarios de template/styles.
- [x] `swr-pattern.md` — `_initialized` + `refreshSilently()`; cambio de filtro sin skeleton completo.
- [ ] `notifications.md` — no dispara notificaciones; errores por sección en el propio panel (sin toast).
- [x] `testing-tdd.md` — `.spec.ts` de utils y Facade primero.
- [x] `ai-readability.md` — `data-llm-description` en filtros, `data-llm-nav` si hay links a módulos.

---

## 7. Plan de testing

- **Unit (Vitest), TDD primero:**
  - `executive-dashboard.utils.spec.ts`: presets (mes actual/anterior/año/custom), `previousRange` de igual largo, `yoyRange` cruzando años (AC-E4) y con 29-feb, `computeDelta` con base 0 y ambos 0 (AC12), tono invertido para gastos (AC11), `marginPct` con ingresos 0 (AC5), `formatMinutesAsHours`, `safeRatePct`.
  - `executive-dashboard.facade.spec.ts`: 3 llamadas a `exec_dashboard_kpis` con los rangos correctos; `p_branch_id` null vs número (AC2); respuesta vieja descartada (AC-E3); una RPC falla → solo esa sección en error (AC-E2); segunda `initialize()` no pone `isLoading` (AC23).
- **SQL:** verificación manual contra Supabase local con datos sembrados conocidos: un pago `pending` que no suma (D5), un pago Profesional que no suma (AC-E5), mes liquidado vs no liquidado (D2), prorrateo de rango parcial, secretaria recibe `forbidden`.
- **QA visual (`/verify`):** `/admin/dashboard` en desktop 1440 y 768 de alto, mobile, claro/oscuro; consola limpia; sede sin datos (AC-E1); `/secretaria/dashboard` idéntico a antes (AC21).

---

## 8. Riesgos y mitigaciones

| # | Riesgo | Prob. | Mitigación |
|---|--------|-------|------------|
| R1 | Sueldos de meses pasados no liquidados se valorizan con la tarifa **actual** (no hay historial de `branch_payroll_config`). | Alta | Aceptado por el owner (D2). Tooltip en la tarjeta de Gastos. |
| R2 | Instructor con `both_branches = true`: su costo se imputa solo a su sede principal (`users.branch_id`). | Media | Mismo criterio que Liquidaciones → consistente. Documentar en el tooltip. |
| R3 | `class_b_sessions.status` tiene 7 valores (`scheduled`, `reserved`, `in_progress`, `completed`, `cancelled`, `no_show`, `absent`); si se cuenta mal, la tasa de cancelación engaña. | Media | Definir el denominador en la RPC con los valores exactos y cubrirlo en QA SQL. |
| R4 | `SECURITY INVOKER` + RLS por fila puede ser lento con 24 meses de pagos. | Baja | Hay `idx_enrollments_branch_date`; medir con `EXPLAIN ANALYZE` en local; si hace falta, índice en `payments(payment_date)`. |
| R5 | `app-kpi-card-variant` tiene un solo `trend`; mostrar 2 deltas puede requerir extenderlo. | Media | Primero intentar `trend` = Δ período + `trendLabel` = "vs año ant. +X%". Si no se lee bien, agregar input opcional `secondaryTrend` (retrocompatible) en vez de crear otra card. |
| R6 | Borrar el contenido actual del dashboard admin elimina "Clases en vivo" y "Actividad reciente" que el admin quizás usa. | Media | Validar con el owner en `/verify`; los drawers no se borran hasta confirmar que quedan huérfanos. |
| R7 | El dashboard y Reportes Contables muestran "Ingresos" distintos. | Alta | Por diseño (§8 spec). Rotular "Ingresos Clase B" y tooltip con la definición. |

---

## 9. Orden de implementación

1. Migración SQL (6 funciones) + verificación en Supabase local con datos sembrados.
2. DTO + UI models.
3. `executive-dashboard.utils.ts` con su `.spec.ts` (TDD).
4. `ExecutiveDashboardFacade` con su `.spec.ts` (TDD).
5. Componentes Dumb: `exec-period-filter`, `line-comparison-chart`, `instructor-hours-table`, `student-stages-panel`, `receivables-aging-panel`, `today-ops-strip`.
6. Reescritura de `DashboardComponent` (Smart) + SCSS app-like.
7. `npm run lint:arch` + `npm run test:ci` + `/verify` (admin + secretaria intacta).
8. Sincronizar `indices/*.md` + `/spec-verify`.

---

## 10. Estimación

Talla **L** — ~4-5 días: SQL + verificación 1,5 d · utils + Facade 1 d · componentes 1,5 d ·
página + QA 1 d.

---

## Changelog

- 2026-09-27 — plan inicial (talla L confirmada por el owner)
