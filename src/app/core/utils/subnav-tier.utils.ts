export type SubnavTier = 'full' | 'short' | 'icon' | 'select';

/**
 * Prueba los tiers de mayor a menor densidad (label completo → abreviado →
 * solo ícono) y devuelve el primero que entra sin overflow. Si ninguno cabe,
 * cae a 'select' (dropdown) en vez de permitir scroll horizontal.
 */
export function pickSubnavTier(fitsTier: (tier: 'full' | 'short' | 'icon') => boolean): SubnavTier {
  const order: Array<'full' | 'short' | 'icon'> = ['full', 'short', 'icon'];
  for (const tier of order) {
    if (fitsTier(tier)) return tier;
  }
  return 'select';
}
