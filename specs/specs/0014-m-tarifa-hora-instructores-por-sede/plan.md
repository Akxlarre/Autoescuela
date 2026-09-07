# Plan 0014 — Tarifa por hora de instructores configurable por sede

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-09-07
> **Talla:** M (1–3 días)

---

## 1. Resumen ejecutivo

Se crea la tabla `branch_payroll_config` (una fila por sede, `amount_per_hour`), con seed en
`5000` para no cambiar el comportamiento actual. Un facade nuevo `PayrollConfigFacade` la lee y
la escribe. `LiquidacionesFacade` deja de usar la constante hardcodeada y el campo muerto
`payment?.amount_per_hour`: agrega una query a la config y resuelve la tarifa **por la sede de
cada instructor**. La UI de edición es un drawer nuevo (`TarifaInstructoresDrawerComponent`,
clon estructural de `PreciosCursosDrawerComponent`) abierto desde una card nueva en el tab
"Ajustes" de `AjustesDrawerComponent`, visible solo para Admin. La Edge Function
`generate-payroll-report` replica la misma resolución por sede.

Orden grueso: migración + modelo → `PayrollConfigFacade` + tests → integración en
`LiquidacionesFacade` + tests → drawer + card en Ajustes → Edge Function → índices + QA.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20260907XXXXXX_branch_payroll_config.sql` | Migration | Tabla `branch_payroll_config` + RLS + trigger `set_updated_at` + seed 5000 por sede |
| `src/app/core/models/dto/branch-payroll-config.model.ts` | DTO | Mapea 1:1 la tabla nueva |
| `src/app/core/facades/payroll-config.facade.ts` | Facade | Leer/escribir la tarifa por sede; expone `configByBranch()` (Map) y `rateForBranch(id)` |
| `src/app/core/facades/payroll-config.facade.spec.ts` | Test | Contrato del facade (load, update, fallback, Map derivado) |
| `src/app/features/admin/configuracion-nomina/tarifa-instructores-drawer.component.ts` | Dumb/Drawer | UI de edición: selector de sede + input `$ / hora` por sede + guardar por fila |
| `src/app/features/admin/configuracion-nomina/tarifa-instructores-drawer.component.spec.ts` | Test | `computed()` de dirty/formato y wiring de outputs |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/liquidaciones.facade.ts` | +query a `branch_payroll_config`; `Map<branchId, rate>`; resolver `amountPerHour` por `users.branch_id`; borrar `payment?.amount_per_hour`; `AMOUNT_PER_HOUR_DEFAULT` pasa a fallback | Núcleo del feature (AC3, AC4, AC-E1) |
| `src/app/core/facades/liquidaciones.facade.spec.ts` | Casos: tarifa por sede, multi-sede, fallback sin fila, filas `paid` no recalculan | testing-tdd |
| `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` | Card nueva `@if (isAdmin())` + método `abrirTarifaInstructores()` (`layoutDrawer.push(...)`) | AC1, AC7 |
| `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.spec.ts` | Card visible solo admin | AC7 |
| `supabase/functions/generate-payroll-report/index.ts` | Query a `branch_payroll_config`; resolver tarifa por sede; quitar `.select(..., amount_per_hour)` roto | AC5 |
| `indices/DATABASE.md` | Fila de `branch_payroll_config` + sección de policies + trigger | database.md |
| `indices/FACADES.md` | Entrada `PayrollConfigFacade` | sync |
| `indices/COMPONENTS.md` | Entrada `TarifaInstructoresDrawerComponent` | sync |
| `indices/MODELS.md` | Entrada `BranchPayrollConfig` (dto) | sync |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| — | ninguno |

---

## 3. Reutilización (Discovery)

### Componentes existentes que reutilizamos
- `PreciosCursosDrawerComponent` (`features/admin/configuracion-precios/`) — **plantilla estructural exacta**: selector de sede + input numérico prefijado `$` + guardar por fila con estado `savingXId`. El nuevo drawer es un clon con otra entidad.
- `app-drawer-form` (`shared/components/drawer-form/`) — layout canónico de drawers con footer.
- `app-skeleton-block`, `app-icon` — estados de carga e íconos.
- `LayoutDrawerFacadeService.push()` — apilar el drawer sobre Ajustes (precedente: `abrirPreciosCursos()`, `abrirDescuentos()`).
- `BranchFacade.branches()` / `selectedBranchId()` — lista de sedes y sede por defecto del selector.
- Patrón de card en `ajustes-drawer.component.ts` tab "config" `@if (isAdmin())` — copiar el bloque de "Precios de Cursos" (líneas ~280-298).

