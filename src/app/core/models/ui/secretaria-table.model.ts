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
}
