/**
 * fix-467-m: el certificado Profesional se emite desde el último día de la promoción, para admin y
 * secretaria (equivalente a "clases completas" de Clase B). Se compara la fecha y no el estado: la
 * promoción pasa a 'finished' recién el día siguiente a su `end_date`.
 *
 * `endDate` y `today` son fechas puras 'YYYY-MM-DD' (`today` = `chileToday()`). La edge function
 * `generate-certificate-professional-pdf` aplica la misma regla (`_shared/promotion-certificate.ts`).
 */
export function promotionAllowsCertificate(endDate: string | null, today: string): boolean {
  return !!endDate && endDate <= today;
}

/** Campos que usa el filtro de la lista de Certificados Profesional. */
export interface CertProfFiltrable {
  nombre: string;
  rut: string;
  numeroMatricula: string | null;
  certificadoStatus: 'generado' | 'pendiente';
}

const sinTildes = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const sinPuntosNiGuion = (s: string): string => s.replace(/[.-]/g, '').toLowerCase();

/**
 * fix-482-m: filtro de la lista de Certificados Profesional — por estado y por texto, que busca en el
 * nombre (sin tildes), el RUT (sin puntos ni guion) y el Nº de matrícula.
 */
export function filterCertProfAlumnos<T extends CertProfFiltrable>(
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
