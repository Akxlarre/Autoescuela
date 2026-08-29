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

      // Colchón: 1 in_progress + 1 planned → falta exactamente 1 planned.
      await setup`
        INSERT INTO professional_promotions
          (code, name, start_date, end_date, status, current_day, branch_id)
        VALUES
          ('9001', 'Test activa', '2026-01-01', '2026-02-01', 'in_progress', 0, ${branchId}),
          ('9002', 'Test planificada', '2026-02-15', '2026-03-15', 'planned', 0, ${branchId})
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
