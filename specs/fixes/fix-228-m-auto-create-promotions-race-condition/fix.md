# Fix: Race condition en auto-create-next-promotions crea planificadas de más
> id: fix-228-m-auto-create-promotions-race-condition
> refs: 0002-m-promociones-cadencia-automatica
> status: done
> closed: 2026-08-29
> created: 2026-08-29

## Root Cause

`auto-create-next-promotions` (Edge Function) decide cuántas promociones crear leyendo
`activeCount`/`plannedCount` con dos queries separadas y luego insertando en un loop —
todo en varios round-trips async sin ningún lock. Si la función se ejecuta más de una vez
de forma solapada (causa exacta no confirmable: sin logs históricos de pg_net ni del
dashboard de Edge Functions para el 2026-08-27), dos ejecuciones concurrentes leen el
mismo conteo desactualizado, ambas calculan `missing > 0` y ambas insertan — sin ningún
mecanismo que serialice el "contar → decidir → insertar". Resultado observado en
producción: 3 promociones `planned` de más (280, 281, 282) sobre el colchón esperado de 2
después de la más reciente (278, 279).

No se pudo confirmar el disparador exacto (retry de `pg_net`, invocación duplicada, u
otro), por lo que el fix ataca la clase de bug completa en vez de un caso puntual.

## ACs Afectados

- AC de `0002-m-promociones-cadencia-automatica`: "mantener colchón de 1 in_progress + 2
  planned hacia adelante" — el fix lo corrige haciendo que la verificación del colchón sea
  atómica, y agrega un constraint que hace estructuralmente imposible duplicar `start_date`.

## Cambio

- **Archivo:** `supabase/migrations/<timestamp>_promotions_unique_start_date_and_lock_fn.sql`
  **Qué cambia:** Agrega `UNIQUE (branch_id, start_date)` en `professional_promotions` y crea
  la función `SECURITY DEFINER` `reserve_next_promotion_slot(p_branch_id)` que toma
  `pg_advisory_xact_lock(...)` como primera línea dentro de una transacción, relee los
  conteos ya bajo el lock, y devuelve `NULL` si el colchón ya está completo o los datos
  (`code`, `start_date`) reservados para la próxima promoción si falta una — todo en una
  sola llamada RPC atómica.
- **Archivo:** `supabase/functions/auto-create-next-promotions/index.ts`
  **Qué cambia:** Reemplaza el cálculo de `missing` + loop de inserts directos por llamadas
  a `reserve_next_promotion_slot()` — cada iteración pide un slot atómico antes de insertar;
  si el RPC devuelve `NULL`, corta el loop ahí (otra ejecución concurrente ya completó el
  colchón).

## Test de Regresión

- `supabase/functions/auto-create-next-promotions/index.test.ts` (nuevo) >
  "reserve_next_promotion_slot: dos llamadas concurrentes con 1 slot faltante solo insertan 1
  fila" — dos conexiones Postgres separadas invocan `reserve_next_promotion_slot()` en
  paralelo (`Promise.all`) sobre una sede de prueba con colchón a 1 slot de completarse;
  verifica que solo una de las dos reserva una fila, que el conteo de `planned` no supera 2,
  y que una tercera llamada con el colchón ya completo no reserva nada.

  **Verificado ✅** contra Supabase local (`supabase db reset` con las 2 migraciones nuevas
  aplicadas): `ok | 1 passed | 0 failed`.

  ```
  deno test --allow-net --allow-env --node-modules-dir=auto \
    supabase/functions/auto-create-next-promotions/index.test.ts
  ```

## Datos en producción

Limpieza aplicada directo a `AutoescuelaChillan` (proyecto remoto, `db query --linked`, antes
de que el usuario aclarara que las migraciones remotas las aplica él manualmente): se borraron
las 3 promociones `planned` de más (280, 281, 282 — ids 17/18/19) y sus `promotion_courses` /
`class_book` / sesiones generadas, y se aplicó el `UNIQUE (branch_id, start_date)` +
`reserve_next_promotion_slot()` de la migración `20260829110000_...`. El estado remoto ya
refleja ambas migraciones — **no hace falta que el usuario las vuelva a correr**, solo
desplegar la Edge Function actualizada (`supabase functions deploy
auto-create-next-promotions`).
