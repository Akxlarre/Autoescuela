# Fix: Egresos — sede obligatoria y asociación obligatoria (vehículo / instructor)
> id: fix-243-m-egresos-sede-y-asociacion-obligatoria
> refs: fix-212-m-cuadratura-requiere-sede-especifica (DG-082)
> status: done
> closed: 2026-09-09
> created: 2026-09-09

## Root Cause

Los caminos de **escritura** branch-scoped de egresos derivan el valor de la columna
`branch_id` del mismo helper que se usa para **filtrar lecturas** (`resolveBranchScope()` /
`getActiveBranchId()` / `_effectiveBranchId()`), donde `null` significa "admin en Todas las
sedes → sin filtro". En una lectura eso es correcto; en un `insert` se escribe `branch_id: null`
literal y, como en SQL `NULL` nunca es igual a nada, la fila queda **huérfana**: invisible en
toda vista por sede, solo visible de nuevo en "Todas las sedes". Es exactamente DG-082.

`fix-212-m` tapó esto en la **página** de Cuadratura con `BranchGateComponent`, pero dejó
abiertos los puntos de entrada que abren el mismo drawer / hacen el mismo insert desde
contextos NO gateados:

1. **`CuadraturaFacade.registrarEgreso()`** — se llama desde el botón "Registrar Egreso" del
   dashboard (quick action), que NO está gateado por sede. `insert({ branch_id: getActiveBranchId() })`
   → huérfano cuando el admin está en "Todas las sedes". (Este es el bug reportado por el owner.)
2. **`ReportesContablesFacade.registrarGastoFijo()`** — la página Reportes Contables NO tiene
   `BranchGate`; `insert` en `fixed_expenses` con `branch_id: _effectiveBranchId()` → huérfano
   idéntico.

Causa raíz secundaria, misma familia: **el drawer de egreso nunca capturó la asociación que
determina la sede**. Un egreso de Combustible pertenece a un vehículo (que tiene sede) y un
Anticipo pertenece a un instructor (cuya sede sale de `users.branch_id`), pero:

- El campo Vehículo del drawer es `[null]` sin validador y rotulado "(opcional)" → se registran
  combustibles sin vehículo.
- La opción "Anticipo a Instructor" **no tiene campo de instructor** y la rama `else` de
  `registrarEgreso()` hace `insert` en `instructor_advances` **sin `instructor_id`**, que es
  `NOT NULL` → **todo anticipo por esta vía revienta siempre**, el `catch` lo traga como
  "Error al registrar el egreso". Rama muerta desde su creación.

## ACs Afectados

Ninguna spec declaró estos ACs explícitamente — fix autónomo que extiende DG-082 y
`fix-212-m`. ACs de regresión que este fix establece:

- **AC-1 — Ningún egreso huérfano por Combustible/Gasto:** con el admin en "Todas las sedes",
  registrar un egreso siempre resulta en una fila `expenses` con `branch_id NOT NULL`, o el
  guardado se rechaza con mensaje claro. Nunca `branch_id: null`.
- **AC-2 — Combustible exige vehículo:** el drawer no deja guardar un egreso tipo `combustible`
  sin un vehículo seleccionado. La sede del egreso = `vehicle.branch_id` (sede de origen,
  también para vehículos `both_branches`). Si el vehículo elegido tiene `branch_id` null (fila
  legacy), aparece el campo Sede como fallback obligatorio.
- **AC-3 — Anticipo exige instructor y funciona:** el drawer muestra un selector de instructor
  obligatorio para el tipo `anticipo`. Al guardar, el **componente** enruta ese tipo a
  `AnticiposFacade.registrarAnticipo()` (que ya tiene la lógica de notificación al instructor)
  con `instructor_id` y `payment_method` → fila válida en `instructor_advances` (hoy imposible),
  y luego llama `CuadraturaFacade.refresh()`. `CuadraturaFacade.registrarEgreso()` deja de
  insertar en `instructor_advances` (se elimina la rama `else` rota) y solo maneja
  `gasto`/`combustible`. La sede del anticipo se deriva downstream por join
  `instructors → users.branch_id`; no se escribe columna `branch_id` (la tabla no la tiene).
- **AC-4 — Gastos Varios exige sede:** el tipo `gasto` muestra campo Sede obligatorio,
  precargado con la sede activa si hay una; si el admin está en "Todas las sedes", obliga a
  elegir. `expenses.branch_id` nunca queda null.
- **AC-5 — Gasto Fijo exige sede:** `RegistrarGastoFijoDrawerComponent` (el de
  `features/admin/contabilidad-reportes/`) muestra campo Sede obligatorio con la misma regla que
  AC-4. `ReportesContablesFacade.registrarGastoFijo()` rechaza `branch_id` null.
- **AC-6 — Anticipos de cuadratura filtrados por sede:** `fetchExpensesAndAdvances()` filtra
  `instructor_advances` por la sede activa vía join a `instructors.users.branch_id` (hoy trae
  los de todas las sedes mezclados en una cuadratura de sede específica).
