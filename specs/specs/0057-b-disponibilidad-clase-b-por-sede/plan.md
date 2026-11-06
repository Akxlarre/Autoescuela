# Plan 0057-b — La disponibilidad de Clase B dice de qué sede es cada horario

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-11-06
> **Talla:** M (1–2 días). 1 migración de vista, 4 facades, 1 edge function, tests SQL/unit/e2e.

---

## 1. Resumen ejecutivo

La vista suma una columna `branch_ids integer[]` (las sedes que puede atender cada horario) en
vez de una fila por sede. Así se conserva la garantía de fix-227-b (una fila por horario) y el
admin en "Todas las sedes" no necesita deduplicar. Cada consumidor filtra con
`.contains('branch_ids', [sede])`. Orden: migración + test SQL → facades (TDD) → edge function →
e2e F08 → índices.

### ⚠️ Decisión de diseño que ajusta la spec

La spec dice `branch_id` (AC1) y "sin duplicados en Todas las sedes" (AC5). Con una columna
escalar, un instructor y vehículo "ambas sedes" vuelven a salir dos veces por horario y se rompe
fix-227-b (test `supabase/tests/agenda/fix-227-b-horarios-ambas-sin-duplicados.sql`). Con
`branch_ids` (arreglo) AC5 se cumple en la vista misma. **AC1 pasa a: "cada fila trae
`branch_ids` = las sedes de los cursos de los que sale ese horario"**. Se actualiza `spec.md` al
aprobar este plan.

### ⚠️ Ajuste a AC8

`student-payment` → `load-instructor-schedule` está marcada en su propio encabezado como
**"legacy, sin uso desde fix-017"** y ningún archivo de `src/` la llama. Se deja fuera (no se
redespliega `student-payment`); AC8 queda solo para `public-enrollment`. Borrar la acción
legacy es otra tarea.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/migrations/20261106150000_spec0057b_disponibilidad_por_sede.sql` | Migración | Copia de la vista de `20261019120000_spec0052_feriados.sql` + `branch_ids` al final |
| `supabase/tests/agenda/0057-b-disponibilidad-por-sede.sql` | Test SQL | AC1, AC2/AC3 (a nivel vista), AC5, AC-E1, AC-E2. En un sub-bloque que aborta (patrón fix-227-b) |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/agenda.facade.ts` | `fetchAvailableSlots(rangeStart, rangeEnd, branchId)`: si `branchId !== null`, `.contains('branch_ids', [branchId])`. Se quita el filtro client-side por instructores de la sede (líneas ~324-330), que queda cubierto | AC2, AC3, AC4, AC5 |
| `src/app/core/facades/enrollment.facade.ts` | `loadInstructors(branchId)` guarda `_scheduleBranchId`; `loadScheduleGrid()` y `handleScheduleChange()` filtran por él. Sin cambio de firma (los dos llamados del wizard ya llaman antes a `loadInstructors`) | AC6 |
| `src/app/core/facades/admin-alumno-detalle.facade.ts` | `loadScheduleGrid()` filtra por `this._alumno()?.branchId` (si es `null`, sin filtro, como hoy) | AC7 |
| `src/app/core/facades/public-enrollment.facade.ts` | `loadInstructors(branchId)` guarda la sede; `load-schedule` (carga y polling) la envía en el body | AC8 |
| `supabase/functions/public-enrollment/index.ts` | `handleLoadSchedule`: si llega `branchId`, `.contains('branch_ids', [branchId])`; sin `branchId`, como hoy (clientes con el bundle viejo durante el deploy) | AC8 |
| `src/app/core/facades/*.spec.ts` (los 4 de arriba) | Tests del filtro: con sede → `contains`; sin sede / admin "Todas" → sin filtro | testing-tdd |
| `e2e/agenda-4.spec.ts` | F08/F03: F08 pasa de anotar a **esperar 0** horarios "Disponible" en la sede 2; F03 sigue > 0 en ambas | AC2, AC4 |
| `indices/DATABASE.md` | Fila de `v_class_b_schedule_availability`: columna `branch_ids` y por qué es arreglo | Sincronizar |
| `indices/FACADES.md` | Nota en Agenda/Enrollment/AlumnoDetalle/PublicEnrollment: filtran la disponibilidad por sede | Sincronizar |
| `specs/specs/0057-b-…/spec.md` | AC1 (`branch_ids`) y AC8 (sin `student-payment`) | Decisiones de arriba |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

