import { filterCertificadoAlumnos } from './certificate-list.utils';

describe('filterCertificadoAlumnos (fix-482-m, fix-484-m)', () => {
  const rows = [
    {
      nombre: 'Núñez Pérez José',
      rut: '12.345.678-9',
      numeroMatricula: '0097',
      certificadoStatus: 'generado' as const,
    },
    {
      nombre: 'Bravo Soto Ana',
      rut: '9.876.543-2',
      numeroMatricula: '0098',
      certificadoStatus: 'pendiente' as const,
    },
    {
      nombre: 'Merino Osses Samuel',
      rut: '16.212.873-6',
      numeroMatricula: null,
      certificadoStatus: 'pendiente' as const,
    },
  ];

  it('sin filtros devuelve todo', () => {
    expect(filterCertificadoAlumnos(rows, null, '')).toHaveLength(3);
  });

  it('filtra por estado', () => {
    expect(filterCertificadoAlumnos(rows, 'pendiente', '').map((r) => r.nombre)).toEqual([
      'Bravo Soto Ana',
      'Merino Osses Samuel',
    ]);
  });

  it('busca por nombre sin tildes ni mayúsculas', () => {
    expect(filterCertificadoAlumnos(rows, null, 'nunez')).toHaveLength(1);
  });

  it('busca por RUT sin puntos ni guion', () => {
    expect(filterCertificadoAlumnos(rows, null, '98765432')[0].nombre).toBe('Bravo Soto Ana');
  });

  it('busca por Nº de matrícula', () => {
    expect(filterCertificadoAlumnos(rows, null, '0098').map((r) => r.nombre)).toEqual([
      'Bravo Soto Ana',
    ]);
  });

  it('combina estado y búsqueda', () => {
    expect(filterCertificadoAlumnos(rows, 'generado', '0098')).toHaveLength(0);
  });
});
