import { describe, expect, it } from 'vitest';
import { ChileDatePipe } from './chile-date.pipe';

describe('ChileDatePipe', () => {
  const pipe = new ChileDatePipe();

  it('muestra el día de Chile de un instante, no el de UTC', () => {
    // 23:30 del 6 de octubre en Chile.
    expect(pipe.transform('2026-10-07T02:30:00.000Z', 'dd/MM/yyyy HH:mm')).toBe('06/10/2026 23:30');
  });

  it('sin patrón usa dd/MM/yyyy', () => {
    expect(pipe.transform('2026-10-06')).toBe('06/10/2026');
  });

  it('acepta milisegundos', () => {
    expect(pipe.transform(Date.parse('2026-10-07T02:30:00.000Z'), 'dd/MM')).toBe('06/10');
  });

  it.each([null, undefined, ''])(
    '%s → null, para poder encadenar un valor por defecto',
    (value) => {
      expect(pipe.transform(value, 'dd/MM/yyyy')).toBeNull();
    },
  );
});
