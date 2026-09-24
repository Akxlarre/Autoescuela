import { describe, expect, it } from 'vitest';
import {
  CONVALIDATION_BOOKS,
  buildBookOptions,
  buildConvalidationBookId,
  getConvalidationBookName,
  getConvalidationModuleNames,
  parseBookKey,
  selectConvalidationDates,
} from './convalidation-book.utils';

const CURSOS = [
  { id: 11, courseCode: 'A2', courseName: 'Clase A-2' },
  { id: 12, courseCode: 'A3', courseName: 'Clase A-3' },
  { id: 13, courseCode: 'A4', courseName: 'Clase A-4' },
  { id: 14, courseCode: 'A5', courseName: 'Clase A-5' },
];

describe('CONVALIDATION_BOOKS', () => {
  it('Conv. A-3 cuelga del curso madre A5 con sufijo .6 y 16 días de clase', () => {
    expect(CONVALIDATION_BOOKS.A3.motherLicense).toBe('A5');
    expect(CONVALIDATION_BOOKS.A3.idSuffix).toBe('6');
    expect(CONVALIDATION_BOOKS.A3.sessionDays).toBe(16);
  });

  it('Conv. A-4 cuelga del curso madre A2 con sufijo .7 y 13 días de clase', () => {
    expect(CONVALIDATION_BOOKS.A4.motherLicense).toBe('A2');
    expect(CONVALIDATION_BOOKS.A4.idSuffix).toBe('7');
    expect(CONVALIDATION_BOOKS.A4.sessionDays).toBe(13);
  });
});

describe('getConvalidationBookName', () => {
  it('nombre del libro como en la portada real', () => {
    expect(getConvalidationBookName('A3')).toBe('Curso Convalidación Clase A-3');
    expect(getConvalidationBookName('A4')).toBe('Curso Convalidación Clase A-4');
  });
});

describe('buildConvalidationBookId', () => {
  it('arma el ID con el código de la promoción y el sufijo del libro', () => {
    expect(buildConvalidationBookId('156', 'A3')).toBe('156.6');
    expect(buildConvalidationBookId('156', 'A4')).toBe('156.7');
  });

  it('sin código de promoción devuelve cadena vacía (no inventa un ID)', () => {
    expect(buildConvalidationBookId('', 'A3')).toBe('');
  });
});

describe('getConvalidationModuleNames', () => {
  it('Conv. A-3: las 5 asignaturas del libro real, en su orden', () => {
    expect(getConvalidationModuleNames('A3')).toEqual([
      'Infraestructura y Educación Vial',
      'Mecánica',
      'Transporte de Pasajeros',
      'Conducción',
      'Aspectos Psicológicos y de Comunicación',
    ]);
  });

  it('Conv. A-4: las 5 asignaturas del libro real, en su orden', () => {
    expect(getConvalidationModuleNames('A4')).toEqual([
      'Prevención de Riesgos',
      'Mecánica',
      'Transporte de Carga / Sust. Peligrosa',
      'Conducción',
      'Aspectos Psicológicos y de Comunicación',
    ]);
  });
});

describe('selectConvalidationDates', () => {
  const s = (date: string, status: string | null = 'scheduled') => ({ date, status });

  it('devuelve las últimas N fechas activas, ordenadas', () => {
    const sessions = [s('2026-10-05'), s('2026-10-01'), s('2026-10-03'), s('2026-10-02')];
    expect(selectConvalidationDates(sessions, 2)).toEqual(['2026-10-03', '2026-10-05']);
  });

  it('excluye las sesiones canceladas (feriados) antes de contar', () => {
    const sessions = [s('2026-10-01'), s('2026-10-02'), s('2026-10-03', 'cancelled')];
    expect(selectConvalidationDates(sessions, 2)).toEqual(['2026-10-01', '2026-10-02']);
  });

  it('si hay menos fechas que N, devuelve todas sin inventar (AC-E3)', () => {
    expect(selectConvalidationDates([s('2026-10-01')], 16)).toEqual(['2026-10-01']);
  });

  it('elimina fechas duplicadas', () => {
    expect(selectConvalidationDates([s('2026-10-01'), s('2026-10-01')], 5)).toEqual(['2026-10-01']);
  });

  it('sin sesiones devuelve arreglo vacío', () => {
    expect(selectConvalidationDates([], 13)).toEqual([]);
  });
});

describe('buildBookOptions', () => {
  it('4 cursos → 6 libros: los 4 normales y luego Conv. A-3 y Conv. A-4 (AC1)', () => {
    const options = buildBookOptions(CURSOS);
    expect(options.map((o) => o.key)).toEqual(['11', '12', '13', '14', '14:A3', '11:A4']);
  });

  it('los libros de convalidación apuntan al curso madre', () => {
    const options = buildBookOptions(CURSOS);
    const convA3 = options.find((o) => o.convalidation === 'A3')!;
    const convA4 = options.find((o) => o.convalidation === 'A4')!;
    expect(convA3.promotionCourseId).toBe(14);
    expect(convA4.promotionCourseId).toBe(11);
  });

  it('los libros normales no tienen convalidación y mantienen su etiqueta', () => {
    const [a2] = buildBookOptions(CURSOS);
    expect(a2.convalidation).toBeNull();
    expect(a2.label).toBe('A2 — Clase A-2');
  });

  it('etiqueta de los libros de convalidación', () => {
    const options = buildBookOptions(CURSOS);
    expect(options[4].label).toBe('Conv. A-3 — Curso Convalidación Clase A-3');
    expect(options[5].label).toBe('Conv. A-4 — Curso Convalidación Clase A-4');
  });

  it('si falta el curso madre, omite su libro de convalidación', () => {
    const sinA5 = CURSOS.filter((c) => c.courseCode !== 'A5');
    expect(buildBookOptions(sinA5).map((o) => o.key)).toEqual(['11', '12', '13', '11:A4']);
  });

  it('sin cursos no genera libros', () => {
    expect(buildBookOptions([])).toEqual([]);
  });
});

describe('parseBookKey', () => {
  it('libro normal', () => {
    expect(parseBookKey('12')).toEqual({ promotionCourseId: 12, convalidation: null });
  });

  it('libro de convalidación', () => {
    expect(parseBookKey('14:A3')).toEqual({ promotionCourseId: 14, convalidation: 'A3' });
    expect(parseBookKey('11:A4')).toEqual({ promotionCourseId: 11, convalidation: 'A4' });
  });

  it('clave inválida devuelve null', () => {
    expect(parseBookKey('')).toBeNull();
    expect(parseBookKey('abc')).toBeNull();
    expect(parseBookKey('12:A9')).toBeNull();
  });
});
