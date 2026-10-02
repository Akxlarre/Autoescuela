import { describe, expect, it } from 'vitest';
import { withAllOption } from './filter-options.utils';

describe('withAllOption', () => {
  const base = [
    { label: 'Activo', value: 'active' },
    { label: 'Inactivo', value: 'inactive' },
  ];

  it('antepone la opción "todos" con valor null por defecto', () => {
    expect(withAllOption(base, 'Todos los estados')).toEqual([
      { label: 'Todos los estados', value: null },
      ...base,
    ]);
  });

  it('usa el valor por defecto que recibe (filtros que parten en cadena vacía)', () => {
    expect(withAllOption(base, 'Todos los estados', '')[0]).toEqual({
      label: 'Todos los estados',
      value: '',
    });
  });

  it('no modifica la lista original', () => {
    const copy = [...base];
    withAllOption(base, 'Todos');
    expect(base).toEqual(copy);
  });

  it('con una lista vacía deja solo la opción "todos"', () => {
    expect(withAllOption([], 'Todas las clases')).toEqual([
      { label: 'Todas las clases', value: null },
    ]);
  });
});
