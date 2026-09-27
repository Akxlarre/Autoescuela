# Tasks 0044-b — Dashboard Ejecutivo de Admin (fase 1: Clase B)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Created:** 2026-09-27
> Orden: Datos → Facade → UI → Conexión → Validación → Cierre

---

## Fase 1 — Datos y modelo

- [ ] **T1.1** — Migración: `exec_instructor_accrued_cost()` (costo devengado de instructores)
  - **AC ref:** AC4 (D2)
  - **DoD:**
    - [ ] `supabase/migrations/20260927120000_executive_dashboard_rpcs.sql` creado, idempotente (`CREATE OR REPLACE`)
    - [ ] Por instructor-mes: `base_salary` si hay fila en `instructor_monthly_payments`, si no `total_equivalent × branch_payroll_config.amount_per_hour`
    - [ ] Sede = `users.branch_id` del instructor; `p_branch_id NULL` = todas
    - [ ] Prorrateo por días del mes dentro del rango
    - [ ] `STABLE`, `SECURITY INVOKER`, `SET search_path = public, pg_temp`, guard `auth_user_role() = 'admin'`

- [ ] **T1.2** — Migración: `exec_dashboard_kpis(p_from, p_to, p_branch_id)` → jsonb
  - **AC ref:** AC3, AC4, AC7, AC9, AC10, AC17, AC18, AC-E5
  - **DoD:**
    - [ ] Ingresos: `payments.status IN ('paid','completado')`, `payment_date` en rango, `license_group = 'class_b'`
    - [ ] Gastos desglosados: `expenses`, `fixed_expenses`, `exec_instructor_accrued_cost()`
    - [ ] Nuevas matrículas (`status NOT IN ('draft','cancelled')`), clases realizadas / en agenda
    - [ ] Agendadas, canceladas (`cancelled`) e inasistencias (`no_show`,`absent`) para AC10
    - [ ] Ensayos totales/aprobados; etapas nuevos / en curso / pendiente examen (`active` + `certificate_enabled`) / finalizados
    - [ ] Mismo guard/flags que T1.1 + `GRANT EXECUTE ... TO authenticated`

- [ ] **T1.3** — Migración: `exec_dashboard_monthly_series`, `exec_dashboard_instructor_hours`, `exec_dashboard_receivables`, `exec_dashboard_today_ops`
  - **AC ref:** AC6, AC13, AC14, AC16, AC19
  - **DoD:**
    - [ ] Series: 24 filas (año actual + anterior, meses sin datos en 0) con la misma definición de ingresos/matrículas de T1.2
    - [ ] Horas: instructores activos de la sede con 0 incluidos (LEFT JOIN), `minutos = SUM(duration_min)`
    - [ ] Cartera: buckets `0-30`/`31-60`/`61-90`/`90+` por antigüedad de la matrícula, monto + nº alumnos
    - [ ] Today ops: valores de `vehicles.status` confirmados contra `FlotaFacade` antes de escribirlos
    - [ ] Mismo guard/flags que T1.1

- [ ] **T1.4** — Verificar migración en Supabase local con datos sembrados
  - **AC ref:** AC3, AC4, AC-E5, D5
  - **DoD:**
    - [ ] `npx supabase db reset` aplica sin error
    - [ ] Un pago `pending` y un pago de matrícula Profesional **no** suman en ingresos
    - [ ] Un mes liquidado usa `base_salary`; uno no liquidado usa horas × tarifa; rango parcial prorratea
    - [ ] Como secretaria, cualquier `exec_dashboard_*` responde `forbidden`
    - [ ] `EXPLAIN ANALYZE` de series 24 meses < 200 ms en local (si no, índice en `payments(payment_date)`)

- [ ] **T1.5** — Modelos DTO y UI
  - **AC ref:** — (soporte)
  - **DoD:**
    - [ ] `core/models/dto/executive-dashboard.model.ts` con la forma exacta de cada RPC (snake_case)
    - [ ] `core/models/ui/executive-dashboard.model.ts`: `ExecPeriodPreset`, `ExecDateRange`, `ExecKpi`, `ExecMonthlyPoint`, `InstructorHoursRow`, `StudentStageCounts`, `ReceivableAgingBucket`, `TodayOpsSummary`
    - [ ] Sin interfaces duplicadas (usar `Pick`/`extends` donde aplique)

