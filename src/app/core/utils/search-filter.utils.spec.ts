import { normalizeSearchText, matchesSearch, filterBySearch } from './search-filter.utils';

describe('normalizeSearchText', () => {
  it('pasa a minúsculas y quita acentos', () => {
    expect(normalizeSearchText('José Núñez')).toBe('jose nunez');
  });

  it('recorta espacios sobrantes', () => {
    expect(normalizeSearchText('  Ana  ')).toBe('ana');
  });

  it('devuelve string vacío para null/undefined/""', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
    expect(normalizeSearchText('')).toBe('');
  });
});

describe('matchesSearch', () => {
  it('matchea por substring parcial en cualquiera de los campos', () => {
    expect(matchesSearch(['José Núñez', 'jose@mail.com'], 'nunez')).toBe(true);
    expect(matchesSearch(['José Núñez', 'jose@mail.com'], 'mail')).toBe(true);
  });

  it('ignora mayúsculas y acentos en la query', () => {
    expect(matchesSearch(['José Núñez'], 'JOSÉ')).toBe(true);
    expect(matchesSearch(['José Núñez'], 'nuñez')).toBe(true);
  });

  it('no matchea si ningún campo contiene la query', () => {
    expect(matchesSearch(['José Núñez', 'jose@mail.com'], 'martinez')).toBe(false);
  });

  it('query vacía siempre matchea', () => {
    expect(matchesSearch(['cualquier cosa'], '')).toBe(true);
    expect(matchesSearch([null, undefined], '')).toBe(true);
  });

  it('ignora campos null/undefined sin romper', () => {
    expect(matchesSearch([null, 'jose@mail.com', undefined], 'jose')).toBe(true);
  });
});

describe('filterBySearch', () => {
  interface Alumno {
    nombre: string;
    email: string | null;
  }
  const alumnos: Alumno[] = [
    { nombre: 'José Núñez', email: 'jose@mail.com' },
    { nombre: 'Ana Martínez', email: 'ana@mail.com' },
    { nombre: 'Sin Correo', email: null },
  ];
  const getFields = (a: Alumno) => [a.nombre, a.email];

  it('filtra por nombre parcial', () => {
    expect(filterBySearch(alumnos, 'nuñ', getFields)).toEqual([alumnos[0]]);
  });

  it('filtra por email parcial', () => {
    expect(filterBySearch(alumnos, 'ana@', getFields)).toEqual([alumnos[1]]);
  });

  it('ignora mayúsculas y acentos', () => {
    expect(filterBySearch(alumnos, 'JOSE NUNEZ', getFields)).toEqual([alumnos[0]]);
  });

  it('string vacío devuelve todo el arreglo (misma referencia)', () => {
    expect(filterBySearch(alumnos, '', getFields)).toBe(alumnos);
  });

  it('sin resultados devuelve arreglo vacío', () => {
    expect(filterBySearch(alumnos, 'zzz', getFields)).toEqual([]);
  });

  it('no rompe con campos null (alumno sin correo)', () => {
    expect(filterBySearch(alumnos, 'sin correo', getFields)).toEqual([alumnos[2]]);
  });
});
