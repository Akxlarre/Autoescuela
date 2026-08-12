import { describe, it, expect } from 'vitest';
import { COURSE_COLORS, getCourseColor } from './course-colors';

describe('getCourseColor()', () => {
  it('retorna el color mapeado para cada código de curso conocido', () => {
    expect(getCourseColor('A2')).toBe(COURSE_COLORS['A2']);
    expect(getCourseColor('A3')).toBe(COURSE_COLORS['A3']);
    expect(getCourseColor('A4')).toBe(COURSE_COLORS['A4']);
    expect(getCourseColor('A5')).toBe(COURSE_COLORS['A5']);
  });

  it('retorna el color de fallback para un código desconocido', () => {
    expect(getCourseColor('X9')).toBe('#6b7280');
  });
});
