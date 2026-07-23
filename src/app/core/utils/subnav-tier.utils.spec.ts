import { pickSubnavTier } from './subnav-tier.utils';

// fix-052-m — AC5
describe('pickSubnavTier', () => {
  it('AC5 — devuelve "full" cuando el tier completo cabe', () => {
    expect(pickSubnavTier((tier) => tier === 'full')).toBe('full');
  });

  it('AC5 — devuelve "short" cuando solo cabe desde abreviado', () => {
    expect(pickSubnavTier((tier) => tier === 'short' || tier === 'icon')).toBe('short');
  });

  it('AC5 — devuelve "icon" cuando solo cabe desde solo-ícono', () => {
    expect(pickSubnavTier((tier) => tier === 'icon')).toBe('icon');
  });

  it('AC5 — devuelve "select" cuando ningún tier cabe', () => {
    expect(pickSubnavTier(() => false)).toBe('select');
  });
});
