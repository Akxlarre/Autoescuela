// supabase/functions/auto-create-next-promotions/index.test.ts
//
// Test de regresión de fix-228-m: dos invocaciones concurrentes de
// reserve_next_promotion_slot() (Postgres, migración
// `20260829110000_promotions_unique_start_date_and_lock_fn.sql`) no deben
// crear más de una promoción cuando solo falta una para completar el
// colchón. Antes del fix, la Edge Function calculaba "cuántas faltan" con
// dos SELECT sueltos y recién insertaba varios pasos async después — dos
// ejecuciones solapadas podían leer el mismo conteo desactualizado y ambas
// insertar. Ahora la reserva (contar + decidir + INSERT del placeholder)
// vive en una sola función Postgres protegida con pg_advisory_xact_lock,
// así que solo una de las dos llamadas concurrentes puede insertar.
//
// Requiere Supabase local corriendo (`supabase start` / `supabase db
// reset`) — se conecta directo a Postgres, no pasa por la Edge Function
// (que además necesita fetch externo de feriados, fuera del alcance de
// este test de concurrencia).
//
//   supabase start
//   deno test --allow-net --allow-env supabase/functions/auto-create-next-promotions/index.test.ts

import { assertEquals } from 'jsr:@std/assert';
import postgres from 'npm:postgres@3';

const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

Deno.test({
  name: 'reserve_next_promotion_slot: dos llamadas concurrentes con 1 slot faltante solo insertan 1 fila',
  async fn() {
    // Dos conexiones separadas — necesarias para que las llamadas corran en
    // paralelo de verdad (una sola conexión serializa sus propias queries).
    const sqlA = postgres(LOCAL_DB_URL, { max: 1 });
    const sqlB = postgres(LOCAL_DB_URL, { max: 1 });
    const setup = postgres(LOCAL_DB_URL, { max: 1 });

    let branchId: number;
    try {
      // Sede de prueba dedicada — no toca branch_id=2 (datos reales).
      const [branch] = await setup<{ id: number }[]>`
        INSERT INTO branches (name) VALUES ('fix-228-m test branch') RETURNING id
      `;
      branchId = branch.id;

      // Colchón: 1 in_progress + 1 planned → falta exactamente 1 planned. Fechas en la cadencia
      // (2026-07-27 + 14k, fix-323-m): fuera de ella no cuentan para el colchón.
      await setup`
        INSERT INTO professional_promotions
          (code, name, start_date, end_date, status, current_day, branch_id)
        VALUES
          ('9001', 'Test activa', '2026-01-12', '2026-02-13', 'in_progress', 0, ${branchId}),
          ('9002', 'Test planificada', '2026-01-26', '2026-02-27', 'planned', 0, ${branchId})
      `;

      // Dos invocaciones concurrentes del mismo slot.
      const [resultA, resultB] = await Promise.all([
        sqlA`SELECT * FROM reserve_next_promotion_slot(${branchId})`,
        sqlB`SELECT * FROM reserve_next_promotion_slot(${branchId})`,
      ]);

      const reservedRows = [...resultA, ...resultB];
      assertEquals(
        reservedRows.length,
        1,
        `esperaba exactamente 1 reserva entre las 2 llamadas concurrentes, hubo ${reservedRows.length}`,
      );

      const [{ count: plannedCount }] = await setup<{ count: string }[]>`
        SELECT count(*) FROM professional_promotions
        WHERE branch_id = ${branchId} AND status = 'planned'
      `;
      assertEquals(Number(plannedCount), 2, 'el colchón de planificadas no debe superar 2');

      // Colchón ya completo (2 planned + 1 in_progress) → una tercera llamada no reserva nada.
      const resultC = await setup`SELECT * FROM reserve_next_promotion_slot(${branchId})`;
      assertEquals(resultC.length, 0, 'con el colchón completo no debe reservar un slot más');
    } finally {
      await setup`DELETE FROM professional_promotions WHERE branch_id = ${branchId!}`;
      await setup`DELETE FROM branches WHERE id = ${branchId!}`;
      await sqlA.end();
      await sqlB.end();
      await setup.end();
    }
  },
});