### Facades/Services existentes que extendemos
- `LiquidacionesFacade.fetchLiquidacionesData()` — agregar la 5ª query y el Map; `registrarPago()` sigue guardando el snapshot `base_salary` con la tarifa vigente al momento del pago (ya lo hace vía `row.totalBaseAmount`).
- Helper `resolveBranchScope` (`core/utils/branch-scope.utils.ts`) y `set_updated_at()` (trigger SQL ya existente, reutilizado por otras tablas).

### Componentes/Facades que NO existen y debemos crear
- `PayrollConfigFacade` — no hay ningún facade de configuración de nómina. Alternativa evaluada: meter los métodos en `LiquidacionesFacade`. **Descartada** porque `LiquidacionesFacade` es branch-scoped y su estado gira alrededor del período/tabla mensual; la config es un recurso pequeño, transversal a las sedes y con otro ciclo de vida (se edita desde Ajustes, no desde la vista mensual). Facade propio = testeable aislado y reutilizable si mañana se agregan más parámetros de nómina.
- `TarifaInstructoresDrawerComponent` — no existe UI de edición de tarifas de instructores.
- `branch-payroll-config.model.ts` — no hay modelo equivalente.

---

## 4. Modelo de datos

### Migración requerida

```sql
-- supabase/migrations/20260907XXXXXX_branch_payroll_config.sql

CREATE TABLE IF NOT EXISTS branch_payroll_config (
  branch_id        INT PRIMARY KEY REFERENCES branches(id),
  amount_per_hour  INTEGER NOT NULL DEFAULT 5000 CHECK (amount_per_hour >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       INT REFERENCES users(id)
);

COMMENT ON TABLE branch_payroll_config IS
  'Parámetros de nómina por sede (spec 0014-m). amount_per_hour = CLP por hora '
  'equivalente de instructor. Global por sede, no por instructor.';

-- Trigger de updated_at (reutiliza la función set_updated_at() ya existente)
CREATE TRIGGER trg_branch_payroll_config_updated_at
  BEFORE UPDATE ON branch_payroll_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE branch_payroll_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_branch_payroll_config ON branch_payroll_config
  FOR SELECT USING (auth_user_role() IN ('admin', 'secretary', 'instructor'));

CREATE POLICY insert_branch_payroll_config ON branch_payroll_config
  FOR INSERT WITH CHECK (auth_user_role() = 'admin');

CREATE POLICY update_branch_payroll_config ON branch_payroll_config
  FOR UPDATE USING (auth_user_role() = 'admin');
-- Sin DELETE: una sede no "pierde" su tarifa.

-- Seed idempotente: una fila por sede existente en 5000 (= comportamiento actual)
INSERT INTO branch_payroll_config (branch_id, amount_per_hour)
SELECT id, 5000 FROM branches
ON CONFLICT (branch_id) DO NOTHING;
```

> Verificar en la tarea el nombre real del rol instructor en `auth_user_role()` (`'instructor'`)
> y que `set_updated_at()` exista (lo usan `class_b_sessions`, `professional_promotions`,
> `website_config`).

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `branch_payroll_config` | admin | SELECT/INSERT/UPDATE | `auth_user_role() = 'admin'` |
| `branch_payroll_config` | secretary | SELECT | lectura para ver liquidaciones |
| `branch_payroll_config` | instructor | SELECT | lectura para ver su propia liquidación (AC4/US4) |
| `branch_payroll_config` | * | DELETE | sin policy → nadie |

### Modelos UI/DTO

- `core/models/dto/branch-payroll-config.model.ts`:
  ```ts
  export interface BranchPayrollConfig {
    branch_id: number;
    amount_per_hour: number;
    updated_at: string;
    updated_by: number | null;
  }
  ```
