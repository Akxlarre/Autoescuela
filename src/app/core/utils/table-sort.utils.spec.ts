import { describe, expect, it } from 'vitest';
import {
  ariaSortOf,
  nextSort,
  sortIconOf,
  sortRows,
  textSortKey,
  toggleSortDirection,
  type SortKey,
} from './table-sort.utils';

interface Row {
  id: number;
  name: string;
  amount: number | null;
}

type Field = 'name' | 'amount';

const keyOf = (row: Row, field: Field): SortKey =>
  field === 'name' ? textSortKey(row.name) : row.amount;

const ROWS: Row[] = [
  { id: 1, name: 'Óscar', amount: 20 },
  { id: 2, name: 'ana', amount: null },
  { id: 3, name: 'Bruno', amount: 100 },
  { id: 4, name: '—', amount: 20 },
];

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('sortRows (spec 0023-m)', () => {
  it('sin orden devuelve la misma lista', () => {
    expect(sortRows(ROWS, null, keyOf)).toBe(ROWS);
  });

  it('ordena texto sin distinguir tildes ni mayúsculas, con las filas sin dato al final', () => {
    expect(ids(sortRows(ROWS, { field: 'name', direction: 'asc' }, keyOf))).toEqual([2, 3, 1, 4]);
    expect(ids(sortRows(ROWS, { field: 'name', direction: 'desc' }, keyOf))).toEqual([1, 3, 2, 4]);
  });

  it('ordena números como números, conserva el orden de llegada en empates y deja null al final', () => {
    expect(ids(sortRows(ROWS, { field: 'amount', direction: 'asc' }, keyOf))).toEqual([1, 4, 3, 2]);
    expect(ids(sortRows(ROWS, { field: 'amount', direction: 'desc' }, keyOf))).toEqual([
      3, 1, 4, 2,
    ]);
  });

  it('no modifica la lista original', () => {
    const copy = [...ROWS];
    sortRows(ROWS, { field: 'name', direction: 'asc' }, keyOf);
    expect(ROWS).toEqual(copy);
  });
});

describe('nextSort / toggleSortDirection', () => {
  it('ascendente → descendente → orden por defecto; otra columna parte ascendente', () => {
    const asc = nextSort<Field>(null, 'name');
    expect(asc).toEqual({ field: 'name', direction: 'asc' });
    const desc = nextSort(asc, 'name');
    expect(desc).toEqual({ field: 'name', direction: 'desc' });
    expect(nextSort(desc, 'name')).toBeNull();
    expect(nextSort(desc, 'amount')).toEqual({ field: 'amount', direction: 'asc' });
  });

  it('invertir el sentido sin orden elegido no hace nada', () => {
    expect(toggleSortDirection(null)).toBeNull();
    expect(toggleSortDirection<Field>({ field: 'name', direction: 'asc' })).toEqual({
      field: 'name',
      direction: 'desc',
    });
  });
});

describe('ariaSortOf / sortIconOf', () => {
  it('solo la columna ordenada informa sentido y flecha', () => {
    const sort = { field: 'name' as Field, direction: 'desc' as const };
    expect(ariaSortOf(sort, 'name')).toBe('descending');
    expect(ariaSortOf(sort, 'amount')).toBe('none');
    expect(sortIconOf(sort, 'name')).toBe('chevron-down');
    expect(sortIconOf(sort, 'amount')).toBe('arrow-up-down');
    expect(sortIconOf(null, 'name')).toBe('arrow-up-down');
  });
});
