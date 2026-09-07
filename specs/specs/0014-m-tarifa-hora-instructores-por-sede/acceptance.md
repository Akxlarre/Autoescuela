# Acceptance 0014 — Tarifa por hora de instructores configurable por sede

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-07
> **Verifier:** Claude (Sonnet 5) · pendiente visto bueno visual de Matías

---

## Resumen

- AC totales: **10** (AC1–AC7 + AC-E1/E2/E3)
- AC cumplidos: **10**
- AC fallidos: **0**
- AC con evidencia empírica (unit test o `/verify` en BD real): **10**

**Veredicto final:** ✅ PASA (sujeto a visto bueno visual del owner)

---

## Verificación por AC

### AC1 — Card "Tarifa por Hora de Instructores" visible en Ajustes (admin)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — card en `@if (isAdmin())` del tab `config`, entre "Precios de Cursos" y "Descuentos".
  - `/verify` (browser real, `admin@test.com`): la card aparece; abre `TarifaInstructoresDrawerComponent` con 2 filas (Autoescuela Chillán / Conductores Chillán), cada una "Actual: $5.000 / hora" + input `$/hora`.

### AC2 — Editar y persistir la tarifa

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Unit: `src/app/core/facades/payroll-config.facade.spec.ts` — `updateRate` hace `upsert` con `branch_id`, `amount_per_hour`, `updated_by`, `onConflict:'branch_id'`; refleja en memoria; toast éxito; en error no muta estado.
  - `/verify`: editar Autoescuela Chillán $5.000 → $6.000 → Guardar → toast + "Actual:" pasa a $6.000 sin re-fetch. DB confirmada (`select branch_id, amount_per_hour`).

### AC3 — Base (Ganado) = `total_equivalent × tarifa_sede`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Unit: `src/app/core/facades/liquidaciones.facade.spec.ts` — "sede con tarifa 6000 → totalBaseAmount === totalHours * 6000"; "base(sede) − anticipos → finalPaymentAmount".
  - `/verify`: tras cambiar sede 1 a $6.000, Instructor1 (9 hrs) → Base **$54.000** (era $45.000), Total a Pagar $54.000.

### AC4 — "Todas las escuelas": cada instructor con la tarifa de SU sede

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `LiquidacionesFacade.fetchLiquidacionesData()` — `amountPerHour = this.payrollConfig.rateForBranch(u?.branch_id ?? null)` por fila.
  - Unit: `liquidaciones.facade.spec.ts` — "2 instructores de sedes con tarifas distintas en un fetch → cada uno usa la suya" (9×5000=45000 vs 8×6500=52000).
  - `/verify`: con filtro "Todas las escuelas" y sede 1 = $6.000, instructores 1–8 quedaron a $6.000/hr y 9–15 a $5.000/hr en el mismo listado.

### AC5 — KPIs + export + realtime reflejan la tarifa nueva

- **Estado:** ✅ cumplido
- **Evidencia:**
  - KPIs: `/verify` — "TOTAL NÓMINA" $724.500 → **$795.900** al cambiar sede 1 a $6.000 (tras recarga); tfoot coincide.
  - Realtime: `/verify` (tras aplicar el fix de publicación) — `UPDATE branch_payroll_config` real → `refreshSilently()` llamado (spy: 1×, era 0), filas pasan a rate 5500 / base recalculada, KPI $724.500 → $760.200, **sin reload**; reversa igual.
  - Export: `supabase/functions/generate-payroll-report/index.ts` — 5ª query a `branch_payroll_config`, `rateByBranch.get(u?.branch_id) ?? AMOUNT_DEFAULT`; se quitó el `.select(..., amount_per_hour)` roto (bug silencioso preexistente: dejaba a todos como `pending`). **No probado en vivo** (requiere invocar la función desplegada); validado por lectura + T0.1.
- **Notas:** El fix de realtime fue una migración adicional (`ALTER PUBLICATION` de 3 tablas) — ver Deuda técnica.

### AC6 — RLS: no-admin no puede escribir, solo SELECT

- **Estado:** ✅ cumplido (con matiz)
- **Evidencia:**
  - Migración `20260907120000` — policies: `SELECT` admin+secretary+instructor · `INSERT`/`UPDATE` solo admin · sin `DELETE`.
  - `/verify` (`instructor@test.com`, consola del browser): `select` sobre `branch_payroll_config` → OK (2 filas). `update({amount_per_hour: 9999}).eq('branch_id', 1)` → HTTP **204 sin error, 0 filas afectadas**; re-lectura confirma `amount_per_hour` = 5000 (sin cambio).
- **Notas:** PostgREST devuelve 204 (no 403) cuando no hay policy de UPDATE — el update afecta 0 filas en silencio. El efecto neto es el correcto (el no-admin no puede modificar), pero no hay error explícito. El enunciado del AC ("RLS lo rechaza") se cumple en sustancia.

### AC7 — Usuario no-admin no ve la sección en Ajustes

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `/verify` (`instructor@test.com`): tab "Ajustes" del drawer muestra solo "Modo Oscuro"; no aparece "Tarifa por Hora de Instructores" (ni "Precios de Cursos", etc. — todas bajo `@if (isAdmin())`).