- `AgendaFacade.getActiveBranchId()` (`resolveBranchScope`) — ya da `null` para "Todas" y la sede
  para secretaria/admin con sede. Se pasa a `fetchAvailableSlots`.
- `createRequestGuard()` — ya protege `loadScheduleGrid`/`handleScheduleChange`; no cambia.
- Patrón de test SQL de `fix-227-b-horarios-ambas-sin-duplicados.sql` (marcar "ambas" dentro de un
  bloque que aborta con `ZZ001`, leer como postgres y como `secretaria2`).
- e2e `F08/F03` de `agenda-4.spec.ts` (ya marca/restaura y mide).

Nada nuevo que crear fuera de la migración y su test.

---

## 4. Modelo de datos

### Migración

```sql
-- 20261106150000_spec0057b_disponibilidad_por_sede.sql
-- Copia de la vista de 20261019120000 (spec 0052-b). Único cambio: el SELECT final.
-- CREATE OR REPLACE VIEW solo permite AGREGAR columnas al final → branch_ids va última.
slots AS (
  SELECT i.id AS instructor_id, va.vehicle_id, cs.branch_id,   -- + cs.branch_id
         ...                                                    -- resto idéntico
),
...
SELECT
  instructor_id, vehicle_id, slot_start, slot_end,
  CASE WHEN is_available THEN 'available' ELSE 'occupied' END AS slot_status,
  array_agg(DISTINCT branch_id ORDER BY branch_id) AS branch_ids
FROM slot_availability
GROUP BY instructor_id, vehicle_id, slot_start, slot_end, is_available;
-- GROUP BY reemplaza al DISTINCT de fix-227-b: misma fila única por horario.
ALTER VIEW ... SET (security_invoker = true);   -- se mantiene
COMMENT ON VIEW ...                              -- se actualiza
```

- `is_available` no depende de la sede (el choque es global, fix-196-b), así que agrupar por él
  no parte filas.
- Los filtros del cliente por `instructor_id` y `slot_start` son columnas del `GROUP BY`:
  Postgres los sigue empujando dentro de la vista (lo que hizo rápida la Agenda en
  hotfix-003-i). El filtro por `branch_ids` se aplica después, sobre pocas filas.
- **Se aplica en producción (`skvekgg`) solo tras confirmarlo con el owner**, y antes del deploy
  del front (el front viejo no lee la columna nueva: el orden es seguro).

### RLS

Sin cambios. La vista sigue `security_invoker`; qué filas genera depende igual que hoy de la RLS
de `instructors`/`users`/`vehicles`/`vehicle_assignments`/`courses` (AC-E2 lo verifica).

### Modelos

- `RawSlot` (privado de `agenda.facade.ts`) suma `branch_ids: number[]`. Los demás consumidores
  leen `select('*')` sin tipo propio de fila; no hace falta un DTO nuevo.

---

## 5. Arquitectura del feature

```
v_class_b_schedule_availability (+branch_ids)
   ├─ AgendaFacade.fetchAvailableSlots ── .contains(branch_ids,[sede activa]) | sin filtro en "Todas"
   ├─ EnrollmentFacade.loadScheduleGrid / handleScheduleChange ── sede de loadInstructors()
   ├─ AdminAlumnoDetalleFacade.loadScheduleGrid ── sede del alumno
   └─ edge public-enrollment (load-schedule) ◄── PublicEnrollmentFacade envía branchId
```

Capas: solo Facades + migración + edge function. Sin cambios en Smart/Dumb components.

---

## 6. Restricciones aplicables

