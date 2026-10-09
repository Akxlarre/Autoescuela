import { canUseIconTier, pickSubnavTier } from './subnav-tier.utils';

// fix-355-m — el tier "solo ícono" de una barra sin íconos siempre "cabía" y dejaba las
// pestañas vacías.
describe('canUseIconTier', () => {
  it('es válido cuando todas las pestañas tienen ícono', () => {
    expect(canUseIconTier([{ icon: 'settings' }, { icon: 'layout' }])).toBe(true);
  });

  it('no es válido si alguna pestaña no tiene ícono', () => {
    expect(canUseIconTier([{ icon: 'settings' }, {}])).toBe(false);
    expect(canUseIconTier([{ icon: '' }, { icon: 'layout' }])).toBe(false);
  });

  it('no es válido si ninguna tiene ícono o no hay pestañas', () => {
    expect(canUseIconTier([{}, {}])).toBe(false);
    expect(canUseIconTier([])).toBe(false);
  });
});

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
