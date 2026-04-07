// Branch — UI model para el selector de sede en el wizard de matrícula

export interface BranchOption {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
  /** true si la sede ofrece Clase Profesional. Mapeado desde branches.has_professional. */
  hasProfessional?: boolean;
}

/** Precio de un curso dentro de una sede, para mostrar en el selector público. */
export interface BranchCoursePrice {
  name: string;
  price: number;
  licenseClass: string;
}