// fix-322-m: sin ninguna promoción en curso, la condición vieja (`in_progress >= 1 AND
// planned >= 2`) nunca se cumplía y la Edge Function reservaba 10 por llamada (su tope).
Deno.test({
  name: 'reserve_next_promotion_slot: sin promoción en curso reserva hasta 2 planificadas y para',
  async fn() {
    const sql = postgres(LOCAL_DB_URL, { max: 1 });
    let branchId: number;
    try {
      const [branch] = await sql<{ id: number }[]>`
        INSERT INTO branches (name) VALUES ('fix-322-m test branch') RETURNING id
      `;
      branchId = branch.id;
      // Solo una finalizada (la única en curso se cerró a mano): 0 en curso, 0 planificadas.
      await sql`
        INSERT INTO professional_promotions
          (code, name, start_date, end_date, status, current_day, branch_id)
        VALUES ('9101', 'Test finalizada', '2026-01-05', '2026-02-06', 'finished', 0, ${branchId})
      `;

      const reservas: number[] = [];
      for (let i = 0; i < 5; i++) {
        const rows = await sql`SELECT * FROM reserve_next_promotion_slot(${branchId})`;
        reservas.push(rows.length);
      }
      assertEquals(
        reservas,
        [1, 1, 0, 0, 0],
        'debe reservar exactamente 2 y después no reservar más',
      );
    } finally {
      await sql`DELETE FROM professional_promotions WHERE branch_id = ${branchId!}`;
      await sql`DELETE FROM branches WHERE id = ${branchId!}`;
      await sql.end();
    }
  },
});

// fix-323-m: las promociones manuales (cualquier lunes, con número) no corren ni traban la
// cadencia automática. Antes la reserva tomaba "la última con número + 14 días" y "su número + 1".
Deno.test({
  name: 'reserve_next_promotion_slot: una manual fuera de la cadencia no la corre y el número no choca',
  async fn() {
    const sql = postgres(LOCAL_DB_URL, { max: 1 });
    let branchId: number;
    try {
      const [branch] = await sql<{ id: number }[]>`
        INSERT INTO branches (name) VALUES ('fix-323-m test branch') RETURNING id
      `;
      branchId = branch.id;
      await sql`
        INSERT INTO professional_promotions
          (code, name, start_date, end_date, status, current_day, branch_id)
        VALUES
          ('9201', 'Automática en curso', '2026-01-12', '2026-02-13', 'in_progress', 0, ${branchId}),
          ('9202', 'Manual en la cadencia', '2026-01-26', '2026-02-27', 'planned', 0, ${branchId}),
          ('9500', 'Manual fuera de la cadencia', '2026-02-02', '2026-03-06', 'planned', 0, ${branchId})
      `;

      // Solo 1 planificada de la cadencia (la de 01-26) → reserva 1: el lunes de cadencia
      // siguiente a 01-26 (no a 02-02) y el número mayor + 1 (no 9203, que podría estar usado).
      const [primera] = await sql<{ reserved_code: string; start: string }[]>`
        SELECT reserved_code, reserved_start_date::text AS start
          FROM reserve_next_promotion_slot(${branchId})
      `;
      assertEquals(primera.start, '2026-02-09');
      assertEquals(primera.reserved_code, '9501');

      // Ahora hay 2 planificadas de la cadencia → no reserva más (la manual no cuenta).
      const segunda = await sql`SELECT * FROM reserve_next_promotion_slot(${branchId})`;
      assertEquals(segunda.length, 0);
    } finally {
      await sql`DELETE FROM professional_promotions WHERE branch_id = ${branchId!}`;
      await sql`DELETE FROM branches WHERE id = ${branchId!}`;
      await sql.end();
    }
  },
});

// fix-344-m: una manual puesta en un lunes futuro de la cadencia ocupa su lunes, pero no corre el
// punto de partida. Antes la reserva era "la última de la cadencia + 14" y saltaba los intermedios.
Deno.test({
  name: 'reserve_next_promotion_slot: una manual en un lunes futuro de la cadencia no hace saltar los intermedios',
  async fn() {
    const sql = postgres(LOCAL_DB_URL, { max: 1 });
    let branchId: number;
    try {
      const [branch] = await sql<{ id: number }[]>`
        INSERT INTO branches (name) VALUES ('fix-344-m test branch') RETURNING id
      `;
      branchId = branch.id;
      await sql`
        INSERT INTO professional_promotions
          (code, name, start_date, end_date, status, current_day, branch_id)
        VALUES
          ('9301', 'Automática en curso', '2026-01-12', '2026-02-13', 'in_progress', 0, ${branchId}),
          ('9302', 'Manual en la cadencia, más adelante', '2026-02-23', '2026-03-27', 'planned', 0, ${branchId})
      `;

      // Primer lunes libre de la cadencia tras la que ya partió (01-12): 01-26, no 03-09.
      const [primera] = await sql<{ start: string }[]>`
        SELECT reserved_start_date::text AS start FROM reserve_next_promotion_slot(${branchId})
      `;
      assertEquals(primera.start, '2026-01-26');

      // 2 planificadas de la cadencia (01-26 y la manual de 02-23) → no reserva más.
      const segunda = await sql`SELECT * FROM reserve_next_promotion_slot(${branchId})`;
      assertEquals(segunda.length, 0);
    } finally {
      await sql`DELETE FROM professional_promotions WHERE branch_id = ${branchId!}`;
      await sql`DELETE FROM branches WHERE id = ${branchId!}`;
      await sql.end();
    }
  },
});
