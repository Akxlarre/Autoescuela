export type SubnavTier = 'full' | 'short' | 'icon' | 'select';

/**
 * Prueba los tiers de mayor a menor densidad (label completo → abreviado →
 * solo ícono) y devuelve el primero que entra sin overflow. Si ninguno cabe,
 * cae a 'select' (dropdown) en vez de permitir scroll horizontal.
 */
/**
 * hotfix-170-m: ¿caben las pestañas si se dibujan en columnas iguales (`flex-1`)? Cada una recibe
 * `disponible / n`, así que manda la más ancha. Comparar solo el total dejaba que una etiqueta
 * larga se partiera en dos líneas aunque la suma entrara.
 */
export function fitsEqualColumns(itemWidths: readonly number[], available: number): boolean {
  if (itemWidths.length === 0) return true;
  return Math.max(...itemWidths) * itemWidths.length <= available;
}

export function pickSubnavTier(fitsTier: (tier: 'full' | 'short' | 'icon') => boolean): SubnavTier {
  const order: Array<'full' | 'short' | 'icon'> = ['full', 'short', 'icon'];
  for (const tier of order) {
    if (fitsTier(tier)) return tier;
  }
  return 'select';
}

/**
 * El tier "solo ícono" solo tiene sentido si TODAS las pestañas tienen ícono. Una barra sin
 * íconos mide casi nada en ese tier, así que siempre "cabe" y las pestañas quedarían vacías:
 * quien llama debe descartarlo y dejar que caiga a 'select'.
 */
export function canUseIconTier(tabs: readonly { icon?: string }[]): boolean {
  return tabs.length > 0 && tabs.every((tab) => !!tab.icon);
}
