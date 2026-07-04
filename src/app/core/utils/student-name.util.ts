export interface StudentNameParts {
  firstNames: string | null | undefined;
  paternalLastName: string | null | undefined;
  maternalLastName: string | null | undefined;
}

/** Arma el nombre para mostrar con el mismo orden que Base de Alumnos: paterno - materno - nombre. */
export function buildStudentDisplayName(parts: StudentNameParts): string {
  return [parts.paternalLastName, parts.maternalLastName, parts.firstNames]
    .map((p) => p?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

/** Ordena alfabéticamente ascendente (A-Z) por apellido paterno (primer token del nombre armado). */
export function sortByPaternalLastNameAsc<T>(items: T[], getName: (item: T) => string): T[] {
  return [...items].sort((a, b) => getName(a).localeCompare(getName(b), 'es'));
}
