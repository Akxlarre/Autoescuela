// supabase/functions/_shared/promotion-certificate.ts
//
// fix-467-m: el certificado Profesional se emite desde el último día de la promoción, para
// cualquier rol (equivalente a "clases completas" de Clase B). Se compara la fecha y no el estado:
// la promoción pasa a 'finished' recién el día siguiente (cron auto_transition_promotion_status).
// Misma regla en la app: src/app/core/utils/professional-certificate.utils.ts.

export type PromotionVerdict =
  | { ok: true }
  | { ok: false; status: number; body: { error: string; code: string } };

/** `endDate` y `today` son fechas puras 'YYYY-MM-DD' (hoy en Chile). */
export function checkPromotionFinished(
  endDate: string | null | undefined,
  today: string,
): PromotionVerdict {
  if (endDate && endDate <= today) return { ok: true };

  const desde = endDate ? endDate.split('-').reverse().join('-') : null;
  return {
    ok: false,
    status: 400,
    body: {
      error: desde
        ? `La promoción termina el ${desde}: el certificado se puede generar desde ese día.`
        : 'La matrícula no tiene una promoción con fecha de término.',
      code: 'PROMOCION_EN_CURSO',
    },
  };
}

/**
 * fix-483-m: texto inicial del campo "Convalidación" de la plantilla certificate_professional
 * (redacción decidida en fix-480-m, D1). Se edita en Plantillas; vacío = no se menciona.
 */
export const DEFAULT_CONVALIDACION = 'con convalidación de Clase {{claseConvalidada}}';

/**
 * fix-483-m: nombre del curso que va en el certificado ({{cursoLabel}}). Con convalidación
 * simultánea (license_validations) agrega el texto de la plantilla con {{claseConvalidada}}:
 * "Licencia Profesional Clase A5 con convalidación de Clase A3".
 */
export function professionalCourseLabel(
  licenseClass: string | null | undefined,
  convalidatedLicense: string | null | undefined,
  convalidacionTexto: string,
): string {
  const clase = (licenseClass ?? '').toUpperCase();
  const base = ['A2', 'A3', 'A4', 'A5'].includes(clase)
    ? `Licencia Profesional Clase ${clase}`
    : 'Licencia Profesional';
  const convalidada = (convalidatedLicense ?? '').toUpperCase();
  const frase = convalidacionTexto.split('{{claseConvalidada}}').join(convalidada).trim();
  return convalidada && frase ? `${base} ${frase}` : base;
}
