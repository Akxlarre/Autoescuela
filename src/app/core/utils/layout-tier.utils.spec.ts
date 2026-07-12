import { describe, expect, it } from 'vitest';
import { sliceByBudget, widthToTier } from './layout-tier.utils';

describe('widthToTier', () => {
  it('devuelve desktop para null (SSR / observer aún no montado)', () => {
    expect(widthToTier(null)).toBe('desktop');
  });

  it('devuelve mobile bajo 640px', () => {
    expect(widthToTier(0)).toBe('mobile');
    expect(widthToTier(390)).toBe('mobile');
    expect(widthToTier(639)).toBe('mobile');
  });

  it('devuelve tablet entre 640 y 1023px (espejo de $bp-sm/$bp-lg)', () => {
    expect(widthToTier(640)).toBe('tablet');
    expect(widthToTier(800)).toBe('tablet');
    expect(widthToTier(1023)).toBe('tablet');
  });

  it('devuelve desktop desde 1024px', () => {
    expect(widthToTier(1024)).toBe('desktop');
    expect(widthToTier(1440)).toBe('desktop');
  });
});

describe('sliceByBudget', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];

  it('con budget null devuelve la lista completa (sin recorte)', () => {
    expect(sliceByBudget(items, null)).toEqual(items);
  });

  it('con budget menor al largo recorta', () => {
    expect(sliceByBudget(items, 3)).toEqual(['a', 'b', 'c']);
  });

  it('con budget igual o mayor al largo devuelve todo (AC-E2: sin "Cargar más")', () => {
    expect(sliceByBudget(items, 5)).toEqual(items);
    expect(sliceByBudget(items, 10)).toEqual(items);
  });

  it('con budget 0 devuelve vacío', () => {
    expect(sliceByBudget(items, 0)).toEqual([]);
  });

  it('con lista vacía devuelve vacío para cualquier budget (AC-E1)', () => {
    expect(sliceByBudget([], null)).toEqual([]);
    expect(sliceByBudget([], 4)).toEqual([]);
  });
});