- Sin modelo `ui/`: el drawer consume directamente el DTO (nombres claros, sin campos
  derivados) + el nombre de sede lo aporta `BranchFacade`. `models.md` §"cuándo NO hace falta
  un modelo de UI".

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
── Edición (Ajustes) ─────────────────────────────────────────────
Admin → AjustesDrawerComponent (tab "config", @if isAdmin())
          └─ card "Tarifa por Hora de Instructores"
               └─ layoutDrawer.push(TarifaInstructoresDrawerComponent)
                     ├─ inject(PayrollConfigFacade)   → load() en constructor
                     ├─ inject(BranchFacade)          → branches()
                     ├─ selector de sede + input $/hora por sede
                     └─ (guardar fila) → PayrollConfigFacade.updateRate(branchId, value)
                                           └─ upsert branch_payroll_config
                                           └─ toast + refresca signal interno

── Consumo (Liquidaciones) ───────────────────────────────────────
Admin/Instructor → AdminContabilidadLiquidacionesComponent
                     └─ LiquidacionesFacade.initialize()
                          └─ fetchLiquidacionesData(mes, anio, branchId)
                               ├─ Promise.all([... , branch_payroll_config select])
                               ├─ rateByBranch = Map<branch_id, amount_per_hour>
                               └─ por instructor:
                                    rate = rateByBranch.get(u.branch_id) ?? 5000
                                    totalBaseAmount = totalHours * rate
                          (opcional) realtime: canal 'liquidaciones-realtime'
                               + .on(postgres_changes, table:'branch_payroll_config')
                                   → refreshSilently()
