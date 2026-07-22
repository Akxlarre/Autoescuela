/**
 * Extrae el sufijo numérico (2-5) de una `license_class` tipo 'A2'..'A5'.
 * Usado para componer el ID de libro de clases por curso: "{promoCode}.{sufijo}".
 */
export function licenseClassToSuffix(licenseClass: string): string {
  const m = licenseClass.match(/[2-5]/);
  return m ? m[0] : '';
}
