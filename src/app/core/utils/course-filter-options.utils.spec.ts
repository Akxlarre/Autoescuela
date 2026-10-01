import { describe, expect, it } from 'vitest';
import { buildCourseFilterOptions } from './course-filter-options.utils';

const row = (...nombres: string[]) => ({ cursos: nombres.map((nombre) => ({ nombre })) });

describe('buildCourseFilterOptions — hotfix-114-m', () => {
  it('sin filas → sin opciones', () => {
    expect(buildCourseFilterOptions([])).toEqual([]);
  });

  it('ofrece cada curso presente una sola vez, en orden alfabético', () => {
    const options = buildCourseFilterOptions([
      row('Clase B SENCE'),
      row('Clase B'),
      row('Refuerzo Clase B'),
      row('Clase B'),
    ]);
    expect(options).toEqual([
      { label: 'Clase B', value: 'Clase B' },
      { label: 'Clase B SENCE', value: 'Clase B SENCE' },
      { label: 'Refuerzo Clase B', value: 'Refuerzo Clase B' },
    ]);
  });

  it('considera todos los cursos de un alumno con varias matrículas', () => {
    const options = buildCourseFilterOptions([row('Clase B', 'Refuerzo Clase B')]);
    expect(options.map((o) => o.value)).toEqual(['Clase B', 'Refuerzo Clase B']);
  });

  it('ignora el marcador "—" de los alumnos sin curso', () => {
    expect(buildCourseFilterOptions([row('—'), row('Clase B')])).toEqual([
      { label: 'Clase B', value: 'Clase B' },
    ]);
  });
});
