export interface SecretariaTableRow {
  id: number;
  nombre: string;
  initials: string;
  email: string;
  sede: string;
  estado: 'activa' | 'inactiva';
  aliasPublico: string | null;
  rut: string;
  // Campos raw para edición
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  branchId: number | null;
  phone: string;
  /** RF-013 / spec 0017: grant que permite ver todas las sedes (como admin). */
  canAccessBothBranches: boolean;
}

/**
 * Último inicio de sesión real de la secretaria (fix-212-b): `auth.users.last_sign_in_at` vía
 * `secretary_last_sign_in()`. Antes se mostraba `users.updated_at` (= fecha de creación).
 * `fecha: null` con `estado: 'ok'` = nunca ha ingresado.
 */
export interface UltimoAccesoEstado {
  estado: 'cargando' | 'ok' | 'error';
  fecha: string | null;
}
