# Fix: Una promoción manual en un lunes futuro de la cadencia hace que el cron se salte los intermedios
> id: fix-344-m-el-cron-no-salta-lunes-de-la-cadencia
> refs: ASG-i-025 · fix-319-m (M08, D6) · fix-323-m · 0002-m
> status: done
> closed: 2026-10-06
> created: 2026-10-06

## Root Cause
`reserve_next_promotion_slot` (`20261005150000_fix323…sql:57-68`) calcula la próxima fecha como
**"la última promoción de la cadencia + 14 días"**, tomando la última de cualquier estado. Si el
admin programa a mano una promoción en un lunes de la cadencia más adelante (o queda una cancelada
ahí), esa pasa a ser "la última" y el cron reserva después de ella: los lunes de la cadencia que
quedaron en medio no se crean nunca.

Ejemplo real del testing (M08): con una promoción en el 30-11-2026 (lunes de la cadencia), la
siguiente automática habría sido el 14-12 y **el 16-11 no se habría creado**. Contradice D6: "la
cadencia no debe correrse por una manual".

## ACs Afectados
- `0002-m` — cadencia automática de 14 días sin huecos.

## Cambio
- **Migración nueva** — `reserve_next_promotion_slot`: la próxima fecha pasa a ser **el primer
  lunes libre de la cadencia después de la última promoción de la cadencia que ya partió** (en curso
  o finalizada), en vez de "después de la última de cualquier estado". Si ninguna partió todavía,
  se cuenta desde la más antigua de la cadencia; con la tabla vacía, desde el ancla (igual que hoy).
  Colchón, número, permisos y bloqueo quedan igual que en `fix-323-m`. **La aplica Matías.**
- `supabase/tests/promotions/fix-322-323-reserve-promotion-slot.sql` — caso nuevo C.
- `supabase/functions/auto-create-next-promotions/index.test.ts` — mismo caso en Deno.
- `indices/DATABASE.md` — descripción de la función.

No toca el frontend ni la edge function.

## Test de Regresión
- Caso C del test SQL (lo corre Matías en el SQL Editor; aborta siempre a propósito): con una en
  curso el 12-01 y una manual en la cadencia el 23-02, reserva el **26-01** (antes: 09-03); con una
  segunda llamada no reserva más. Los casos A, B y D siguen dando lo mismo.

## Progreso
- [x] Migración `20261006160000_fix344_reserve_promotion_slot_sin_saltar_lunes_de_la_cadencia.sql`.
- [x] Caso C en el test SQL (el mensaje final ahora dice `RESULTADO fix-322/323/344`) y test Deno
  equivalente. **Ninguno ejecutado**: la función solo corre con `service_role` y no hay Postgres
  local. Revisados a mano contra la función nueva: A `{1,1,0,0,0}` (26-01, 09-02), B 09-02 con
  número 9501, C 26-01, D 0 reservas.
- [x] `indices/DATABASE.md`.
- [x] Matías aplicó la migración y corrió
  `supabase/tests/promotions/fix-322-323-reserve-promotion-slot.sql` en el SQL Editor (2026-10-06).
  Resultado: `RESULTADO fix-322/323/344: TODO OK` — A reservas {1,1,0,0,0} (2026-01-26,
  2026-02-09); B código 9501, fecha 2026-02-09; **C fecha 2026-01-26**; D sede 2 real 0 reservas.
