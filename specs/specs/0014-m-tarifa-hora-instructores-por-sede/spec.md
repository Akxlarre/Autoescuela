# Spec 0014 — Tarifa por hora de instructores configurable por sede

> **Status:** done
> **Created:** 2026-09-07
> **Owner:** Matías
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** iniciativa interna — revisión de la vista de Liquidaciones de Instructores
(`admin/contabilidad-liquidaciones`).

**Persona afectada:** Admin (dueño de la autoescuela).

**Problema que resuelve:**
Hoy el valor pagado por hora equivalente a los instructores está **hardcodeado en `5.000` CLP**
(`AMOUNT_PER_HOUR_DEFAULT` en `LiquidacionesFacade`, y `AMOUNT_DEFAULT` en la Edge Function
`generate-payroll-report`). El código lee `payment?.amount_per_hour` como si viniera de la BD,
pero esa columna no existe en ninguna tabla ni migración — es código muerto que siempre cae al
default. Si la autoescuela sube la tarifa, o si cada sede paga distinto, no hay forma de
cambiarlo sin tocar código y redesplegar.

**Hipótesis de valor:**
El Admin puede ajustar la tarifa por hora de cada sede desde Ajustes sin intervención de
desarrollo, y la vista de Liquidaciones (base ganada, total a pagar, KPIs y export) refleja el
nuevo valor.

---

## 2. User Stories

- **US1**: Como Admin, quiero definir la tarifa por hora de instructores de cada sede desde la
  vista de Ajustes, para que las liquidaciones se calculen con el valor real que paga esa sede.
- **US2**: Como Admin, quiero que la tarifa sea global por sede (no por instructor), para
  mantener la configuración simple y homogénea dentro de cada sede.
- **US3**: Como Admin viendo "Todas las escuelas" en Liquidaciones, quiero que cada instructor
  se calcule con la tarifa de **su** sede, para que el consolidado sea correcto.
- **US4**: Como Instructor, quiero que mi liquidación muestre el monto calculado con la tarifa
  vigente de mi sede, sin que yo pueda editarla.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un Admin en Ajustes → tab "Ajustes", When abre la nueva sección "Tarifa por
  Hora de Instructores", Then ve un selector de sede y el valor actual de `amount_per_hour` de
  cada sede, editable.
- **AC2**: Given el Admin edita la tarifa de una sede y guarda, When la operación termina, Then
  se persiste en `branch_payroll_config` para esa sede (`updated_by` = su `users.id`,
  `updated_at` = ahora) y un toast confirma el guardado.
- **AC3**: Given una sede con tarifa `X`, When se abre la vista de Liquidaciones filtrada por
  esa sede, Then la columna "Base (Ganado)" de cada instructor = `total_equivalent × X`, y
  "Total a Pagar" = `max(0, base − anticipos)`.
- **AC4**: Given el Admin en Liquidaciones con filtro "Todas las escuelas", When se listan
  instructores de sedes con tarifas distintas, Then cada fila usa la tarifa de la sede del
  instructor (`users.branch_id`), no una tarifa única.
- **AC5**: Given una tarifa cambiada, When se recarga la vista de Liquidaciones del mismo
  período, Then los KPIs del hero (Total Nómina, Pagados) y el export (Excel/PDF vía
  `generate-payroll-report`) usan el nuevo valor.
- **AC6**: Given un usuario Instructor o Secretaria, When intenta escribir en
  `branch_payroll_config` (directo por API), Then RLS lo rechaza; solo puede `SELECT`.
- **AC7**: Given un usuario no-admin, When abre Ajustes, Then la sección "Tarifa por Hora de
  Instructores" no se muestra.

### Edge cases obligatorios

- **AC-E1**: Given una sede sin fila en `branch_payroll_config` (p. ej. sede nueva creada luego
  del seed), When se calcula su liquidación, Then se usa el fallback `5.000` y la vista no
  rompe.
- **AC-E2**: Given el Admin ingresa un valor vacío o negativo en el input de tarifa, When
  intenta guardar, Then el guardado se bloquea (CHECK `>= 0` en BD + validación en UI) y no se
  persiste.
- **AC-E3**: Given una liquidación **ya pagada** (`instructor_monthly_payments` con
  `payment_status='paid'`, `base_salary`/`net_payment` snapshot), When cambia la tarifa de la
  sede después, Then el registro persistido en `instructor_monthly_payments` **no se reescribe**
  (ninguna ruta de código hace UPDATE de `base_salary` al cambiar la tarifa) y `deshacerPago`
  sigue funcionando. Nota: la columna "Base (Ganado)" de la tabla es y seguía siendo un valor
  vivo `total_equivalent × tarifa_vigente` para todas las filas — mostrar el snapshot en filas
  pagadas es un comportamiento preexistente fuera del scope de esta spec (ver Out of scope,
  "Recalcular liquidaciones históricas").

---

## 4. Out of scope

- ❌ Tarifa por instructor individual (queda global por sede por decisión de negocio).
- ❌ Tarifa por tipo de clase (teórica vs práctica) o por licencia — hoy solo hay horas
  equivalentes de Clase B práctica.
- ❌ Historial / versionado de tarifas en el tiempo (solo se guarda el valor vigente +
  `updated_at`). Recalcular liquidaciones históricas.