---

## Fase 2 — Núcleo funcional y Facade

- [ ] **T2.1** — `executive-dashboard.utils.ts` (TDD: spec primero)
  - **AC ref:** AC1, AC5, AC10, AC11, AC12, AC16, AC18, AC-E4
  - **DoD:**
    - [ ] `executive-dashboard.utils.spec.ts` escrito antes y en verde
    - [ ] `resolvePresetRange`, `previousRange` (igual largo), `yoyRange` (cruce de año y 29-feb)
    - [ ] `computeDelta` → `up | down | new | none`, sin `Infinity`/`NaN`; `deltaTone` con inversión para gastos
    - [ ] `marginPct` con ingresos 0 → `null`; `safeRatePct`; `formatMinutesAsHours` → `10 h 30 min`
    - [ ] Funciones puras, sin inyección de Angular

- [ ] **T2.2** — `ExecutiveDashboardFacade` (TDD: spec primero)
  - **AC ref:** AC1, AC2, AC11, AC23, AC-E2, AC-E3
  - **DoD:**
    - [ ] `executive-dashboard.facade.spec.ts` escrito antes y en verde
    - [ ] Estado privado → público readonly → métodos; signals por sección + `error` por sección
    - [ ] `initialize()` SWR (`_initialized`, `refreshSilently()`); `setRange(range)`; `dispose()`
    - [ ] Lee `BranchFacade.selectedBranchId()` en cada fetch; **sin `effect()` en el Facade**
    - [ ] `Promise.allSettled` de las RPCs; 3 llamadas a `exec_dashboard_kpis` (actual, anterior, YoY)
    - [ ] `createRequestGuard()`: respuesta vieja descartada; `isCurrent()` justo antes de setear signals
    - [ ] Mapeo DTO → UI dentro del Facade; `DashboardFacade` **sin cambios**

---

## Fase 3 — Capa UI (Dumb)

- [ ] **T3.1** — Extender `app-kpi-card-variant` con `secondaryTrend` / `secondaryTrendLabel`
  - **AC ref:** AC11 (R5)
  - **DoD:**
    - [ ] Inputs opcionales, default `undefined` → no renderiza nada (retrocompatible)
    - [ ] Tono semántico por token (sin colores hardcodeados)
    - [ ] Consumidores actuales revisados en `USAGE-MAP.md`: sin cambio visual

- [ ] **T3.2** — `app-exec-period-filter`
  - **AC ref:** AC1, AC-E4
  - **DoD:**
    - [ ] `p-select` de presets (Este mes / Mes anterior / Este año / Personalizado) + `app-date-input` para el rango
    - [ ] Output `rangeChange(ExecDateRange)`; rango inválido (desde > hasta) no se emite
    - [ ] `data-llm-description` en los controles; OnPush; `input()`/`output()`

- [ ] **T3.3** — `app-line-comparison-chart` (SVG propio)
  - **AC ref:** AC13, AC14, AC15
  - **DoD:**
    - [ ] 12 meses × 2 series (actual hasta el mes en curso, anterior completo) + leyenda
    - [ ] Escala sin división por cero con serie vacía / todo en 0; eje Y compacto (`$1,2M`)
    - [ ] Tooltip por mes con ambos valores; colores solo por tokens; se lee en claro y oscuro
    - [ ] `loading` con `app-skeleton-block`; `:host` flex para `.bento-fill`
    - [ ] Sin backticks en comentarios de `template`/`styles`

- [ ] **T3.4** — `app-instructor-hours-table`
  - **AC ref:** AC16
  - **DoD:**
    - [ ] Orden desc por horas, instructores con 0 al final
    - [ ] Horas con `formatMinutesAsHours`; `loading` + `app-empty-state` sin filas

