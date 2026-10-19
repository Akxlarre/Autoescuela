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
