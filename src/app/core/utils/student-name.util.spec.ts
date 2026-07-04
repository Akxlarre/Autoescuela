import { describe, it, expect } from 'vitest';
import { buildStudentDisplayName, sortByPaternalLastNameAsc } from './student-name.util';

describe('buildStudentDisplayName()', () => {
  it('arma el nombre en orden paterno - materno - nombre', () => {
    const name = buildStudentDisplayName({
      firstNames: 'Juan',
      paternalLastName: 'Pérez',
      maternalLastName: 'Soto',
    });
    expect(name).toBe('Pérez Soto Juan');
  });

  it('omite el apellido materno si viene vacío o null', () => {
    expect(
      buildStudentDisplayName({
        firstNames: 'Juan',
        paternalLastName: 'Pérez',
        maternalLastName: null,
      }),
    ).toBe('Pérez Juan');
    expect(
      buildStudentDisplayName({
        firstNames: 'Juan',
        paternalLastName: 'Pérez',
        maternalLastName: '',
      }),
    ).toBe('Pérez Juan');
  });

  it('recorta espacios sobrantes en cada parte', () => {
    const name = buildStudentDisplayName({
      firstNames: '  Juan  ',
      paternalLastName: ' Pérez ',
      maternalLastName: ' Soto ',
    });
    expect(name).toBe('Pérez Soto Juan');
  });
});

describe('sortByPaternalLastNameAsc()', () => {
  it('ordena ascendente alfabéticamente (A-Z) por el nombre armado (apellido paterno primero)', () => {
    const items = ['Pérez Soto Juan', 'Álvarez Rojas Ana', 'Soto Díaz María'];
    const sorted = sortByPaternalLastNameAsc(items, (i) => i);
    expect(sorted).toEqual(['Álvarez Rojas Ana', 'Pérez Soto Juan', 'Soto Díaz María']);
  });

  it('no muta el arreglo original', () => {
    const items = ['B', 'A'];
    sortByPaternalLastNameAsc(items, (i) => i);
    expect(items).toEqual(['B', 'A']);
  });
});
