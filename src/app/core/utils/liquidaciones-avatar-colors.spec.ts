import { describe, it, expect } from 'vitest';
import {
  LIQUIDACIONES_AVATAR_COLORS,
  getLiquidacionAvatarColor,
} from './liquidaciones-avatar-colors';

describe('getLiquidacionAvatarColor()', () => {
  it('retorna siempre un color de la paleta', () => {
    expect(LIQUIDACIONES_AVATAR_COLORS).toContain(getLiquidacionAvatarColor('Pedro Soto'));
  });

  it('es determinístico para el mismo nombre', () => {
    expect(getLiquidacionAvatarColor('Ana Ríos')).toBe(getLiquidacionAvatarColor('Ana Ríos'));
  });
});
