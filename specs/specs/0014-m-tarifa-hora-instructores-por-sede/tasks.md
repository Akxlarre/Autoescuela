# Tasks 0014 — Tarifa por hora de instructores configurable por sede

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-09-07

---

## Cómo usar este archivo

- Cada tarea es **atómica**: se empieza y termina en un sitting.
- Marcá `[x]` apenas pase su DoD (no antes, no en bloque).
- Si surge una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si algo cae fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 0 — Reconocimiento (bloqueante)

- [x] **T0.1** — Verificar supuestos del plan antes de escribir SQL/código
  - **DoD:**
    - [x] Rol instructor → literal `'instructor'` (seed `roles` en `20260301000010_09b_seed_data.sql`)
    - [x] `public.set_updated_at()` existe y es reutilizable — creada en `20260415000001`, reusada por `website_config` y `class_b_sessions`. Se referencia como `public.set_updated_at()`
    - [x] Rol secretaria → literal canónico `'secretary'` (seed `roles`; 250 usos vs 9 de `'secretaria'` que son ramas legacy/muertas). `instructor_advances` y `instructor_monthly_payments` usan `'secretary'`
    - [x] `auth_user_role()` = `SELECT roles.name ... WHERE users.supabase_uid = auth.uid()` — devuelve el nombre del rol tal cual el seed
  - **Hallazgo Edge Function `generate-payroll-report`:** NO crashea. Las 4 queries son requests HTTP independientes en `Promise.all`; el código solo checkea `instrRes.error`, ignora `paymentsRes.error`. La query `.select('... amount_per_hour')` sobre columna inexistente devuelve error 42703 → `paymentsRes.data = null` → `paymentsMap` queda vacío. **Consecuencia:** el reporte exportado (Excel/PDF) muestra **todos los instructores como `pending`** con `paid_at: null` y tarifa siempre 5000, aunque estén pagados. Bug silencioso preexistente que esta spec corrige de paso (T4.1). Verificado por lectura de código en `index.ts:187-254`.

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Crear migración `supabase/migrations/20260907120000_branch_payroll_config.sql`
  - **AC ref:** AC2, AC6, AC-E1, AC-E2
  - **DoD:**
    - [x] Naming correcto `20260907120000_branch_payroll_config.sql`
    - [x] `CREATE TABLE IF NOT EXISTS branch_payroll_config` con PK `branch_id` FK→`branches(id)`, `amount_per_hour INTEGER NOT NULL DEFAULT 5000 CHECK (amount_per_hour >= 0)`, `updated_at`, `updated_by` FK→`users(id)`
    - [x] `COMMENT ON TABLE` (spec 0014-m, global por sede, seed 5000)
    - [x] Trigger `trg_branch_payroll_config_updated_at BEFORE UPDATE` → `public.set_updated_at()` (confirmado existente en T0.1)
    - [x] `ENABLE ROW LEVEL SECURITY`
    - [x] Policies: `SELECT` admin+secretary+instructor · `INSERT` admin · `UPDATE` admin · sin `DELETE`
    - [x] Seed idempotente: `INSERT ... SELECT id, 5000 FROM branches ON CONFLICT (branch_id) DO NOTHING`
    - [x] Idempotente: `IF NOT EXISTS`, `DROP POLICY/TRIGGER IF EXISTS`, `ON CONFLICT DO NOTHING`
    - [~] `npx supabase db reset`: **N/A** — el proyecto no corre Supabase local (Docker); ver memoria `project_test_baseline`. Validado por inspección.
    - [x] Documentado en `indices/DATABASE.md` (fila M3-Finanzas + sección de policies `branch_payroll_config` + nota en el row de `set_updated_at()`)

- [x] **T1.2** — Crear DTO `src/app/core/models/dto/branch-payroll-config.model.ts`
  - **DoD:**
    - [x] `export interface BranchPayrollConfig` (PascalCase singular, sin prefijo `I`)
    - [x] Campos 1:1 con la tabla: `branch_id: number`, `amount_per_hour: number`, `updated_at: string`, `updated_by: number | null`
    - [x] Documentado en `indices/MODELS.md`

---

## Fase 2 — Capa Facade

- [x] **T2.1** — `src/app/core/facades/payroll-config.facade.spec.ts` PRIMERO (TDD) — 12 tests
  - **AC ref:** AC2, AC-E1, AC-E2
  - **DoD:** load→Map · rateForBranch fallback · updateRate upsert+toast · error no muta · SWR · mocks `vi.fn()`

