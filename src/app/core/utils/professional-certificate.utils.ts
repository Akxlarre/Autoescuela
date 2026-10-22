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

/**
 * hotfix-167-m: etiqueta del selector de promociones. Las promociones nuevas ya llevan el número en
 * el nombre ("Promoción 278 (…)"); las antiguas no ("Promoción 15 de Junio 2026", número 103).
 */
export function promocionCertLabel(code: string, name: string): string {
  return name.includes(code) ? name : `${code} — ${name}`;
}

/** hotfix-167-m: etiqueta del selector de cursos, sin repetir la clase ("Profesional A2"). */
export function cursoCertLabel(courseName: string, licenseClass: string): string {
  return !licenseClass || courseName.includes(licenseClass)
    ? courseName
    : `${courseName} (${licenseClass})`;
}
