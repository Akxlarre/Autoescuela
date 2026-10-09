# Fix: el resto de las tablas de Clase Profesional se leen y editan desde otra sede
> id: fix-353-m-rls-resto-de-tablas-profesional-por-sede
> refs: fix-319-m-testing-clase-profesional-piloto (T05, D25) · fix-321-m · ASG-i-025 · 0047-b
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
`fix-321-m` puso sede y rol en `professional_promotions`, `promotion_courses`, `class_book` y en
la escritura de `promotion_course_lecturers`. Las demás tablas de Clase Profesional conservan las
políticas de `20260301000011_10_rls_policies.sql` (y `20260403100000` para las firmas semanales):
solo exigen `auth_user_role() IN ('admin','secretary')`, sin sede.

Confirmado el 2026-10-07 en la BD de desarrollo (bloque 5 de `fix-319-m`): `secretaria@test.com`
(sede 1, sin Clase Profesional) lee lo mismo que el admin —1.480 sesiones teóricas, 1.480
prácticas, 7 relatores con RUT, 26 asignaciones de relator, 5 pre-inscripciones, 1 convalidación,
1 firma semanal— y un `UPDATE` suyo afectó 1 fila en las dos tablas de sesiones, en `lecturers` y
en `license_validations`. Las sesiones son el calendario del Libro de Clases y de su PDF.

Decisión D25 (Matías, 2026-10-07): los relatores son siempre de Clase Profesional y hay una sola
sede profesional → los ve solo quien tiene acceso a una sede con Clase Profesional.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **Migración nueva** `20261007130000_fix353_rls_resto_de_tablas_profesional_por_sede.sql`, mismo
  patrón que `fix-321-m` (admin todo; secretaria por sede o con acceso a ambas; cláusulas de
  alumno e instructor sin cambios):
  - Por la sede de la promoción del curso: `professional_theory_sessions`,
    `professional_practice_sessions`, `professional_weekly_signatures`, `session_machinery` y la
    lectura de `promotion_course_lecturers`.
  - Por la sede de la matrícula: `professional_theory_attendance`,
    `professional_practice_attendance`, `professional_module_grades`,
    `professional_final_records`, `license_validations`.
  - Por su columna `branch_id`: `professional_pre_registrations`.
  - `lecturers` (D25): secretaria con acceso a ambas sedes o cuya sede tiene `has_professional`.
- Sin cambios de código en `src/`. La migración la aplica Matías.

## Test de Regresión
Script por API (`fix353-verificar.cjs`, mismas 4 cuentas que `fix-321-m`):
- secretaria de la sede 1 → 0 filas en todas las tablas anteriores; `UPDATE` con el mismo valor
  → 0 filas.
- secretaria de la sede 2 y multisede → mismos conteos que el admin; `UPDATE` con el mismo valor
  → 1 fila en sesiones, relatores y convalidaciones.
- La Base B de la sede 1 sigue cargando (lee `license_validations` de sus propias matrículas).

## Progreso
- [x] Migración escrita. Script de regresión corrido ANTES de aplicarla: 11 fallos, los
  esperados (secretaria de la sede 1 lee y edita; ve las 5 pre-inscripciones, todas de la sede 2).
- [x] Matías aplicó la migración (2026-10-07).
- [x] Regresión por API en verde (21/21): la secretaria de la sede 1 lee 0 filas en las 12 tablas
  y sus `UPDATE` afectan 0 filas; la de la sede 2 y la multisede leen lo mismo que el admin
  (1.480 + 1.480 sesiones, 26 asignaciones, 7 relatores, 5 pre-inscripciones, 1 convalidación,
  1 firma) y editan; la sede 1 sigue leyendo sus 76 matrículas.
- [x] El `upsert` de convalidación que hace la matrícula: 1 fila como secretaria de la sede 2;
  rechazado para la de la sede 1 ("new row violates row-level security policy"). La matrícula
  completa por el asistente no se repitió: se probó la misma escritura por API.
- [x] Revisión en navegador como `secretaria2@test.com`: Libro de Clases 280 · A2 (Profesores
  7 módulos, Lista 2 alumnos, Calendario 65 filas, Firma Diaria 6 semanas), "Ver promoción" 280
  y el badge "Convalida A3" de la Base. Como `secretaria@test.com`, la Base B carga. Sin
  respuestas 4xx ni errores de consola en ninguna de las dos.
