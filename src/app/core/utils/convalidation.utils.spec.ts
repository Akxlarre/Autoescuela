import { describe, expect, it, vi } from 'vitest';
import { fetchConvalidationMap } from './convalidation.utils';

function fakeSupabase(data: { enrollment_id: number; convalidated_license: 'A4' | 'A3' }[]) {
  const inFn = vi.fn().mockResolvedValue({ data, error: null });
  const selectFn = vi.fn().mockReturnValue({ in: inFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });
  return { from: fromFn } as any;
}

describe('fetchConvalidationMap', () => {
  it('retorna un Map vacío sin consultar BD cuando no hay enrollment ids', async () => {
    const supabase = fakeSupabase([]);
    const result = await fetchConvalidationMap(supabase, []);
    expect(result.size).toBe(0);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('mapea enrollment_id → convalidated_license para cada fila encontrada', async () => {
    const supabase = fakeSupabase([
      { enrollment_id: 10, convalidated_license: 'A4' },
      { enrollment_id: 22, convalidated_license: 'A3' },
    ]);

    const result = await fetchConvalidationMap(supabase, [10, 22, 33]);

    expect(result.get(10)).toBe('A4');
    expect(result.get(22)).toBe('A3');
    expect(result.has(33)).toBe(false);
    expect(supabase.from).toHaveBeenCalledWith('license_validations');
  });

  it('retorna Map vacío cuando la query no encuentra filas', async () => {
    const supabase = fakeSupabase([]);
    const result = await fetchConvalidationMap(supabase, [1, 2]);
    expect(result.size).toBe(0);
  });
});