- [x] **T2.2** — `src/app/core/facades/payroll-config.facade.ts` — 12/12 verde
  - **AC ref:** AC2, AC-E1
  - **DoD:** estado privado→readonly→métodos · `configByBranch` computed · `rateForBranch()` con `?? PAYROLL_RATE_FALLBACK` (exportado, =5000) · `load()` SWR guard · `updateRate()` upsert `onConflict:'branch_id'` + `updated_by` · try/catch + signal error · comentario "NO branch-scoped" · `indices/FACADES.md` ✅

- [x] **T2.3** — Integrar la tarifa en `liquidaciones.facade.ts`
  - **AC ref:** AC3, AC4, AC5, AC-E1, AC-E3
  - **DoD:**
    - [x] `fetchLiquidacionesData()` agrega `this.payrollConfig.load()` al `Promise.all`
    - [x] Por instructor: `amountPerHour = this.payrollConfig.rateForBranch(u?.branch_id ?? null)`
    - [x] Eliminado `payment?.amount_per_hour` (código muerto)
    - [x] Constante local `AMOUNT_PER_HOUR_DEFAULT` **eliminada** — el fallback único vive en `PAYROLL_RATE_FALLBACK` (mejor que "queda como fallback": evita dos fuentes)
    - [x] `registrarPago()` sin cambios — sigue guardando `base_salary` snapshot desde `row.totalBaseAmount`
    - [x] `indices/FACADES.md` (entrada `LiquidacionesFacade` + tabla de deps)

- [x] **T2.4** — Ampliar `liquidaciones.facade.spec.ts` (+4 tests, 26/26 verde)
  - **AC ref:** AC3, AC4, AC-E1, AC-E3
  - **DoD:**
    - [x] mock `supabase.client` que despacha por tabla (thenable chains)
    - [x] AC4 multi-sede: instr sede 1 → 9×5000=45000; instr sede 2 → 8×6500=52000
    - [x] AC3: base(sede 6000) − anticipos → `finalPaymentAmount` correcto
    - [x] AC-E1: sede sin fila → `rateForBranch` fallback, no rompe
    - [x] AC-E3: fila `paid` → `status='paid'`, `paymentId` intacto, cero `.update()` sobre `instructor_monthly_payments` en el fetch
    - [x] `provide: PayrollConfigFacade` mock agregado al TestBed (necesario: la facade ahora lo inyecta)

- [x] **T2.5** — 3er canal realtime en `setupRealtime()` (SÍ hecho)
  - **AC ref:** AC5
  - **DoD:**
    - [x] `.on('postgres_changes', { table: 'branch_payroll_config' }, () => refreshSilently())`
    - [x] `destroyRealtime()` cubre el mismo channel (sin cambios)
    - [x] Migración: `ALTER PUBLICATION supabase_realtime ADD TABLE branch_payroll_config` (guardado con `pg_publication_tables` check, idempotente)

---

## Fase 3 — Capa UI

- [x] **T3.1** — `src/app/features/admin/configuracion-nomina/tarifa-instructores-drawer.component.ts`
  - **AC ref:** AC1, AC2, AC-E2
  - **DoD:**
    - [x] OnPush, standalone
    - [x] Clon estructural de `PreciosCursosDrawerComponent`: `app-drawer-form`, header, **una fila por sede** (`BranchFacade.branches()` — no hace falta selector, son 2 sedes), input `$/hora` + botón Guardar por fila con `savingBranchId`
    - [x] Inyecta `PayrollConfigFacade` + `BranchFacade` + `LayoutDrawerFacadeService`
    - [x] `load()` en constructor
    - [x] `draftRate()` / `setDraft()` / `isDirty(branchId)` con `signal<Record<number, number|null>>`
    - [x] Guardar deshabilitado si `!isDirty` (que ya es false con valor `null`/negativo) o `isSaving()` (AC-E2)
    - [x] `Intl.NumberFormat('es-CL')` en el "Actual: $X / hora"; input numérico crudo
    - [x] Tokens del DS; **botón `.btn-row-save` local** (el DS no tiene variante chica de `btn-primary`; ARCH-16 prohíbe mutilar el padding/font de `btn-primary` — el clon `precios-cursos` sí lo mutila y el linter lo marca)
    - [x] `<app-icon>` `save` / `loader-circle` spin / `building-2` (vacío); sin SVG ni emojis
    - [x] `data-llm-action="guardar-tarifa-instructor"` + `data-llm-description` en el input
    - [x] Skeletons colocated con `payrollConfig.isLoading()`
    - [x] `indices/COMPONENTS.md`

