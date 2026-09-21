import type { LicenseValidation } from '@core/models/ui/enrollment-personal-data.model';
import { formatChileanDate } from '@core/utils/date.utils';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = MS_PER_DAY * 365.25;

/**
 * Licencia previa exigida (2 años de antigüedad) según la clase profesional objetivo
 * (fix-033-i, ASG-m-001). "Conv." (convalidación simultánea A2+A4 o A5+A3) no tiene fila
 * propia: la matrícula siempre ocurre sobre el curso "madre" (A2 o A5), así que ya cae en
 * la fila correcta sin necesitar una regla distinta.
 */
const REQUIRED_PRIOR_LICENSE: Record<string, string> = {
  A2: 'clase B',
  A4: 'clase B',
  A5: 'A2 o A4',
  A3: 'A2 o A4',
};

/**
 * Mapea la `license_class` del curso objetivo (A2/A3/A4/A5) a la etiqueta de la licencia
 * previa que exige, para armar el mensaje de advertencia de antigüedad. `null`/valor
 * desconocido cae en "clase B" (comportamiento previo a fix-033-i, cubre Clase B).
 */
export function requiredPriorLicenseLabel(licenseClass: string | null): string {
  if (!licenseClass) return 'clase B';
  return REQUIRED_PRIOR_LICENSE[licenseClass.toUpperCase()] ?? 'clase B';
}

const COURSE_TYPE_TO_LICENSE_CLASS: Record<string, string> = {
  professional_a2: 'A2',
  professional_a3: 'A3',
  professional_a4: 'A4',
  professional_a5: 'A5',
};

/**
 * Deriva la `license_class` objetivo (A2/A3/A4/A5) desde el `courseType` de Step 1 —
 * `null` si el curso no es profesional (Clase B, singular). Usado por la advertencia
 * temprana de Step 1, antes de que exista una promoción seleccionada.
 */
export function licenseClassFromCourseType(courseType: string | null): string | null {
  if (!courseType) return null;
  return COURSE_TYPE_TO_LICENSE_CLASS[courseType] ?? null;
}

/**
 * Valida la antigüedad de la licencia previa contra una fecha de referencia (decisión
 * confirmada con el owner, fix-089: en el wizard Profesional la referencia definitiva es
 * la fecha de inicio del curso, no la de matrícula — otros llamadores pueden usar una
 * fecha de referencia distinta, ej. "hoy", para una estimación temprana).
 * `requiredLicenseLabel` (fix-033-i, ASG-m-001) nombra en el mensaje qué licencia previa
 * exige la clase objetivo — "clase B" para A2/A4, "A2 o A4" para A5/A3 (ver
 * `requiredPriorLicenseLabel`). Default `'clase B'` preserva el comportamiento previo a
 * fix-033-i para callers que todavía no pasan este dato.
 * Es una advertencia, no un bloqueo: `valid: false` solo indica que falta mostrar el aviso.
 * El mensaje siempre nombra la fecha de referencia usada, para que no ambigüe según
 * dónde se muestre.
 */
export function calcLicenseSeniority(
  licenseDate: string | null,
  referenceDate: string | null,
  requiredLicenseLabel: string = 'clase B',
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
      `Le ${verb} ${remainingLabel} para cumplir los 2 años de licencia ${requiredLicenseLabel} requeridos ` +
      `(contados al ${formatChileanDate(referenceDate)}).`,
    seniorityYears,
  };
}
