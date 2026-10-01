# Acceptance 0047-b — RLS: aislamiento por sede para la secretaria

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Estado:** ✅ PASA. Aplicada en la BD remota el 2026-10-01 (`supabase db push`, visto bueno del owner,
> registrada como `20261001150000`). Test re-corrido contra la BD real fuera de transacción: 0 fallos.

## Cómo se verificó

`supabase/tests/rls/0047-b-aislamiento-por-sede.sql` impersona 4 usuarios reales
(`secretaria@test.com` sede 1, `secretaria2@test.com` sede 2, `secretaria.multisede@test.com`
con grant, `admin@test.com`) y compara lo que cada uno ve/escribe contra la verdad calculada como
`postgres`. Las escrituras se deshacen siempre (sub-bloque que aborta con `ZZ001`).

## Rojo — BD remota actual (antes de la migración)

**24 casos fallan.** Extracto:

| Caso | Resultado |
|---|---|
| LEER `class_b_sessions` / sede1 | 864 filas de la otra sede |
| LEER `class_b_practice_attendance` / sede1 | 130 filas de la otra sede |
| LEER `class_b_theory_sessions` / sede1 | 48 filas de la otra sede |
| LEER `payments` / sede1 · sede2 | 115 · 61 filas de la otra sede |
| LEER `special_service_sales` / sede1 | 4 filas de la otra sede |
| LEER `instructor_advances`, `certificates`, `certificate_issuance_log` / sede1 | 2 filas de la otra sede c/u |
| UPDATE `class_b_sessions`, `payments`, `special_service_sales` (sede 2) | 1 fila afectada |
| DELETE `special_service_sales` (sede 2) | 1 fila borrada |
| INSERT `payments`, `special_service_sales`, `student_documents` (sede 2) | aceptado |
| UPDATE venta sede 1 → `branch_id = 2` | aceptado |

`UPDATE/DELETE` sobre `students` y `digital_contracts` de la otra sede ya daban 0 filas: su SELECT
filtra por sede y Postgres lo aplica al `WHERE` (ver DG-098).

## Verde — migración + test en la misma transacción, con ROLLBACK

**0 fallos en 75 verificaciones** (60 lecturas = 15 tablas × 4 personas; 15 escrituras, 1 SKIP por
no haber cursos singulares en la sede 2).

| AC | Evidencia |
|---|---|
| AC1 | Cada tabla: sede1 / sede2 ven solo lo suyo (ej. `class_b_sessions` 864 / 864, `payments` 61 / 115, `special_service_sales` 2 / 5, `certificates` 0 / 2) |
| AC2 | UPDATE/DELETE sobre la sede 2 → 0 filas; INSERT `class_b_sessions`, `payments`, `special_service_sales`, `student_documents` en la sede 2 → `42501 new row violates row-level security policy` |
| AC3 | Conteos de sede propia = verdad sin RLS; `UPDATE class_b_sessions` propia → 1 fila |
| AC4 | `secretaria_multi` = total en las 15 tablas (ej. 1.728 clases, 176 pagos) |
| AC5 | `admin` = total en las 15 tablas |
| AC6 | Las cláusulas de instructor/alumno se copiaron textualmente de `pg_policies` remoto (tabla de abajo) |
| AC-E1 | `school_documents` con `branch_id` NULL: 1 fila visible para sede1, sede2, multi y admin |
| AC-E2 | Regla de instructor "ambas sedes" incluida (`i.both_branches`); hoy hay 0 activos, no ejercitable con datos reales |
| AC-E3 | `UPDATE special_service_sales SET branch_id = 2` sobre una venta propia → `42501` |

## Rendimiento (DG-016)

Secretaria sede 1, ms (antes → después, mismo ensayo): `class_b_sessions` 85 → 97,
`payments` 9 → 13, `class_b_practice_attendance` 11 → 54, `v_class_b_schedule_availability`
59 → 21, `v_student_progress_b` 50 → 63. `EXPLAIN` de `payments`: `ANY (enrollment_id = (hashed
SubPlan))` con `loops=1` y `auth_user_branch_id()` como InitPlan: el alcance se calcula una vez por
query, no por fila.

## Snapshot previo (referencia de rollback) — `pg_policies` remoto, 2026-10-01

Cláusula de la secretaria antes del cambio, en cada policy tocada (el resto de cada expresión se
mantiene igual en la migración):

| Tabla | Policies | Antes |
|---|---|---|
| `class_b_sessions` | S / I / U / D | `auth_user_role() = ANY (ARRAY['admin','secretary'])` (+ instructor propio; + alumno en S) |
| `class_b_practice_attendance` | S / I / U | `auth_user_role() = ANY (ARRAY['admin','secretary','instructor'])` (+ alumno propio en S) |
| `class_b_practice_attendance` | D | `ARRAY['admin','secretary']` |
| `class_b_theory_sessions` | S | `ARRAY['admin','secretary','instructor','student']` |
| `class_b_theory_sessions` | I / U · D | `ARRAY['admin','secretary','instructor']` · `ARRAY['admin','secretary']` |
| `absence_evidence` | S / I / U · D | `ARRAY['admin','secretary']` (+ alumno propio) · `ARRAY['admin','secretary']` |
| `students` | I / U / D | `ARRAY['admin','secretary']` |
| `payments` | S (+ alumno) / I / U | `ARRAY['admin','secretary']` |
| `discount_applications` | S / I | `ARRAY['admin','secretary']` |
| `instructor_advances` | S (+ instructor propio) / I | `ARRAY['admin','secretary']` |
| `instructor_replacements` | S / I | `ARRAY['admin','secretary']` |
| `special_service_sales` | S (+ alumno) / I / U / D | `ARRAY['admin','secretary']` |
| `standalone_courses`, `standalone_course_enrollments` | S / I / U / D | `ARRAY['admin','secretary']` |
| `student_documents` | I | `ARRAY['admin','secretary']` (+ alumno propio) |
| `school_documents` | S / I | `ARRAY['admin','secretary']` |
| `digital_contracts` | I / U | `ARRAY['admin','secretary']` |
| `certificates` | S (+ alumno) / I | `ARRAY['admin','secretary']` |
| `certificate_issuance_log` | S | `ARRAY['admin','secretary']` |

## Hallazgos laterales

- **Parser de `indices/DATABASE.md`** (`scripts/lib/sql-schema.js`): descartaba toda policy cuyo
  cuerpo tuviera `JOIN … ON alias.col` (lo confundía con una policy sobre otro schema) y el `DROP`
  previo la borraba del índice. Corregido + caso en la micro-suite; recuperó además policies que ya
  faltaban (`weekly_signatures`, `promotion_course_lecturers`, `tasks_update`).
- `v_class_b_schedule_availability` ya filtraba por sede vía `JOIN enrollments`: con un instructor
  o vehículo "ambas sedes", la secretaria no ve como ocupado un horario tomado por la otra sede.
  Hoy no aplica (0 instructores `both_branches` activos). Follow-up, no cambia con esta spec.