- [x] **T3.2** — `tarifa-instructores-drawer.component.spec.ts` (9/9 verde)
  - **AC ref:** AC-E2
  - **DoD:**
    - [x] `isDirty` true solo si draft ≠ vigente; false con `null`/negativo
    - [x] `save` llama `updateRate(id, value)`, limpia draft al éxito, lo mantiene al fallo
    - [x] patrón `runInInjectionContext` + `new Component()` (sin render, sin Lucide) — mismo que `admin-editar-perfil-drawer.component.spec.ts`

- [x] **T3.3** — Card en `ajustes-drawer.component.ts`
  - **AC ref:** AC1, AC7
  - **DoD:**
    - [x] Card en `@if (isAdmin())` del tab `'config'`, entre "Precios de Cursos" y "Descuentos"
    - [x] Título + descripción + botón `banknote` "Editar Tarifa"
    - [x] `abrirTarifaInstructores()` → `layoutDrawer.push(TarifaInstructoresDrawerComponent, 'Tarifa Instructores', 'banknote')`
    - [x] `data-llm-action="open-instructor-rate-manager"`
    - [x] Tokens del DS

- [~] **T3.4** — `ajustes-drawer.component.spec.ts`
  - **AC ref:** AC7
  - **Decisión:** NO se agrega. `ajustes-drawer` (~590 líneas) **no tiene spec previo** y la card
    es un `@if (isAdmin())` idéntico al de otras ~6 cards admin del mismo componente, ninguna
    testeada. `testing-tdd.md` §"testea decisiones, no bindings": el guard es un binding, no una
    decisión. AC7 se cubre en QA (`/verify`, T5.3). Crear el 1er spec de ese componente para
    esta card sería scope creep.

---

## Fase 4 — Edge Function

