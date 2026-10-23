import { fetchAllPages } from './paged-fetch.utils';

/** Simula una tabla de `total` filas servida por `range(from, to)` inclusivo, como PostgREST. */
function fakeTable(total: number, failOnCall?: number) {
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    if (failOnCall === calls.length) return { data: null, error: { message: 'boom' } };
    const rows = [];
    for (let i = from; i <= Math.min(to, total - 1); i++) rows.push({ id: i });
    return { data: rows, error: null };
  };
  return { calls, fetchPage };
}

describe('fetchAllPages (fix-457-m)', () => {
  it('junta todas las páginas aunque pasen del tope de 1.000', async () => {
    const t = fakeTable(2500);
    const res = await fetchAllPages(t.fetchPage, 1000);

    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2500);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('pide una página extra cuando el total es múltiplo exacto del tamaño', async () => {
    const t = fakeTable(2000);
    const res = await fetchAllPages(t.fetchPage, 1000);

    expect(res.data).toHaveLength(2000);
    expect(t.calls).toHaveLength(3);
  });

  it('tabla vacía → una sola llamada y arreglo vacío', async () => {
    const t = fakeTable(0);
    const res = await fetchAllPages(t.fetchPage, 1000);

    expect(res).toEqual({ data: [], error: null });
    expect(t.calls).toHaveLength(1);
  });

  it('error en una página → devuelve ese error y data null', async () => {
    const t = fakeTable(2500, 2);
    const res = await fetchAllPages(t.fetchPage, 1000);

    expect(res.data).toBeNull();
    expect(res.error).toEqual({ message: 'boom' });
    expect(t.calls).toHaveLength(2);
  });
});
