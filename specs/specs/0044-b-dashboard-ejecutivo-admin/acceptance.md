# Acceptance 0044-b — Dashboard Ejecutivo de Admin (fase 1: Clase B)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-27
> **Verifier:** Claude · pendiente de validación visual del owner con datos de producción

---

## Resumen

- AC totales: **28** (23 + 5 edge cases)
- AC cumplidos: **28**
- Verificados **en el navegador real** (app servida con `ng serve`, capturas en [`qa/`](./qa/)): **15**
- Verificados **contra Postgres** (funciones SQL reales con seed determinístico): **8**
- Verificados **por test unitario** (Vitest): **todos los de lógica** — 2755 tests en verde

**Veredicto final:** ✅ **PASA**, con las reservas de método de abajo.

---

## Método y límites (leer antes de confiar en el ✅)

- **Sin Docker en el entorno** → no hubo Supabase local. Se levantó **Postgres 16 local** con stubs
  mínimos de Supabase (`auth.uid()`, roles `anon`/`authenticated`, `cron`/`net` vacíos) y se
  aplicaron **todas** las migraciones del repo: 83 tablas, igual que `indices/DATABASE.md`.
- **Las RPC nuevas se probaron como rol `authenticated` con RLS activo**, no como superusuario:
  admin → datos; secretaria → `forbidden` (42501); `anon` → `permission denied`.
- **Verificación visual:** la app real en Chromium (Playwright). Las llamadas a Supabase se
  interceptaron: la sesión de admin es simulada, pero **cada RPC `exec_dashboard_*` se resolvió
  ejecutando la función SQL real contra el Postgres local**. Los números en pantalla son los que
  devuelve la BD, no un mock. Script y seed: [`qa/verify-dashboard.mjs`](./qa/verify-dashboard.mjs),
  [`qa/seed_visual.sql`](./qa/seed_visual.sql).
- **Pendiente:** validar con datos de producción (volumen real, tarifas reales) — especialmente
  AC4 (sueldos devengados) y el rendimiento de las series de 24 meses.

---

## Verificación por AC

### Filtros

- **AC1 — Filtro de período** · ✅ visual + test
  Default "Este mes" (`1 sep – 27 sep 2026` en la línea de contexto). Presets resueltos por
  `resolvePresetRange()` (month-to-date, mes anterior completo, año a la fecha); rango inválido no
  se emite (`isValidRange`). Tests: `executive-dashboard.utils.spec.ts`.
- **AC2 — Filtro de sede** · ✅ visual
  Con sede 1 seleccionada todas las RPC recibieron `p_branch_id=1` y la línea de contexto muestra
  "Autoescuela Chillán"; con "Todas" → `null`. Test del Facade: `AC2: pasa la sede seleccionada a
  todas las RPC`.

### KPIs financieros (verificados contra Postgres con `qa/seed_exec.sql`)

- **AC3 — Ingresos** · ✅ SQL — sede 1, septiembre: **$250.000** esperado = obtenido. Excluye el
  pago `pending` de $300.000 y el pago Profesional de $500.000 (AC-E5). Con `completado` incluido.
- **AC4 — Gastos** · ✅ SQL — `gastos_variables` $30.000, `gastos_fijos` $100.000,
  `costo_instructores` $45.000 (7,5 h × $6.000). Prorrateo 16-ago → 15-sep: **$177.339**
  esperado = obtenido (mes liquidado usa `base_salary` $300.000; mes sin liquidar usa horas ×
  tarifa). Sede 2 sin tarifa → fallback $5.000: $15.000 ✓. Desglose visible en el tooltip.
- **AC5 — Resultado y margen** · ✅ visual + test — rótulo "Resultado · margen 59,6%";
  `marginPct` con ingresos 0 → `null` (nunca `NaN`).
- **AC6 — Saldo por cobrar** · ✅ SQL + visual — sede 1: `0-30` $100.000 (1 alumno) y `90+`
  $50.000 (1 alumno), 4 buckets siempre presentes. Panel en tab "Alumnos y cartera".

### KPIs comerciales y operativos

- **AC7 — Nuevas matrículas** · ✅ SQL — 1 en sede 1 (el `draft` y la de sede 2 no cuentan).
- **AC8 — Alumnos activos** · ✅ SQL — 2 (foto del momento).
- **AC9 — Clases realizadas / en agenda** · ✅ SQL — 3 realizadas; 1 en agenda (la `reserved`
  de un borrador no cuenta — DG-050).
- **AC10 — Cancelación/inasistencia** · ✅ SQL + test — 1 cancelada + 1 inasistencia (`absent`,
  fechada por `recorded_at`); sin eventos → `null` → "Sin clases en el período".

### Comparaciones

