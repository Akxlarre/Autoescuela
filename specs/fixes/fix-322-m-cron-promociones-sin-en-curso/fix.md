# Fix: Sin promoción en curso, la creación automática reserva hasta 10 promociones por llamada
> id: fix-322-m-cron-promociones-sin-en-curso
> refs: fix-319-m-testing-clase-profesional-piloto (S2) · 0002-m · ASG-i-025
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
`reserve_next_promotion_slot` (`20260829110000_promotions_unique_start_date_and_lock_fn.sql:68-70`)
solo corta cuando hay `in_progress >= 1 AND planned >= 2`. Si no hay ninguna en curso (se finalizó
o canceló a mano la única, que D3b permite), la condición nunca se cumple y el loop de
`auto-create-next-promotions` (`for i < 10`) reserva 10 planificadas por llamada, todos los días.

Además, la reserva (INSERT con `end_date = start_date`) y el armado (nombre, fecha de fin, cursos,
libros) son pasos separados sin rollback: si falla el fetch de feriados o un INSERT, queda una
promoción planificada sin cursos que cuenta para el colchón y nunca se completa.

Confirmado leyendo el código el 2026-10-05; no se ejecutó (requiere la service key y crearía
promociones reales).

**Agregado al implementar (2026-10-05), misma sospecha S2 ("invocable por cualquiera"):** la RPC
`reserve_next_promotion_slot` es `SECURITY DEFINER` y no tiene `REVOKE`; `20260513000002` da
`EXECUTE` sobre todas las funciones de `public` a `authenticated`. Probado con la **anon key sin
sesión** y una sede inexistente: la función se ejecutó hasta el INSERT (falló por
`professional_promotions_code_key`, sin dejar filas). Es decir, la protección de `fix-043-i` en la
edge function se salta llamando directo a la RPC. El inventario `037 §1.4` ya la lista como
"Ya reportada · 025 · S2"; el resto de las RPC abiertas es de `ASG-i-047`.

## ACs Afectados
- `0002-m` — colchón de 1 en curso + 2 planificadas: el fix hace que se respete también sin una
  en curso.

## Cambio
- **Migración nueva** — el corte del RPC pasa a `planned >= 2` (el colchón son 2 planificadas por
  delante; que haya o no una en curso no cambia cuántas faltan). `REVOKE EXECUTE … FROM PUBLIC,
  anon, authenticated` + `GRANT … TO service_role`.
- **`supabase/functions/auto-create-next-promotions/index.ts`** — si el armado falla, borrar lo
  reservado (libros, sesiones teóricas y prácticas, cursos y la promoción; ninguna FK es
  `ON DELETE CASCADE`) antes de relanzar el error. Marcarla `cancelled` no sirve: seguiría
  ocupando su `start_date` y la cadencia saltaría 14 días.
- **`supabase/functions/_shared/promotion-reservation.ts`** — esa limpieza, testeable sin BD.
- Coordinar con `fix-323-m`, que toca el mismo RPC.
- La migración la aplica Matías y la función la despliega Matías.

## Test de Regresión
- `supabase/functions/auto-create-next-promotions/index.test.ts` (requiere Supabase local): con 0 en
  curso, llamadas sucesivas reservan exactamente 2 y la tercera no reserva.
- `supabase/functions/_shared/promotion-reservation.test.ts`: la limpieza borra en orden libros →
  sesiones → cursos → promoción.
- Por API tras aplicar: la anon key y un usuario autenticado reciben error de permisos al llamar
  la RPC.

## Progreso
- [x] Migración `20261005140000_fix322_reserve_promotion_slot_colchon_y_permisos.sql`.
- [x] Limpieza `_shared/promotion-reservation.ts` + `try/catch` en la función. Tests Deno 3/3 en
  verde. `deno check` de la función no corre en este entorno (faltan paquetes npm de supabase-js).
- [x] Caso nuevo en `index.test.ts` escrito; **no ejecutado** (Docker apagado, requiere Supabase
  local).
- [x] Matías aplicó la migración y desplegó `auto-create-next-promotions` (2026-10-05).
- [x] Regresión por API: la RPC rechaza anon y authenticated (`42501 permission denied`).
- [x] Test SQL `supabase/tests/promotions/fix-322-323-reserve-promotion-slot.sql` (caso A) en verde,
  corrido por Matías en el SQL Editor.
  Resultado (Matías, SQL Editor, 2026-10-05): `RESULTADO fix-322/323: TODO OK` — A reservas {1,1,0,0,0} (2026-01-26, 2026-02-09); B código 9501 fecha 2026-02-09; D sede 2 real 0 reservas.
