// supabase/functions/_shared/promotion-reservation.test.ts
//
// fix-322-m: si el armado de una promoción reservada falla a mitad, la Edge Function
// auto-create-next-promotions borra lo reservado para no dejar una planificada sin cursos que
// cuente para el colchón. Ninguna FK es ON DELETE CASCADE, así que el orden importa.
//
//   deno test supabase/functions/_shared/promotion-reservation.test.ts

import { assertEquals, assertRejects } from 'jsr:@std/assert';
import { discardReservedPromotion, type DeleteClient } from './promotion-reservation.ts';

type Op = string;

function fakeClient(courseIds: number[], failOn?: string): { client: DeleteClient; ops: Op[] } {
  const ops: Op[] = [];
  const result = (table: string) => ({
    error: failOn === table ? { message: `fallo ${table}` } : null,
  });
  const client: DeleteClient = {
    from(table: string) {
      return {
        select: (_cols: string) => ({
          eq: (col: string, value: unknown) => {
            ops.push(`select ${table} ${col}=${value}`);
            return Promise.resolve({ data: courseIds.map((id) => ({ id })), error: null });
          },
        }),
        delete: () => ({
          in: (col: string, values: unknown[]) => {
            ops.push(`delete ${table} ${col} in [${values.join(',')}]`);
            return Promise.resolve(result(table));
          },
          eq: (col: string, value: unknown) => {
            ops.push(`delete ${table} ${col}=${value}`);
            return Promise.resolve(result(table));
          },
        }),
      };
    },
  };
  return { client, ops };
}

Deno.test('discardReservedPromotion: borra libros → sesiones → cursos → promoción', async () => {
  const { client, ops } = fakeClient([11, 12]);
  await discardReservedPromotion(client, 7);
  assertEquals(ops, [
    'select promotion_courses promotion_id=7',
    'delete class_book promotion_course_id in [11,12]',
    'delete professional_theory_sessions promotion_course_id in [11,12]',
    'delete professional_practice_sessions promotion_course_id in [11,12]',
    'delete promotion_courses promotion_id=7',
    'delete professional_promotions id=7',
  ]);
});

Deno.test('discardReservedPromotion: sin cursos creados → solo borra la promoción', async () => {
  const { client, ops } = fakeClient([]);
  await discardReservedPromotion(client, 7);
  assertEquals(ops, [
    'select promotion_courses promotion_id=7',
    'delete promotion_courses promotion_id=7',
    'delete professional_promotions id=7',
  ]);
});

Deno.test(
  'discardReservedPromotion: un borrado que falla corta y lanza (no borra la promoción)',
  async () => {
    const { client, ops } = fakeClient([11], 'promotion_courses');
    await assertRejects(() => discardReservedPromotion(client, 7), Error, 'promotion_courses');
    assertEquals(ops.includes('delete professional_promotions id=7'), false);
  },
);