### AC-E1 — Sede sin fila en `branch_payroll_config` → fallback

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `PayrollConfigFacade.rateForBranch()` → `?? PAYROLL_RATE_FALLBACK` (5000, exportado); `branchId == null` → fallback.
  - Unit: `payroll-config.facade.spec.ts` — "rateForBranch() de una sede sin fila usa el fallback"; "usa el fallback si aún no se cargó nada". `liquidaciones.facade.spec.ts` — "sede sin fila de config → usa 5000, no rompe".

### AC-E2 — Valor vacío o negativo → guardado bloqueado

- **Estado:** ✅ cumplido
- **Evidencia:**
  - BD: `CHECK (amount_per_hour >= 0)`.
  - Código: `TarifaInstructoresDrawerComponent.isDirty()` → false si `value === null || value < 0`; botón deshabilitado.
  - Unit: `tarifa-instructores-drawer.component.spec.ts` — "isDirty false con valor vacío (null) o negativo".
  - `/verify`: input `-500` → Guardar deshabilitado; input vacío → Guardar deshabilitado.

### AC-E3 — Liquidación pagada: el registro persistido no se reescribe

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `registrarPago()` sin cambios — sigue escribiendo `base_salary`/`net_payment` snapshot desde `row.totalBaseAmount`; ninguna ruta hace UPDATE de esos campos al cambiar la tarifa.
  - Unit: `liquidaciones.facade.spec.ts` — "fila pagada → status='paid', paymentId intacto, cero `.update()` sobre `instructor_monthly_payments` en el fetch".
  - **Nota** (documentada en spec.md): la columna "Base (Ganado)" de la tabla es un valor vivo `total_equivalent × tarifa_vigente` para todas las filas — comportamiento preexistente, fuera de scope ("Recalcular liquidaciones históricas").

---

## Out-of-scope respetado

- ❌ Tarifa por instructor individual — confirmado: la tabla tiene PK `branch_id`, una fila por sede.
- ❌ Tarifa por tipo de clase / licencia — confirmado: no se tocó.
- ❌ Historial / versionado de tarifas — confirmado: solo `amount_per_hour` vigente + `updated_at`.
- ❌ Cambiar la fórmula del trigger `total_equivalent = practical_sessions × 0.75` — confirmado: intacto.
- ❌ Editar la tarifa desde la vista de Liquidaciones — confirmado: solo desde Ajustes.
- ❌ Acceso de la Secretaria a editar la tarifa — confirmado: policy `UPDATE` solo admin; card solo `@if (isAdmin())`.

---

## Deuda técnica detectada

1. **Realtime de `liquidaciones-realtime` estuvo muerto desde su creación** (bug preexistente, no de esta spec). `instructor_monthly_payments` e `instructor_advances` nunca se agregaron a la publicación `supabase_realtime`; por el mecanismo de fix-227-m, un binding a tabla no publicada mata el canal entero. **Corregido en esta spec** (la migración agrega las 3 tablas), pero el fix beneficia a pagos/anticipos, no solo a la tarifa — scope-adjacent aceptado por el owner.

2. **Backlog de migraciones sin aplicar a remoto**: `supabase migration list --linked` muestra ~30 migraciones locales (`20260808120000` en adelante) con `remote` vacío, incluidas las de realtime de notificaciones/dashboard (`fix-031-i`, `fix-227-m`). El owner aplicó `20260907120000` por fuera del historial de migraciones. → Tema de deploy, no de esta spec.

3. **FP en la fila de totales de `liquidaciones-content.component.ts`** (preexistente): `totales().horas` sumaba floats → `144.89999999999998hrs`. **Corregido de paso** a pedido del owner durante el QA (`Math.round(x*10)/10`, 1 decimal). Verificado en vivo: ahora `144.9hrs`. Es un cambio en un archivo fuera del inventario de la spec — ajuste adyacente, cambio de 1 línea, riesgo nulo.

4. **`liquidaciones-content.component.ts` sin `.spec.ts`** (826 líneas, ARCH-09 warning preexistente, varios `computed()` sin test). No se creó su primer spec para un fix de redondeo de 1 línea. → Candidato a fix track propio.

5. **`generate-payroll-report` no probado en vivo** — requiere la Edge Function desplegada. La lógica se validó por lectura y unit-equivalencia con `LiquidacionesFacade`.

6. **AC6 devuelve 204, no 403** al escribir como no-admin (comportamiento estándar de PostgREST sin policy UPDATE). El efecto es correcto (no modifica); si se quisiera un rechazo explícito habría que añadir una policy `UPDATE ... USING (false)` para no-admins.

---

## Cambios en índices

- `indices/DATABASE.md` — agregada tabla `branch_payroll_config` (fila M3-Finanzas + sección de policies + nota realtime + nota en el row de `set_updated_at()`).
- `indices/FACADES.md` — agregado `PayrollConfigFacade` (entrada + tabla de deps); nota en `LiquidacionesFacade` (inyección + resolución por sede).
- `indices/COMPONENTS.md` — agregado `app-tarifa-instructores-drawer`.
- `indices/MODELS.md` — agregado `BranchPayrollConfig` (dto).

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando (`npx vitest run` → 2319 passed / 0 fallos; specs nuevos: payroll-config 12, tarifa-drawer 9; liquidaciones ampliado 26)
- [x] `lint:arch` limpio (0 errores; warnings todos backlog preexistente)
- [ ] Visto bueno visual del owner (capturas enviadas)

**Cerrado por:** _(pendiente)_
**Fecha:** 2026-09-07