- ❌ Cambiar la fórmula `total_equivalent = practical_sessions × 0.75` (trigger de BD).
- ❌ Editar la tarifa desde la propia vista de Liquidaciones (solo desde Ajustes).
- ❌ Permitir a la Secretaria editar la tarifa.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- `LiquidacionesFacade` + `LiquidacionesContentComponent` (vista actual de liquidaciones).
- `AjustesDrawerComponent` con tab "Ajustes" y patrón de cards que hacen
  `layoutDrawer.push(<DrawerComponent>)` (precedente: "Precios de Cursos" →
  `PreciosCursosDrawerComponent`).
- `BranchFacade` con `branches()` y `selectedBranchId()`.
- `AuthFacade.currentUser()` con `role` y `dbId`.
- Tabla `branches` y `instructor_monthly_hours` (poblada por trigger).
- Edge Function `generate-payroll-report`.

### Capacidades nuevas requeridas
- Tabla nueva `branch_payroll_config` (una fila por sede) con RLS.
- Facade nuevo `PayrollConfigFacade` (o extensión acordada en plan).
- Drawer nuevo `TarifaInstructoresDrawerComponent` en `features/admin/configuracion-nomina/`.

---

## 6. Datos y modelo (preliminar)

**Tabla nueva `branch_payroll_config`:**

| Columna | Tipo | Notas |
|---|---|---|
| `branch_id` | INT PK → `branches(id)` | una fila por sede |
| `amount_per_hour` | INTEGER NOT NULL DEFAULT 5000 | CHECK `>= 0` |
| `updated_at` | TIMESTAMPTZ DEFAULT now() | refrescar en cada UPDATE |
| `updated_by` | INT → `users(id)` NULL | quién hizo el último cambio |

- **Seed:** una fila por cada sede existente con `amount_per_hour = 5000` (comportamiento
  idéntico al actual tras desplegar).
- **RLS:** `SELECT` para `admin`, `secretary`, `instructor`; `INSERT`/`UPDATE` solo `admin`;
  sin `DELETE`.
- Migración idempotente en `supabase/migrations/`, documentar en `indices/DATABASE.md`.

**Modelo UI nuevo:** `BranchPayrollConfig` en `core/models/ui/` (o `dto/`, a definir en plan).

**Cambios de cálculo:**
- `LiquidacionesFacade.fetchLiquidacionesData()` — 5ª query a `branch_payroll_config`, arma
  `Map<branchId, amountPerHour>`; resuelve la tarifa por `users.branch_id` de cada instructor.
  Elimina el `payment?.amount_per_hour` muerto. `5000` queda como constante fallback.
- `generate-payroll-report/index.ts` — misma resolución por sede; quita el `.select(... ,
  amount_per_hour)` roto.

---

## 7. UX y flujos (preliminar)

**Pantallas afectadas:**
- `AjustesDrawerComponent` (tab "Ajustes"): card nueva "Tarifa por Hora de Instructores"
  (solo `@if (isAdmin())`), botón que hace `layoutDrawer.push(TarifaInstructoresDrawerComponent,
  'Tarifa Instructores', 'banknote')`.
- `TarifaInstructoresDrawerComponent` (nuevo): clon estructural de `PreciosCursosDrawerComponent`
  — selector de sede + input `$ / hora` por sede + botón "Guardar" por fila con estado de
  guardado. Formato CLP con `Intl.NumberFormat('es-CL')`.
- Vista Liquidaciones: sin cambios de UI; solo cambia el número calculado.

**Flujo principal:** Admin abre Ajustes → "Tarifa por Hora de Instructores" → elige sede →
edita valor → Guardar → toast OK → al volver a Liquidaciones de una sede afectada, base y total
reflejan la nueva tarifa.

**Estados especiales:**
- Loading: skeletons en el drawer mientras carga la config.
- Error de guardado: toast de error, el valor no cambia.
- Sede sin config: el input muestra el fallback `5.000` y guardar crea la fila (upsert).

**Refresco de Liquidaciones tras cambiar tarifa:** a definir en plan — o suscribir
`branch_payroll_config` al canal realtime existente de `LiquidacionesFacade`, o refresco manual
del Admin. Preferencia: realtime para consistencia con el resto del patrón.

---

## 8. Métricas de éxito post-launch

- Cero cambios de código para ajustar tarifas de instructores.
- La tarifa configurada coincide con la usada en el cálculo y en el export (validación cruzada).

---

## 9. Notas / decisiones abiertas

- [x] Tabla dedicada `branch_payroll_config` vs. columna en `branches` → **tabla dedicada**
  (acordado con el owner, encaja con precedente de descuentos/precios y deja espacio a futuros
  parámetros de nómina).
- [ ] ¿`PayrollConfigFacade` nuevo o método en `LiquidacionesFacade`? → propuesta: facade
  nuevo, resolver en `plan.md`.
- [ ] ¿Refresco de Liquidaciones tras cambio de tarifa vía realtime o manual? → resolver en
  `plan.md`.
- [ ] Modelo en `dto/` (mapea tabla 1:1) vs `ui/` → resolver en `plan.md`.

---

## Changelog

- 2026-09-07 — draft inicial por Matías
