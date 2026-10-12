export type UserRole = 'admin' | 'secretaria' | 'instructor' | 'alumno' | 'unknown';

export interface User {
  id: string;
  dbId?: number;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  firstLogin?: boolean;
  branchId?: number | null;
  /** RF-013 / spec 0017: grant que permite a una secretaria ver todas las sedes (como admin). */
  canAccessBothBranches?: boolean;
  isActive?: boolean;
  /** RUT propio. Solo para que la contraseña no lo contenga (spec 0050-b). */
  rut?: string | null;
  avatarUrl?: string;
}

/**
 * Genera iniciales desde display_name (ej: "María López" -> "ML").
 */
export function getInitialsFromDisplayName(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
