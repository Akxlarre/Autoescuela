import { describe, expect, it } from 'vitest';
import { isKnownError, validateKnownErrors, type KnownError } from './known-errors';

describe('validateKnownErrors', () => {
  it('acepta una lista vacía', () => {
    expect(() => validateKnownErrors([])).not.toThrow();
  });

  it('acepta entradas con patrón y justificación', () => {
    const list: KnownError[] = [
      { pattern: /favicon/, reason: 'Falta el favicon en dev, sin impacto' },
    ];
    expect(() => validateKnownErrors(list)).not.toThrow();
  });

  it('rechaza una entrada sin justificación e indica cuál es', () => {
    const list = [{ pattern: /favicon/ }] as unknown as KnownError[];
    expect(() => validateKnownErrors(list)).toThrow('favicon');
  });

  it('rechaza una justificación vacía o solo con espacios', () => {
    expect(() => validateKnownErrors([{ pattern: /a/, reason: '' }])).toThrow();
    expect(() => validateKnownErrors([{ pattern: /a/, reason: '   ' }])).toThrow();
  });
});

describe('isKnownError', () => {
  const list: KnownError[] = [{ pattern: /favicon\.ico.*404/, reason: 'Sin favicon en dev' }];

  it('reconoce un error que coincide con algún patrón', () => {
    expect(isKnownError('GET /favicon.ico 404', list)).toBe(true);
  });

  it('no reconoce un error que no coincide', () => {
    expect(isKnownError('TypeError: cannot read properties of undefined', list)).toBe(false);
  });
});
