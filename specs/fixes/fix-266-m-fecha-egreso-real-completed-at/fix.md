# Fix: La "fecha de egreso" de Ex-Alumnos no es la fecha en que el alumno egresó
> id: fix-266-m-fecha-egreso-real-completed-at
> refs: fix-264-m (bug B16), fix-012-i, fix-147-b
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

**Ningún flujo guarda cuándo una matrícula pasa a `completed`.** Ex-Alumnos (B y Profesional,
`ExAlumnosFacade`) usa `enrollments.updated_at` como si fuera la fecha de egreso, pero ese campo
no significa eso:

- "Marcar como Ex-Alumno" (`fix-012-i`) solo escribe `status = 'completed'`; no hay trigger de
  `updated_at` en `enrollments`, así que la fecha **no se mueve al egresar**.
- El trigger que recalcula el saldo al registrar un pago sí escribe `updated_at`, así que la fecha
  **se mueve después de egresar** si el ex-alumno paga una deuda.

Confirmado en navegador por `fix-264-m` (B16): una matrícula con último cambio en 2024, marcada
como ex-alumno hoy, aparece en Ex-Alumnos con año 2024 — fuera del período por defecto "Últimos
12 meses" (`fix-147-b`), o sea invisible salvo que se la busque por nombre.

La fecha se usa en la columna "Año", en el filtro de período y en el conteo "egresados del año"
de las tasas.

**Decisión (Matías, 2026-10-01):** columna nueva `enrollments.completed_at`; los egresados que ya
existen se rellenan con su `updated_at` actual (no hay registro de la fecha real, y así nadie
cambia de lugar en la lista).

## ACs Afectados

Ninguno de una spec previa. Fix autónomo.

- AC-1: existe `enrollments.completed_at`. Un trigger la fija en `NOW()` cuando una matrícula pasa
  a `completed`, por cualquier vía (la ficha, el cierre de una promoción profesional de
  `fix-196-m`, una edición manual), y la vuelve a `NULL` si deja de estar `completed`.
- AC-2: las matrículas que ya estaban `completed` quedan con `completed_at = updated_at`.
- AC-3: Ex-Alumnos (B y Profesional) calcula el año y la fecha de egreso desde `completed_at`, y
  ordena por ella.
- AC-4: el conteo "egresados del año" de las tasas filtra por `completed_at`.
- AC-5: registrar un pago de un ex-alumno no cambia su fecha de egreso.

## Cambio

- **Archivo:** `supabase/migrations/20261001120000_enrollments_add_completed_at.sql` (nuevo)
- **Qué cambia:** columna, relleno de las existentes y trigger `trg_enrollments_completed_at`.
- **Archivo:** `src/app/core/facades/ex-alumnos.facade.ts`
- **Qué cambia:** lee, ordena y filtra por `completed_at` en vez de `updated_at`.
- **Archivo:** `src/app/core/models/ui/egresado-table.model.ts`
- **Qué cambia:** solo los comentarios de `anio` / `fechaEgreso` (decían "derivado de updated_at").
- **Archivo:** `indices/DATABASE.md`, `indices/DOMAIN-GOTCHAS.md` (DG-097)
- **Qué cambia:** documenta la columna y el trigger, y por qué `updated_at` no sirve como fecha
  de una transición de estado.

## Aplicación en la BD de desarrollo (2026-10-01)

- Aplicada con `npx supabase db push`. Verificado después: 17 matrículas `completed`, las 17 con
  `completed_at = updated_at`; 0 de las 189 restantes tienen `completed_at`.
- Para poder aplicarla hubo que marcar `20260924120000_class_book_alter_convalidation_license`
  (spec `0018-m`) como aplicada en el historial (`supabase migration repair --status applied`),
  sin re-ejecutarla: figuraba como pendiente porque se aplicó a mano, y su columna
  `class_book.convalidation_license` ya existía. Solo se comprobó la columna, no las constraints.

## Test de Regresión

- `src/app/core/facades/ex-alumnos.facade.spec.ts > fecha de egreso — fix-266-m` ✓ (2 tests,
  más el de `loadStatistics` que ahora exige el filtro por `completed_at`)
- `e2e/alumnos-b-ficha.spec.ts > O01 · O03 · O04` ✓ — sin marca `knownBug`: un alumno con
  matrícula de 2024 marcado hoy aparece en Ex-Alumnos con el año actual.
- `e2e/alumnos-b-ficha.spec.ts > fecha de egreso en la BD` ✓ — el trigger fija la fecha al
  completar, no la mueve un cambio de saldo y la borra al reactivar (AC-1, AC-5).

Verificado el 2026-10-01: `npx vitest run` 2811 tests en verde, `npm run lint:arch` 0 errores,
`e2e/alumnos-b-ficha.spec.ts` 29/29 esperados.

## Fuera de alcance

- El año se calcula en UTC (`new Date(completed_at).getFullYear()`, `slice(0, 10)`): un egreso
  del 31 de diciembre por la noche cae en el año siguiente. Es el caso U07 de `024b` y va con
  `ASG-i-054` (fechas de negocio en UTC).
