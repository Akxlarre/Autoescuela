import {
  filterCertProfAlumnos,
  promotionAllowsCertificate,
} from './professional-certificate.utils';

describe('filterCertProfAlumnos (fix-482-m)', () => {
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
    expect(filterCertProfAlumnos(rows, null, '')).toHaveLength(3);
  });

  it('filtra por estado', () => {
    expect(filterCertProfAlumnos(rows, 'pendiente', '').map((r) => r.nombre)).toEqual([
      'Bravo Soto Ana',
      'Merino Osses Samuel',
    ]);
  });

  it('busca por nombre sin tildes ni mayúsculas', () => {
    expect(filterCertProfAlumnos(rows, null, 'nunez')).toHaveLength(1);
  });

  it('busca por RUT sin puntos ni guion', () => {
    expect(filterCertProfAlumnos(rows, null, '98765432')[0].nombre).toBe('Bravo Soto Ana');
  });

  it('busca por Nº de matrícula', () => {
    expect(filterCertProfAlumnos(rows, null, '0098').map((r) => r.nombre)).toEqual([
      'Bravo Soto Ana',
    ]);
  });

  it('combina estado y búsqueda', () => {
    expect(filterCertProfAlumnos(rows, 'generado', '0098')).toHaveLength(0);
  });
});

describe('promotionAllowsCertificate (fix-467-m)', () => {
  it('promoción en curso: no', () => {
    expect(promotionAllowsCertificate('2026-10-24', '2026-10-19')).toBe(false);
  });

  it('último día de la promoción: sí', () => {
    expect(promotionAllowsCertificate('2026-10-19', '2026-10-19')).toBe(true);
  });

  it('promoción terminada: sí', () => {
    expect(promotionAllowsCertificate('2026-08-24', '2026-10-19')).toBe(true);
  });

  it('sin promoción o sin fecha: no', () => {
    expect(promotionAllowsCertificate(null, '2026-10-19')).toBe(false);
    expect(promotionAllowsCertificate('', '2026-10-19')).toBe(false);
  });
});