- **AC11 — Δ doble** · ✅ visual — cada tarjeta financiera muestra Δ vs período anterior y
  Δ vs año anterior; Gastos con color invertido (subir = rojo). En la tira del hero, el Δ de año
  anterior va como sub-valor ("+50% vs año ant.").
- **AC12 — Base cero** · ✅ test — `computeDelta(10, 0)` → `new`; `(0, 0)` → `none`; nunca
  `Infinity`.

### Gráficos

- **AC13 — Ventas mensuales** · ✅ visual — 2026 hasta septiembre (la línea termina en el mes en
  curso), 2025 completo; ticks redondos ($0 – $5M).
- **AC14 — Matrículas y estacionalidad** · ✅ visual — mismo formato; se ve el pico de verano.
- **AC15 — Tokens / claro-oscuro** · ✅ visual — solo `var(--…)`; captura en oscuro
  [`qa/desktop-dark-operacion-hoy.png`](./qa/desktop-dark-operacion-hoy.png).

### Paneles

- **AC16 — Horas por instructor** · ✅ SQL + visual — Ivan Uno 38 clases · 28 h 30 min; los
  instructores con 0 aparecen al final.
- **AC17 — Estado de alumnos** · ✅ SQL + visual — en curso / pendiente de examen
  (`certificate_enabled`) / finalizados; decisión D1.
- **AC18 — Ensayos de examen** · ✅ SQL + test — 1 de 2 aprobados; sin ensayos → "—".
- **AC19 — Operación de hoy** · ✅ visual — bloque compacto + alertas en el tab "Operación de hoy".

### Roles y estructura

- **AC20 — Solo admin, sin accesos rápidos** · ✅ visual + SQL — la página ya no muestra
  Matricular/Registrar pago/Agenda/Egreso; las RPC rechazan a no-admin.
- **AC21 — Secretaría intacta** · ✅ diff — `git diff origin/main` sobre
  `features/secretaria/`, `dashboard.facade.ts` y `dashboard-alerts.facade.ts`: **0 líneas**. No
  se verificó visualmente `/secretaria/dashboard` (no hay cambios que verificar).
- **AC22 — App-like** · ✅ visual — desktop 1440×900: el documento no scrollea
  (`docScroll=0`), la celda de tabs mide 335 px y scrollea por dentro; 1366×768: 203 px con scroll
  interno; móvil 390: scroll nativo, KPIs en 1 columna.
- **AC23 — Loading / SWR** · ✅ test — primera carga con `isLoading`; re-entrada y cambio de
  período sin skeleton.

### Edge cases

- **AC-E1 — Sede sin datos** · ✅ test — `mapKpiSummary` con todo en 0 no produce `NaN`; los
  paneles tienen `app-empty-state`. No se capturó una sede vacía en el navegador.
- **AC-E2 — Error de red en una sección** · ✅ test — error de BD y rechazo de red aislados por
  sección; el resto se renderiza.
- **AC-E3 — Cambio rápido de sede** · ✅ test — la respuesta vieja se descarta
  (`createRequestGuard`).
- **AC-E4 — Rango que cruza años** · ✅ test — `yoyRange(nov-2025 → feb-2026)` = nov-2024 →
  feb-2025; 29-feb → 28-feb.
- **AC-E5 — Profesional excluido** · ✅ SQL — el pago de matrícula Profesional no suma.

---

## Validaciones automáticas

| Check | Resultado |
|---|---|
| `npm run test:ci` | ✅ 206 archivos · 2755 tests |
| `npm run lint:arch` | ✅ 0 errores (177 advertencias; ninguna nueva salvo ARCH-09 en `kpi-card-variant`, que ya estaba en el límite antes de esta spec) |
| `ng build` | ✅ |
| Migración aplicada 2 veces | ✅ idempotente |
| Consola del navegador | 4 mensajes, todos preexistentes/de entorno: CDN de fuentes bloqueado en el sandbox (cert) e ícono `user-cog` del menú |

## Desvíos respecto del plan

- **KPIs operativos en el hero slim** en vez de 8 tarjetas: con 8 tarjetas la celda de tabs quedaba
  en 54–142 px de alto en un desktop de 900 px. Las 4 financieras siguen como tarjetas grandes.
- **Filtro de período** en la cabecera de los KPIs y no en el hero: el hero `slim` no proyecta
  `ng-content` (solo el `full`).
- **`app-receivables-aging-panel` no reutiliza `app-horizontal-bar-chart`**: esa leyenda formatea
  valores como horas.
- **`app-kpi-card-variant`** recibió además un input `compact` (retrocompatible).
- **T4.2:** no se borró ningún drawer — `recent-activity-drawer` y `daily-agenda-drawer` los sigue
  usando el dashboard de secretaría.
