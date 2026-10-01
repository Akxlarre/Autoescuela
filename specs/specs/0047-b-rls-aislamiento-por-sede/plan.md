# Plan 0047-b — RLS: aislamiento por sede para la secretaria (tablas del piloto)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (owner, 2026-10-01: "empieza y trabaja autónomamente"; aplicar en remoto queda sujeto a su visto bueno)
> **Created:** 2026-10-01
> **Talla:** M

---

## 1. Resumen ejecutivo

Una migración idempotente que (a) crea 4 helpers `SECURITY DEFINER` que responden "¿esta fila
está en una sede visible para el usuario actual?" para tablas sin `branch_id` directo, y (b)
reescribe las policies de 17 tablas para que la cláusula de **secretaria** pase por esos helpers
(o por `branch_visible(branch_id)` cuando la tabla tiene la columna). Las cláusulas de admin,
instructor y alumno se copian **textualmente** de `pg_policies` remoto.

Sin cambios en `src/app`: los facades ya filtran por sede, así que la app ve lo mismo.

## 2. Patrón

```
<cmd>_<tabla>:  auth_user_role() = 'admin'
             OR (auth_user_role() = 'secretary' AND <alcance por sede>)
             OR <cláusulas de instructor/alumno vigentes, sin tocar>
```

Para `UPDATE` no se declara `WITH CHECK`: Postgres aplica el `USING` también a la fila nueva, lo
que impide mover una fila a la otra sede (AC-E3).

### Helpers nuevos (`SECURITY DEFINER`, `STABLE`, `search_path = ''`)

| Helper | Regla | Espejo de |
|---|---|---|
| `enrollment_branch_visible(enrollment_id)` | `branch_visible(enrollments.branch_id)`; `false` si no existe | policies de `digital_contracts` / `student_documents` |
| `class_b_session_branch_visible(session_id)` | la matrícula de la clase | — |
| `student_user_branch_visible(user_id)` | grant multi-sede **o** `users.branch_id = sede propia` | `select_students` |
| `instructor_branch_visible(instructor_id)` | `branch_visible(users.branch_id)` **o** `instructors.both_branches` | `select_instructors` |

Por qué `SECURITY DEFINER`: evitan recursión de RLS (la policy de `students` no puede consultar
`students` con RLS) y son más baratas que un `IN (subquery)` por fila. Solo devuelven un booleano
sobre el usuario actual: no filtran datos.

## 3. Tablas y cláusula de secretaria

| Tabla | S | I | U | D | Alcance |
|---|---|---|---|---|---|
| `class_b_sessions` | ✓ | ✓ | ✓ | ✓ | `enrollment_branch_visible(enrollment_id)` |
| `class_b_practice_attendance` | ✓ | ✓ | ✓ | ✓ | `class_b_session_branch_visible(class_b_session_id)` |
| `class_b_theory_sessions` | ✓ | ✓ | ✓ | ✓ | `branch_visible(branch_id)` |
| `absence_evidence` | ✓ | ✓ | ✓ | ✓ | `enrollment_branch_visible(enrollment_id)` |
| `students` | — | ✓ | ✓ | ✓ | `student_user_branch_visible(user_id)` |
| `payments` | ✓ | ✓ | ✓ | (admin) | `enrollment_branch_visible(enrollment_id)` |
| `discount_applications` | ✓ | ✓ | (admin) | (admin) | `enrollment_branch_visible(enrollment_id)` |
| `instructor_advances` | ✓ | ✓ | (admin) | (admin) | `instructor_branch_visible(instructor_id)` |
| `instructor_replacements` | ✓ | ✓ | (admin) | (admin) | `instructor_branch_visible(absent_instructor_id)` |
| `special_service_sales` | ✓ | ✓ | ✓ | ✓ | `branch_visible(branch_id)` |
| `standalone_courses` | ✓ | ✓ | ✓ | ✓ | `branch_visible(branch_id)` |
| `standalone_course_enrollments` | ✓ | ✓ | ✓ | ✓ | `branch_visible(curso.branch_id)` (subquery sobre `standalone_courses`) |
| `student_documents` | — | ✓ | — | — | `enrollment_branch_visible(enrollment_id)` |
| `school_documents` | ✓ | ✓ | (admin) | (admin) | `branch_visible(branch_id)` |
| `digital_contracts` | — | ✓ | ✓ | — | `enrollment_branch_visible(enrollment_id)` |
| `certificates` | ✓ | ✓ | (admin) | (admin) | matrícula visible, o (sin matrícula) alumno visible |
| `certificate_issuance_log` | ✓ | (admin) | (admin) | (admin) | `EXISTS` sobre `certificates` (hereda su RLS) |

"—" = la policy vigente ya filtra por sede y no se toca. "(admin)" = ya es solo admin.

## 4. Verificación

`supabase/tests/rls/0047-b-aislamiento-por-sede.sql`: un bloque `DO` que impersona
(`set_config('request.jwt.claims')` + `SET LOCAL ROLE authenticated`) a una secretaria de cada
sede, a la multi-sede y al admin, y lanza `RAISE EXCEPTION` ante cualquier fuga o regresión.
Se corre dentro de `BEGIN; <migración>; <test>; ROLLBACK;` contra la BD remota antes de aplicar, y
solo `<test>` después de aplicar. Usa las cuentas de prueba existentes (`secretaria@test.com`,
`secretaria2@test.com`, `secretaria.multisede@test.com`, `admin@test.com`), resueltas por email.

AC6 se verifica con un snapshot de `pg_policies` antes/después.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Una policy mal escrita deja a alguien sin ver sus datos | AC3/AC4/AC5 en el test; ensayo en `ROLLBACK` antes de aplicar |
| Flujo legítimo que cruza sedes (alumno de B matriculándose en A) | Ya bloqueado hoy por `update_users` (sede); no empeora. Documentado |
| Rendimiento (helper por fila) | Tablas < 2k filas; helpers `STABLE` sobre PK |
| BD remota difiere de migraciones | Cláusulas copiadas de `pg_policies` remoto, no de las migraciones |

## 6. Rollback

Las policies anteriores están transcritas en el comentario de cabecera de la migración (derivadas
de `pg_policies` remoto 2026-10-01). Revertir = migración nueva que las recrea.
