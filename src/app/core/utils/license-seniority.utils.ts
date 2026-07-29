import type { LicenseValidation } from '@core/models/ui/enrollment-personal-data.model';
import { formatChileanDate } from '@core/utils/date.utils';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = MS_PER_DAY * 365.25;

/**
 * Valida la antigüedad de la licencia clase B contra una fecha de referencia (decisión
 * confirmada con el owner, fix-089: en el wizard Profesional la referencia definitiva es
 * la fecha de inicio del curso, no la de matrícula — otros llamadores pueden usar una
 * fecha de referencia distinta, ej. "hoy", para una estimación temprana).
 * Es una advertencia, no un bloqueo: `valid: false` solo indica que falta mostrar el aviso.
 * El mensaje siempre nombra la fecha de referencia usada, para que no ambigüe según
 * dónde se muestre.
 */
export function calcLicenseSeniority(
  licenseDate: string | null,
  referenceDate: string | null,
): LicenseValidation {
  if (!licenseDate || !referenceDate) {
    return { valid: true, message: '', seniorityYears: null };
  }

  const license = new Date(licenseDate);
  const reference = new Date(referenceDate);
  if (isNaN(license.getTime()) || isNaN(reference.getTime())) {
    return { valid: true, message: '', seniorityYears: null };
  }

  const seniorityYears = (reference.getTime() - license.getTime()) / MS_PER_YEAR;

  const requiredDate = new Date(license);
  requiredDate.setFullYear(requiredDate.getFullYear() + 2);

  if (reference >= requiredDate) {
    return { valid: true, message: '', seniorityYears };
  }

  const remainingDays = Math.max(
    1,
    Math.ceil((requiredDate.getTime() - reference.getTime()) / MS_PER_DAY),
  );

  const remainingLabel =
    remainingDays < 30
      ? `${remainingDays} día${remainingDays === 1 ? '' : 's'}`
      : `${Math.ceil(remainingDays / 30)} mes${Math.ceil(remainingDays / 30) === 1 ? '' : 'es'}`;
  const verb = remainingDays === 1 ? 'falta' : 'faltan';

  return {
    valid: false,
    message:
      `Le ${verb} ${remainingLabel} para cumplir los 2 años de licencia clase B requeridos ` +
      `(contados al ${formatChileanDate(referenceDate)}).`,
    seniorityYears,
  };
}