- [ ] **T3.5** — `app-student-stages-panel`
  - **AC ref:** AC17, AC18
  - **DoD:**
    - [ ] 5 conteos de etapa + % aprobación de ensayos ("—" sin ensayos)
    - [ ] `.micro-label` / `.kpi-value`; `loading` integrado

- [ ] **T3.6** — `app-receivables-aging-panel`
  - **AC ref:** AC6
  - **DoD:**
    - [ ] Total + nº de alumnos con saldo + 4 buckets reusando `app-horizontal-bar-chart`
    - [ ] `loading` + estado vacío

- [ ] **T3.7** — `app-today-ops-strip`
  - **AC ref:** AC19
  - **DoD:**
    - [ ] Bloque compacto: clases hoy (programadas / realizadas / canceladas), instructores activos, flota disponible / en mantención
    - [ ] `loading` integrado

---

## Fase 4 — Conexión (Smart) y animación

- [ ] **T4.1** — Reescribir `DashboardComponent` (`/admin/dashboard`)
  - **AC ref:** AC1, AC2, AC5, AC6, AC11, AC19, AC20, AC22, AC23, AC-E1, AC-E2
  - **DoD:**
    - [ ] Inyecta `ExecutiveDashboardFacade` + `DashboardAlertsFacade`; **ya no** `DashboardFacade`
    - [ ] Se van accesos rápidos, clases en vivo y actividad reciente (R6)
    - [ ] `effect()` sobre `selectedBranchId()` → recarga; `initialize()` en `ngOnInit`, `dispose()` en `DestroyRef`
    - [ ] Raíz `.bento-grid--fill-screen-kpi` + `[appBentoGridLayout]`, hijos directos; celdas que crecen con `.bento-fill`
    - [ ] KPIs rotulados "Clase B"; tooltip en Gastos (incluye sueldos devengados, tarifa actual en meses no liquidados — R1/R2)
    - [ ] Error por sección sin romper la página; sede sin datos → `$0`/"—" + `app-empty-state`
    - [ ] `animateBentoGrid()` en `ngAfterViewInit`; íconos nuevos registrados en `app.config.ts`

- [ ] **T4.2** — Limpiar huérfanos
  - **AC ref:** AC20 (R6)
  - **DoD:**
    - [ ] `recent-activity-drawer/` y `daily-agenda-drawer/` borrados **solo si** ya no tienen consumidores (grep + `USAGE-MAP.md`)
    - [ ] `DashboardFacade` y `SecretariaDashboardComponent` sin diff

---

## Fase 5 — Validación

- [ ] **T5.1** — Lint y tests
  - **DoD:**
    - [ ] `npm run lint:arch` sin errores nuevos
    - [ ] `npm run test:ci` en verde
    - [ ] `ng build` sin errores

- [ ] **T5.2** — QA visual con `/verify`
  - **AC ref:** AC15, AC21, AC22, AC-E1, AC-E3
  - **DoD:**
    - [ ] `/admin/dashboard`: desktop 1440, 768 px de alto, mobile, claro y oscuro; consola limpia; red sin 4xx
    - [ ] Cambio rápido de sede 3 veces → queda la última (AC-E3)
    - [ ] `/secretaria/dashboard` idéntico a antes (AC21)

- [ ] **T5.3** — `/spec-verify` → `acceptance.md` con evidencia por AC

---

## Fase 6 — Cierre

- [ ] **T6.1** — Sincronizar índices
  - **DoD:**
    - [ ] `COMPONENTS.md` (6 componentes nuevos + `app-kpi-card-variant` extendido), `FACADES.md`, `MODELS.md`, `UTILS.md`, `DATABASE.md` (6 funciones), `USAGE-MAP.md`
- [ ] **T6.2** — `specs/ROADMAP.md` → mover 0044 a Done; spec `Status: done`; limpiar `specs/.active`
- [ ] **T6.3** — Proponer ticket aparte: alinear definiciones de Reportes Contables con el dashboard (R7)

---

## Changelog

- 2026-09-27 — tasks iniciales (22 tareas en 6 fases)
