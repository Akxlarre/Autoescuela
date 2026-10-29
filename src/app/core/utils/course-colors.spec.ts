import { describe, it, expect } from 'vitest';
import { COURSE_COLORS, getCourseColor } from './course-colors';
import { contrastRatio } from './color-contrast.utils';

describe('getCourseColor()', () => {
  it('retorna el color mapeado para cada código de curso conocido', () => {
    expect(getCourseColor('A2')).toBe(COURSE_COLORS['A2']);
    expect(getCourseColor('A3')).toBe(COURSE_COLORS['A3']);
    expect(getCourseColor('A4')).toBe(COURSE_COLORS['A4']);
    expect(getCourseColor('A5')).toBe(COURSE_COLORS['A5']);
  });

  it('retorna el color de fallback para un código desconocido', () => {
    expect(getCourseColor('X9')).toBe('#4b5563');
  });

  // fix-236-b: las insignias de curso llevan texto blanco encima.
  it('todos los colores cumplen 4,5:1 con texto blanco', () => {
    for (const code of ['A2', 'A3', 'A4', 'A5', 'X9']) {
      expect(contrastRatio('#ffffff', getCourseColor(code))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
