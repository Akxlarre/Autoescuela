export interface SecretariaTableRow {
  id: number;
  nombre: string;
  initials: string;
  email: string;
  sede: string;
  estado: 'activa' | 'inactiva';
  ultimoAcceso: string | null;
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
