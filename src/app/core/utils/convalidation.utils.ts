import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Trae, para un set de enrollment ids, cuáles tienen convalidación simultánea
 * registrada en `license_validations` (fix-195). Usado por todos los facades
 * de Clase Profesional que listan alumnos por fila, para exponer el badge
 * "Convalida A4"/"Convalida A3" — hasta este fix esa información quedaba
 * escrita en BD pero invisible en toda la UI.
 */
export async function fetchConvalidationMap(
  supabase: SupabaseClient,
  enrollmentIds: number[],
): Promise<Map<number, 'A4' | 'A3'>> {
  const map = new Map<number, 'A4' | 'A3'>();
  if (enrollmentIds.length === 0) return map;

  const { data } = await supabase
    .from('license_validations')
    .select('enrollment_id, convalidated_license')
    .in('enrollment_id', enrollmentIds);

  for (const row of (data ?? []) as {
    enrollment_id: number;
    convalidated_license: 'A4' | 'A3';
  }[]) {
    map.set(row.enrollment_id, row.convalidated_license);
  }

  return map;
}
