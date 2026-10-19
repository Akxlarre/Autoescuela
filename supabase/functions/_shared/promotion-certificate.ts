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
