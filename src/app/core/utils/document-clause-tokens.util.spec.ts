import { describe, expect, it } from 'vitest';
import { getTokenDescription } from './document-clause-tokens.util';

describe('getTokenDescription', () => {
  it('devuelve la descripción en español de un token conocido', () => {
    expect(getTokenDescription('saldoPendiente')).toBe('Saldo pendiente de pago');
  });

  it('devuelve el token crudo como fallback si no hay descripción mapeada', () => {
    expect(getTokenDescription('tokenDesconocido')).toBe('tokenDesconocido');
  });
});
