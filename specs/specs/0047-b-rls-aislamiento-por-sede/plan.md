# Plan 0047-b — RLS: aislamiento por sede para la secretaria (tablas del piloto)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (owner, 2026-10-01: "empieza y trabaja autónomamente"; aplicar en remoto queda sujeto a su visto bueno)
> **Created:** 2026-10-01
> **Talla:** M

---

## 1. Resumen ejecutivo

Una migración idempotente que reescribe las policies de 17 tablas para que la cláusula de
**secretaria** exija la sede, sin funciones nuevas. Las cláusulas de admin, instructor y alumno se
copian **textualmente** de `pg_policies` remoto.

> **Cambio de diseño durante la ejecución (2026-10-01):** la primera versión usaba helpers
> `SECURITY DEFINER` que recibían la fila (`enrollment_branch_visible(enrollment_id)`, etc.).
> Se descartó por DG-016: una función `SECURITY DEFINER` en una policy corre una vez **por fila**
> y ya causó timeouts dos veces (fix-060/061). Se reemplazó por expresiones inline que Postgres
> evalúa una vez por query (abajo). Las secciones 2 y 3 reflejan el diseño final.

Sin cambios en `src/app`: los facades ya filtran por sede, así que la app ve lo mismo.

## 2. Patrón

```
<cmd>_<tabla>:  auth_user_role() = 'admin'
             OR (auth_user_role() = 'secretary' AND <alcance por sede>)
             OR <cláusulas de instructor/alumno vigentes, sin tocar>
```

Para `UPDATE` no se declara `WITH CHECK`: Postgres aplica el `USING` también a la fila nueva, lo
que impide mover una fila a la otra sede (AC-E3).

### Alcance por sede (replica `branch_visible()`, evaluado una vez por query)

Con `G = (SELECT auth_can_access_both_branches())` y `B = (SELECT auth_user_branch_id())`
(ambos InitPlan):

| Forma | Expresión |
|---|---|
| `branch_id` directo | `G OR branch_id IS NULL OR branch_id = B` |
| Vía matrícula | `G OR enrollment_id IN (SELECT e.id FROM enrollments e WHERE e.branch_id IS NULL OR e.branch_id = B)` |
| Vía instructor | `G OR instructor_id IN (SELECT i.id FROM instructors i JOIN users u … WHERE i.both_branches OR u.branch_id IS NULL OR u.branch_id = B)` (= `select_instructors`) |
| Alumno (`students`) | `G OR EXISTS (users u WHERE u.id = students.user_id AND u.branch_id = B)` (= `select_students`, fix-061) |

El `IN (subquery)` no correlacionado se planifica como `hashed SubPlan` (una vez por query).

## 3. Tablas y cláusula de secretaria

| Tabla | S | I | U | D | Alcance |
|---|---|---|---|---|---|
| `class_b_sessions` | ✓ | ✓ | ✓ | ✓ | vía matrícula |
| `class_b_practice_attendance` | ✓ | ✓ | ✓ | ✓ | vía clase → matrícula |
| `class_b_theory_sessions` | ✓ | ✓ | ✓ | ✓ | `branch_id` directo |
| `absence_evidence` | ✓ | ✓ | ✓ | ✓ | vía matrícula |
| `students` | — | ✓ | ✓ | ✓ | alumno |
| `payments` | ✓ | ✓ | ✓ | (admin) | vía matrícula |
| `discount_applications` | ✓ | ✓ | (admin) | (admin) | vía matrícula |
| `instructor_advances` | ✓ | ✓ | (admin) | (admin) | vía instructor |
| `instructor_replacements` | ✓ | ✓ | (admin) | (admin) | vía instructor ausente |
| `special_service_sales` | ✓ | ✓ | ✓ | ✓ | `branch_id` directo |
| `standalone_courses` | ✓ | ✓ | ✓ | ✓ | `branch_id` directo |
| `standalone_course_enrollments` | ✓ | ✓ | ✓ | ✓ | vía curso |
| `student_documents` | — | ✓ | — | — | vía matrícula |
| `school_documents` | ✓ | ✓ | (admin) | (admin) | `branch_id` directo |
| `digital_contracts` | — | ✓ | ✓ | — | vía matrícula |
| `certificates` | ✓ | ✓ | (admin) | (admin) | vía matrícula, o (sin matrícula) vía alumno |
| `certificate_issuance_log` | ✓ | (admin) | (admin) | (admin) | `certificate_id IN (SELECT id FROM certificates)` (hereda su RLS) |

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
