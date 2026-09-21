import { describe, it, expect } from 'vitest';
import { getClauseCharacterStatus } from './document-clause-limits.util';

describe('getClauseCharacterStatus()', () => {
  it('texto dentro del límite: withinLimit true, remaining positivo', () => {
    const status = getClauseCharacterStatus('a'.repeat(10), 20);
    expect(status.withinLimit).toBe(true);
    expect(status.remaining).toBe(10);
  });

  it('texto exactamente en el límite: withinLimit true, remaining 0', () => {
    const status = getClauseCharacterStatus('a'.repeat(20), 20);
    expect(status.withinLimit).toBe(true);
    expect(status.remaining).toBe(0);
  });

  it('texto 1 carácter sobre el límite: withinLimit false, remaining negativo', () => {
    const status = getClauseCharacterStatus('a'.repeat(21), 20);
    expect(status.withinLimit).toBe(false);
    expect(status.remaining).toBe(-1);
  });

  it('texto vacío: withinLimit true, remaining = maxLength', () => {
    const status = getClauseCharacterStatus('', 20);
    expect(status.withinLimit).toBe(true);
    expect(status.remaining).toBe(20);
  });
});