- [x] `architecture.md` — la lógica queda en los Facades
- [x] `facades.md` — branch-scoped: el filtro usa la sede vigente; requestGuard intacto
- [ ] `models.md` — sin DTO nuevo (tipo privado de fila)
- [ ] `visual-system.md` — sin cambios visuales
- [x] `swr-pattern.md` — el refresco silencioso de la Agenda y el Realtime de la matrícula pasan por el mismo filtro
- [ ] `notifications.md`
- [x] `testing-tdd.md` — specs de los 4 facades antes del cambio
- [ ] `ai-readability.md`
- [x] `dates.md` — sin cambios en fechas, la vista sigue con `chile_today()`

---

## 7. Plan de testing

- **SQL** (`0057-b-disponibilidad-por-sede.sql`, en un bloque que aborta):
  - AC1: toda fila tiene `branch_ids` no vacío y ⊆ {sedes con curso Clase B activo}.
  - AC2/AC3: instructor "ambas" + vehículo sede 1 → filas con `branch_ids = {1}`, ninguna con 2.
  - AC5: instructor y vehículo "ambas" → una fila por horario con `branch_ids = {1,2}` (re-corre
    la aserción de fix-227-b).
  - AC-E1: para instructores de una sede, `count(*)` y el conjunto
    `(instructor, vehicle, slot_start, slot_status)` idénticos a la vista anterior (se compara
    contra una copia temporal de la definición vieja creada en el mismo bloque).
  - AC-E2: como `secretaria2` (sede 2), mismas filas que antes del cambio.
- **AC9**: `EXPLAIN ANALYZE` impersonando a la secretaria (semana de la Agenda) y al admin (28
  días), antes y después, dentro de una transacción revertida. Umbral: ≤ +20 %.
- **Unit (Vitest)**: los 4 facades — con sede → la consulta lleva `contains('branch_ids',[n])`;
  admin "Todas"/alumno sin sede → no lleva.
- **e2e**: `agenda-4` F08/F03 (F08 espera 0), y re-correr `agenda`, `agenda-2`, `agenda-3`,
  `agenda-4`, y las suites de matrícula que leen la grilla.
- **QA manual**: matrícula de secretaria paso 2 en la sede 2 con un instructor "ambas" de
  prueba (marcado y restaurado, como en el e2e).

---

## 8. Riesgos

1. **Migración de la vista en producción** — es la vista más sensible al rendimiento (fix-032,
   hotfix-003-i, fix-196-b). Mitigación: AC9 medido antes de aplicar; `CREATE OR REPLACE`
   idempotente; rollback = re-aplicar la definición de `20261019120000`.
2. **Orden de despliegue** — migración primero (el front viejo ignora la columna), luego front y
   edge function. Al revés, el front nuevo filtra por una columna que no existe → error 400 en la
   Agenda. El orden va explícito en `tasks.md`.
3. **La edge function no valida la sede al crear la matrícula** — el filtro está en la lectura;
   un cliente manipulado podría enviar horarios de otra sede. Hoy pasa lo mismo con cualquier
   horario (el trigger solo impide choques). Se anota, fuera de alcance.
4. **Cliente con el bundle viejo durante el deploy** — la edge function sin `branchId` responde
   como hoy (sin filtro), así que no rompe.

---

## 9. Orden de implementación

1. Test SQL (rojo) → migración → test SQL (verde) en una transacción revertida contra `skvekgg`.
2. Medición AC9 (antes/después, revertida).
3. **Pausa: confirmar con el owner la aplicación de la migración en producción.**
4. Specs de los 4 facades (rojo) → cambios en facades (verde).
5. Edge function `public-enrollment` + su parte del facade público. **Pausa: confirmar el deploy.**
6. e2e F08 → esperar 0; correr las suites de Agenda.
7. `npm run test:ci`, `npm run lint:arch`, `/verify` de la Agenda en sede 2.
8. Índices (`DATABASE.md`, `FACADES.md`) y `spec.md` (AC1, AC8).
