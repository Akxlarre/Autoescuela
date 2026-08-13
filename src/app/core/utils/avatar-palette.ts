/**
 * Paleta de gradientes para avatares generados por iniciales (sin foto de perfil).
 * Usada en: InstructorAlumnosComponent, StudentDrawerDetailComponent.
 */

export interface AvatarPaletteEntry {
  bg: string;
  text: string;
}

export const AVATAR_PALETTES: AvatarPaletteEntry[] = [
  { bg: 'linear-gradient(135deg,#6366f1,#8b5cf6)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#0ea5e9,#06b6d4)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#10b981,#059669)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#ec4899,#db2777)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#14b8a6,#0891b2)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#a855f7,#6366f1)', text: '#fff' },
  { bg: 'linear-gradient(135deg,#f97316,#ef4444)', text: '#fff' },
];

/** Deriva un color determinístico de la paleta a partir del nombre (hash de código de carácter). */
export function avatarPalette(name: string): AvatarPaletteEntry {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}