```

### Capas tocadas

- **Smart**: `features/admin/contabilidad-liquidaciones/` (sin cambios de código — hereda el nuevo cálculo del facade).
- **Dumb/Drawer**: `features/admin/configuracion-nomina/tarifa-instructores-drawer.component.ts` (nuevo); `shared/components/ajustes-drawer/` (card nueva).
- **Facade**: `core/facades/payroll-config.facade.ts` (nuevo); `core/facades/liquidaciones.facade.ts` (query + resolución por sede).
- **Migration**: `supabase/migrations/20260907XXXXXX_branch_payroll_config.sql`.
- **Edge Function**: `supabase/functions/generate-payroll-report/index.ts`.

### Decisión — refresco de Liquidaciones tras cambiar tarifa

**Propuesta:** agregar `branch_payroll_config` como 3er `.on(postgres_changes)` en
`LiquidacionesFacade.setupRealtime()` → `refreshSilently()`. Coherente con el patrón ya usado
para `instructor_monthly_payments` / `instructor_advances`, cero acción manual del admin.
Costo: 1 suscripción extra. Si se prefiere no tocar realtime, alternativa mínima: el admin
recarga la vista. Queda como **AC5** verificable de cualquier forma.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Facade nuevo con Signals, OnPush en el drawer, funciones puras si hay cálculo (el cálculo vive en el facade, trivial).
- [x] `facades.md` — `PayrollConfigFacade` NO es branch-scoped al estilo sec. 7 (no filtra por sede activa: trae **todas** las sedes para editarlas). `LiquidacionesFacade` sí lo es y ya aplica el guard `requestId` — la nueva query entra dentro de `fetchLiquidacionesData()` existente, cubierta por el guard actual.
- [x] `models.md` — DTO en `dto/`, sin `ui/` redundante.
- [x] `visual-system.md` — Drawer con tokens (`--ds-brand`, `bg-base`, `border-border-default`), sin colores hardcodeados; formato CLP `Intl.NumberFormat('es-CL')`; ícono `banknote` (ya registrado, se usa en Liquidaciones).
- [x] `swr-pattern.md` — `PayrollConfigFacade` cachea entre aperturas del drawer (`_initialized` + `refreshSilently`). `LiquidacionesFacade` ya es SWR.
- [x] `notifications.md` — solo `ToastService` (éxito/error al guardar). Sin notificaciones persistentes.
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para `PayrollConfigFacade`, cambios en `liquidaciones.facade.spec.ts`; el drawer tiene `computed()` de dirty → test obligatorio.
- [x] `ai-readability.md` — `data-llm-action="guardar-tarifa-instructor"` en el botón guardar, `data-llm-description` en el input y el selector de sede.
- [ ] `database.md` — (aplica: migración idempotente + doc en DATABASE.md — marcado en el checklist de tasks).

---

## 7. Plan de testing

**Unitarios — `payroll-config.facade.spec.ts`:**
- `load()` puebla `configByBranch()` con el Map correcto.
- `rateForBranch(id)` devuelve el valor de la fila; `?? 5000` cuando no hay fila (AC-E1).
- `updateRate(branchId, value)` hace upsert, actualiza el signal en memoria y emite toast; en error no muta el estado (AC2, AC-E2 la parte de UI).
- SWR: segunda `load()` no re-dispara skeleton.

**Unitarios — `liquidaciones.facade.spec.ts` (nuevos casos):**
- Sede con tarifa 6000 → `totalBaseAmount = totalHours * 6000` (AC3).
- Dos instructores de sedes con tarifas distintas en un mismo fetch → cada uno usa la suya (AC4).
- Sede sin fila de config → usa 5000, no rompe (AC-E1).
- Instructor con `instructor_monthly_payments.payment_status='paid'` → `status='paid'` y no se toca `base_salary` histórico (AC-E3); solo `pending` refleja la tarifa nueva.

**Unitarios — `tarifa-instructores-drawer.component.spec.ts`:**
- `isDirty(branchId)` true solo si el draft difiere del valor cargado.
- Input vacío / negativo → botón guardar deshabilitado (AC-E2).

**Unitarios — `ajustes-drawer.component.spec.ts`:**
- Card "Tarifa por Hora de Instructores" presente con rol admin, ausente con secretaria/instructor (AC7).

**QA manual (`/verify` + browser):**
- Golden path AC1→AC2→AC3: editar tarifa sede X, guardar, ir a Liquidaciones filtrado por X, ver base/total nuevos + KPIs.
- AC4: filtro "Todas las escuelas" con sedes de tarifas distintas.
- AC5: "Exportar Nómina" (Excel) refleja el nuevo valor.
- AC6: en la consola del browser, `supabase.from('branch_payroll_config').update(...)` como instructor → error RLS.
- Modo oscuro/claro del drawer, responsive.

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| Edge Function `generate-payroll-report` ya está rota (`.select(..., amount_per_hour)` sobre columna inexistente) y nadie lo notó → el export podría no usarse o fallar silenciosamente | Media | La tarea de la Edge Function arranca reproduciendo el estado actual (¿tira 400? ¿lo ignora?) antes de cambiar; test manual AC5 obligatorio. |
| `set_updated_at()` no existe o tiene otro nombre → migración falla | Baja | Verificar en `indices/DATABASE.md` (línea ~138 lo lista) antes de escribir el SQL; si no, incluir la función en la migración. |
| Nombre del rol instructor en `auth_user_role()` distinto a `'instructor'` | Baja | Grep en `supabase/migrations/*rls*` para confirmar el literal exacto. |
| Recalcular retroactivamente liquidaciones ya pagadas al cambiar tarifa | Media | AC-E3 explícito + test: `registrarPago()` ya persiste `base_salary` snapshot; el cálculo nuevo solo afecta filas `pending`. No tocar `registrarPago`. |
| 3er canal realtime aumenta ruido de refrescos | Baja | `refreshSilently()` no muestra skeleton; el volumen de cambios de tarifa es mínimo. Si molesta, quitar y dejar refresco manual. |
| Sede creada después del seed no tiene fila | Baja | Fallback `?? 5000` en facade y Edge Function; `updateRate` hace upsert (crea la fila al primer guardado). |

---

## 9. Orden de implementación

1. **Migración SQL** + `branch-payroll-config.model.ts` (DTO). Verificar `set_updated_at()` y literal de rol.
2. **`PayrollConfigFacade` + `.spec.ts`** (TDD: spec primero).
3. **`LiquidacionesFacade`**: query + Map + resolución por sede; borrar código muerto; **ampliar `.spec.ts`**. Correr `npm run test:ci`.
4. **`TarifaInstructoresDrawerComponent` + `.spec.ts`** (clon de `PreciosCursosDrawerComponent`).
5. **`AjustesDrawerComponent`**: card + `abrirTarifaInstructores()` + spec.
6. **Edge Function** `generate-payroll-report`: misma resolución por sede.
7. **(opcional) Realtime**: 3er `.on()` en `setupRealtime()`.
8. **Índices**: DATABASE.md, FACADES.md, COMPONENTS.md, MODELS.md.
9. **QA**: `npm run lint:arch`, `npm run test:ci`, `/verify`, checklist AC → `acceptance.md`.

---

## 10. Estimación

M — 1–3 días. El grueso es testing del cálculo multi-sede en `LiquidacionesFacade` y el QA de
la Edge Function (estado desconocido).

---

## Changelog

- 2026-09-07 — plan inicial