- **AC-7 — Sin regresión de datos existentes:** los egresos huérfanos ya en BD se dejan como
  están (decisión del owner 2026-09-09); no hay migración de backfill. El fix solo previene
  nuevos.

## Cambio

- **Archivo:** `src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.ts`
  - **Qué cambia:** campos condicionales por tipo — Combustible→Vehículo obligatorio;
    Anticipo→Instructor obligatorio (nuevo); Gasto→Sede obligatoria. Se elimina el campo
    Vehículo "opcional" siempre visible. Resuelve `branchId` / `instructorId` y los pasa al facade.
- **Archivo:** `src/app/core/facades/cuadratura.facade.ts`
  - **Qué cambia:** `registrarEgreso()` toma `branchId` explícito del formulario con guard
    anti-null; solo maneja `gasto`/`combustible` (se elimina la rama `else` que insertaba en
    `instructor_advances` sin `instructor_id`). `fetchExpensesAndAdvances()` filtra advances por
    sede vía join `instructors.users.branch_id`. No inyecta `AnticiposFacade` (el ruteo del tipo
    `anticipo` vive en el componente).
- **Archivo:** `src/app/core/models/ui/cuadratura.model.ts`
  - **Qué cambia:** `EgresoFormData` gana `branchId?: number | null` e `instructorId?: number | null`.
- **Archivo:** `src/app/core/facades/anticipos.facade.ts`
  - **Qué cambia:** `registrarAnticipo()` acepta `paymentMethod` y lo persiste (hoy asume el
    default `'efectivo'`).
- **Archivo:** `src/app/core/models/ui/anticipos.model.ts`
  - **Qué cambia:** `RegistrarAnticipoPayload` gana `paymentMethod?: 'efectivo' | 'transferencia' | 'tarjeta'`.
- **Archivo:** `src/app/features/admin/contabilidad-reportes/registrar-gasto-fijo-drawer.component.ts`
  - **Qué cambia:** campo Sede obligatorio (misma regla que Gastos Varios).
- **Archivo:** `src/app/core/facades/reportes-contables.facade.ts`
  - **Qué cambia:** `registrarGastoFijo()` toma `branchId` del payload con guard anti-null en
    vez de `_effectiveBranchId()`.
- **Archivo:** `src/app/core/models/ui/reportes-contables.model.ts` (o donde viva
  `RegistrarGastoFijoPayload`)
  - **Qué cambia:** el payload gana `branchId: number`.
- **Borrado:** `src/app/shared/components/registrar-gasto-fijo-drawer/` — código muerto, cero
  imports en `src/`.
- **Doc:** `indices/DOMAIN-GOTCHAS.md` — extender DG-082 con el precedente de "el gate en la
  página no alcanza si el mismo insert es alcanzable desde el dashboard u otra página no
  gateada" y el caso `fixed_expenses`.

## Test de Regresión

Todos verdes (`npm run test:ci`: 2352 passed, 0 failed). Los que prueban este fix:

**`src/app/core/facades/cuadratura.facade.spec.ts`** — `describe('CuadraturaFacade.registrarEgreso — gasto/combustible')`:
- `inserta en expenses con category="combustible" y el branchId recibido` ✓
- `inserta en expenses con category=null cuando tipo es "gasto"` ✓
- `rechaza el guardado y NO inserta cuando branchId es null (admin en "Todas las sedes")` ✓ (AC-1)
- `rechaza combustible sin vehiculoId` ✓ (AC-2)
- `rechaza tipo "anticipo" (se enruta por AnticiposFacade desde el componente)` ✓ (AC-3)
- `describe('...fetchExpensesAndAdvances — filtro de sede en anticipos')` → `agrega .eq("instructors.users.branch_id")…` / `NO filtra … "Todas las sedes"` ✓ (AC-6)

**`src/app/features/admin/contabilidad-cuadratura/registrar-egreso-drawer.component.spec.ts`**:
- `combustible: el form es inválido sin vehículo y válido al elegir uno` ✓ (AC-2)
- `combustible con vehículo legacy sin sede: aparece el campo Sede obligatorio` ✓ (AC-2)
- `combustible: envía branchId derivado del vehículo al facade` ✓ (AC-2)
- `gasto con admin en "Todas las sedes": el form es inválido hasta elegir sede` ✓ (AC-4)
- `gasto: precarga la sede activa del admin cuando hay una seleccionada` ✓ (AC-4)
- `gasto: secretaria no ve el campo Sede y el facade recibe su sede` ✓ (AC-4)
- `anticipo: exige instructor y NO llama a CuadraturaFacade.registrarEgreso` ✓ (AC-3)

**`src/app/core/facades/anticipos.facade.spec.ts`**:
- `persiste el paymentMethod recibido en el insert` ✓ (AC-3)
- `usa payment_method "efectivo" por defecto cuando no se pasa` ✓ (AC-3)

**`src/app/core/facades/reportes-contables.facade.spec.ts`**:
- `registrarGastoFijo usa el branchId explícito del payload por sobre la sede efectiva` ✓ (AC-5)
- `registrarGastoFijo rechaza y NO inserta cuando no hay sede (payload y selector null) — DG-082` ✓ (AC-5)