- [x] **T4.1** — `supabase/functions/generate-payroll-report/index.ts`
  - **AC ref:** AC5
  - **DoD:**
    - [x] `.select('instructor_id, payment_status, paid_at')` — quitado el `amount_per_hour` roto (arreglа de paso el bug silencioso de T0.1: antes `paymentsRes` fallaba y todos salían `pending`)
    - [x] 5ª query `branch_payroll_config` en el `Promise.all` → `rateByBranch` Map
    - [x] `amountPerHour = rateByBranch.get(u?.branch_id) ?? AMOUNT_DEFAULT`
    - [x] `AMOUNT_DEFAULT` solo como fallback (comentario)
    - [~] Export Excel/PDF con tarifa ≠ 5000 → **pendiente QA** (T5.3): requiere la función desplegada; validación por lectura de código hecha

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` → **0 errores**, 175 warnings (todos backlog pre-existente, ninguno en archivos de esta spec — la regresión ARCH-16 inicial se corrigió con `.btn-row-save`). `tsc --noEmit -p tsconfig.app.json` exit 0.
- [x] **T5.2** — `npx vitest run` → **185 files passed / 2 skipped · 2319 tests passed / 5 skipped · 0 fallos**. Specs nuevos: payroll-config (12), tarifa-drawer (9); ampliado: liquidaciones (26).
- [~] **T5.3** — QA `/verify` (browser real, admin, migración + edge fn ya desplegadas por el owner)
  - [x] **AC1**: card "Tarifa por Hora de Instructores" visible en Ajustes → tab Ajustes (entre Precios de Cursos y Descuentos). Drawer abre con 2 filas (Autoescuela Chillán / Conductores Chillán), ambas "Actual: $5.000 / hora" (seed OK).
  - [x] **AC2**: editar Autoescuela Chillán → 6000 → Guardar → toast OK, "Actual:" pasa a $6.000 en sitio sin re-fetch.
  - [x] **AC3**: tras recargar Liquidaciones, Instructor1 (sede 1) 9 hrs → **$54.000** (era $45.000), total a pagar $54.000.
  - [x] **AC4**: filtro "Todas las escuelas" — instr 1–8 (sede 1) a $6.000/hr, instr 9–15 (sede 2) a $5.000/hr en el mismo listado. Cada fila con la tarifa de SU sede.
  - [x] **AC5**: KPI "TOTAL NÓMINA" $724.500 → $795.900 (tras recarga) **y realtime en vivo** tras el fix de publicación: `UPDATE branch_payroll_config` real → `refreshSilently()` llamado (1×, era 0), filas pasan a rate 5500 / base recalculada, KPI $724.500 → $760.200, **sin reload**. Reversa igual. Test data restaurado a 5000.
  - [x] **AC7**: como `instructor@test.com`, tab Ajustes solo muestra "Modo Oscuro" — sin card de tarifa. `@if (isAdmin())` OK.
  - [x] **AC-E2**: input `-500` y vacío → botón Guardar deshabilitado en ambos casos.
  - [x] Probes: consola 0 errores · dead classes en el drawer: 0 · dark mode OK · **mobile 375px: bug de botón fuera de viewport → corregido con `flex flex-wrap` + `min-w-35` en la fila; re-verificado, botones a right=319 < 375**.
  - [x] Datos de prueba revertidos: ambas sedes de vuelta a $5.000.
  - **Falta:** visto bueno visual del owner.

- [x] **T5.3b** — Diagnóstico AC5 realtime (root cause, Playwright vs BD real 2026-09-07)
  - **Hallazgo:** el canal `liquidaciones-realtime` de `LiquidacionesFacade` tiene 3 bindings
    `postgres_changes`: `instructor_monthly_payments`, `instructor_advances`, `branch_payroll_config`.
    Un canal dedicado a `branch_payroll_config` **SÍ** recibe el `UPDATE` (probe: `eventsReceived: 1`);
    el canal de 3 bindings del Facade **NO** dispara `refreshSilently()` (`refreshSilentlyCalls: 0`)
    ante el mismo `UPDATE` real. `grep` sobre `supabase/migrations/`: `ALTER PUBLICATION
    supabase_realtime ADD TABLE` jamás se corrió para `instructor_monthly_payments` ni
    `instructor_advances` (solo `class_b_sessions`, `notifications`, `payments`, `students`, `users`,
    `tasks`). Mecanismo: **fix-227-m / `20260827160000`** — un binding a tabla no publicada invalida
    el canal entero, el cliente igual reporta `SUBSCRIBED`/`joined`.
  - **Conclusión:** el realtime de Liquidaciones estuvo **muerto desde que se creó el canal** (bug
    pre-existente, no introducido por esta spec). Mi binding a `branch_payroll_config` es correcto
    pero heredó un canal roto.
  - **Fix aplicado:** `20260907120000_branch_payroll_config.sql` ahora agrega las **3** tablas a la
    publicación en un loop idempotente. Corrige AC5 **y** el bug pre-existente de golpe.
  - [x] **Re-aplicado a remoto por el owner + re-verificado en vivo** (2026-09-07): `refreshSilently()`
    ahora sí dispara ante un `UPDATE` real de `branch_payroll_config`; filas y KPIs se recalculan
    sin reload. El canal `liquidaciones-realtime` (pagos + anticipos + tarifa) quedó operativo por
    primera vez.

- [x] **T5.3c** — AC6 verificado en vivo (`instructor@test.com`, consola del browser): `select` OK
  (2 filas); `update({amount_per_hour: 9999}).eq('branch_id', 1)` → HTTP 204, 0 filas, re-lectura
  confirma 5000 (sin cambio). PostgREST devuelve 204 no 403 sin policy UPDATE — efecto correcto.

- [x] **T5.4** — `/spec-verify` → `acceptance.md` generado. Veredicto: ✅ PASA — 10/10 AC con evidencia
  (unit + `/verify` en BD real). Deuda registrada, ninguna bloqueante.

---

## Fase 6 — Cierre

- [x] **T6.1** — Índices al día (se actualizaron inline durante la implementación): `DATABASE.md`
  (`branch_payroll_config` + policies + realtime), `FACADES.md` (`PayrollConfigFacade` + deps +
  nota `LiquidacionesFacade`), `COMPONENTS.md` (`app-tarifa-instructores-drawer`), `MODELS.md`
  (`BranchPayrollConfig`).
- [x] **T6.2** — `specs/ROADMAP.md`: `0014-m` movida de Backlog a Done (2026-09-07, ✅ PASA 10/10).
  `spec.md` y `tasks.md` → `Status: done`.
- [x] **T6.3** — `specs/.active` limpiado.

---

## Tareas descubiertas durante implementación

- [x] **FP en la fila de totales** (`liquidaciones-content.component.ts`): `totales().horas` sumaba
  floats → `144.89999999999998hrs`. Corregido a pedido del owner durante el QA
  (`Math.round(x*10)/10`). Verificado en vivo: `144.9hrs`. Cambio adyacente al scope (1 línea).
- [ ] `liquidaciones-content.component.ts` sin `.spec.ts` (826 líneas, ARCH-09) — **fuera de scope**,
  candidato a fix track propio.
- [ ] ~30 migraciones sin aplicar a remoto (`20260808120000`+) incl. `fix-227-m` — **fuera de scope**,
  tema de deploy.
