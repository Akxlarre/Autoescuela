import { describe, it, expect } from 'vitest';
import { AVATAR_PALETTES, avatarPalette } from './avatar-palette';

describe('avatarPalette()', () => {
  it('retorna siempre una entrada de la paleta', () => {
    const entry = avatarPalette('Juan Pérez');
    expect(AVATAR_PALETTES).toContain(entry);
  });

  it('es determinístico para el mismo nombre', () => {
    expect(avatarPalette('María González')).toBe(avatarPalette('María González'));
  });

  it('retorna la misma entrada para strings anagrama (hash por suma de código de carácter)', () => {
    expect(avatarPalette('ab')).toBe(avatarPalette('ba'));
  });
});
