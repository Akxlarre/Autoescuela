# Fix: Sin promoción en curso, la creación automática reserva hasta 10 promociones por llamada
> id: fix-322-m-cron-promociones-sin-en-curso
> refs: fix-319-m-testing-clase-profesional-piloto (S2) · 0002-m · ASG-i-025
> status: in_progress
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

## ACs Afectados
- `0002-m` — colchón de 1 en curso + 2 planificadas: el fix hace que se respete también sin una
  en curso.

## Cambio
- **Migración nueva** — el corte del RPC deja de depender de que exista una en curso (p. ej.
  `planned >= 2`, o `in_progress + planned >= 3`).
- **`supabase/functions/auto-create-next-promotions/index.ts`** — si el armado falla, borrar la
  promoción reservada (o marcarla `cancelled`) antes de relanzar el error.
- Coordinar con `fix-323-m`, que toca el mismo RPC.
- La migración la aplica Matías y la función la despliega Matías.

## Test de Regresión
- Test SQL/Deno sobre el RPC: con 0 en curso y 2 planificadas, no reserva.
- Test de la función: un fallo simulado en el armado no deja promociones planificadas sin cursos.
