/**
 * Paleta de colores sólidos para avatares de instructores en Liquidaciones.
 * Antes vivía inline en `LiquidacionesFacade` — extraída para que un Facade
 * no sea la fuente canónica de una constante visual (patrón: `avatar-palette.ts`).
 */

export const LIQUIDACIONES_AVATAR_COLORS: string[] = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#14b8a6',
];

/** Deriva un color determinístico de la paleta a partir del nombre (hash de código de carácter). */
export function getLiquidacionAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return LIQUIDACIONES_AVATAR_COLORS[hash % LIQUIDACIONES_AVATAR_COLORS.length];
}
