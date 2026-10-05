// supabase/functions/_shared/promotion-reservation.ts
//
// fix-322-m: deshace una promoción reservada por reserve_next_promotion_slot() cuyo armado
// (nombre/fecha de fin, cursos, libros) falló a mitad. Sin esto queda una planificada sin cursos
// que cuenta para el colchón y nunca se completa.
//
// Se borra en vez de marcarla 'cancelled': cancelada seguiría ocupando su start_date
// (UNIQUE branch_id, start_date) y la próxima reserva saltaría 14 días, dejando un hueco en la
// cadencia. Ninguna FK hacia promotion_courses es ON DELETE CASCADE salvo relatores y firmas
// semanales, así que el orden es: libros → sesiones → cursos → promoción.

/** Subconjunto del cliente de Supabase que usa la limpieza (permite testear sin BD). */
export interface DeleteClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): PromiseLike<{ data: { id: number }[] | null; error: unknown }>;
    };
    delete(): {
      in(column: string, values: unknown[]): PromiseLike<{ error: unknown }>;
      eq(column: string, value: unknown): PromiseLike<{ error: unknown }>;
    };
  };
}

function failIfError(table: string, error: unknown): void {
  if (error) {
    const message = (error as { message?: string }).message ?? String(error);
    throw new Error(`No se pudo borrar ${table} de la promoción reservada: ${message}`);
  }
}

export async function discardReservedPromotion(
  client: DeleteClient,
  promotionId: number,
): Promise<void> {
  const { data: courses, error: selectError } = await client
    .from('promotion_courses')
    .select('id')
    .eq('promotion_id', promotionId);
  failIfError('promotion_courses', selectError);

  const courseIds = (courses ?? []).map((c) => c.id);
  if (courseIds.length > 0) {
    for (const table of [
      'class_book',
      'professional_theory_sessions',
      'professional_practice_sessions',
    ]) {
      const { error } = await client.from(table).delete().in('promotion_course_id', courseIds);
      failIfError(table, error);
    }
  }

  const { error: coursesError } = await client
    .from('promotion_courses')
    .delete()
    .eq('promotion_id', promotionId);
  failIfError('promotion_courses', coursesError);

  const { error: promoError } = await client
    .from('professional_promotions')
    .delete()
    .eq('id', promotionId);
  failIfError('professional_promotions', promoError);
}
