# Fix: Confirmar matrícula falla con 22P02 por datos seed 'SEED-NNNNNN' corruptos
> id: fix-252-m-enrollment-number-seed-corrupto
> refs: —
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Root Cause
`get_next_enrollment_number()` (`supabase/migrations/20260311100000_...sql`) busca el
último `enrollments.number` no-draft del grupo (`branch_id` × `license_class`) ordenado
por `id DESC` y lo castea con `v_last_number::INT + 1`, asumiendo formato numérico
(`'0001'`, `'0002'`, ...).

Un script de seed local (no commiteado al repo) insertó ~100 matrículas de prueba con
`number = 'SEED-NNNNNN'` (ej. `'SEED-002945'`), `status = 'active'`, repartidas entre
`branch_id` 1 y 2 y casi todas las `license_class` (A2-A5, B). Cuando una de esas filas
queda como la de mayor `id` dentro de su grupo, el cast `'SEED-002945'::INT` revienta con
`22P02 invalid input syntax for type integer` al confirmar cualquier matrícula nueva de
ese grupo — reproducido por el owner en Paso 5 del flujo de matrícula.

## Decisión del equipo
Las filas `SEED-*` son datos de prueba que se necesitan y **no se eliminan** — se
renumeran al formato correcto.

## ACs Afectados
Ninguno — fix autónomo (bug reportado en uso manual, sin spec asociada).
- AC-1: Confirmar una matrícula nueva en cualquier grupo (sede × tipo de licencia) que
  tenga filas `SEED-*` no falla con 22P02.
- AC-2: Las filas `SEED-*` existentes quedan renumeradas con formato `NNNN` válido,
  únicas dentro de su grupo (`branch_id`, `license_group`), sin perder ningún otro dato.
- AC-3: Si en el futuro vuelve a aparecer un `number` no numérico, `get_next_enrollment_number()`
  lo ignora en vez de romper el cast.

## Cambio
- **Archivo:** `supabase/migrations/20260915100000_fix252_renumber_seed_enrollments.sql`
  - Renumera cada fila `number LIKE 'SEED-%'` con el siguiente correlativo válido de su
    grupo (`branch_id`, `license_group`), en orden de `id ASC`, partiendo del máximo
    numérico ya existente en ese grupo.
  - Recrea `get_next_enrollment_number()` agregando `AND e.number ~ '^[0-9]+$'` al filtro,
    para que un `number` no numérico nunca vuelva a llegar al cast `::INT`.

## Test de Regresión
No aplica test TS (cambio 100% SQL/BD). Verificación manual post-migración:
```sql
-- No debe quedar ninguna fila con number no numérico
SELECT count(*) FROM enrollments WHERE number !~ '^[0-9]+$' AND number IS NOT NULL;
-- => 0
```
Y confirmar una matrícula nueva vía la UI en un grupo que antes tenía filas `SEED-*`
(ej. branch_id=2, license_class='B') sin obtener 22P02.
