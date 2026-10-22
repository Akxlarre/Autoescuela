/** Campos que usa el filtro de las listas de certificados (Clase B y Profesional). */
export interface CertificadoFiltrable {
  nombre: string;
  rut: string;
  numeroMatricula: string | null;
  certificadoStatus: 'generado' | 'pendiente';
}

const sinTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const sinPuntosNiGuion = (s: string): string => s.replace(/[.-]/g, '').toLowerCase();

/**
 * Filtro de las listas de certificados (fix-482-m Profesional, fix-484-m Clase B): por estado y por
 * texto, que busca en el nombre (sin tildes), el RUT (sin puntos ni guion) y el Nº de matrícula.
 */
export function filterCertificadoAlumnos<T extends CertificadoFiltrable>(
  rows: readonly T[],
  estado: 'generado' | 'pendiente' | null,
  query: string,
): T[] {
  const porEstado = estado ? rows.filter((r) => r.certificadoStatus === estado) : [...rows];
  const q = query.trim();
  if (!q) return porEstado;
  const nombreQ = sinTildes(q);
  const rutQ = sinPuntosNiGuion(q);
  return porEstado.filter(
    (r) =>
      sinTildes(r.nombre).includes(nombreQ) ||
      sinPuntosNiGuion(r.rut).includes(rutQ) ||
      (r.numeroMatricula ?? '').toLowerCase().includes(q.toLowerCase()),
  );
}
