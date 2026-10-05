import type { EnrollmentPersonalData } from '@core/models/ui/enrollment-personal-data.model';

/** Campos del Paso 1 de la matrícula que el usuario llena escribiendo. */
const TYPED_FIELDS = [
  'rut',
  'firstNames',
  'paternalLastName',
  'maternalLastName',
  'email',
  'phone',
  'birthDate',
  'address',
  'senceCode',
  'licenseDate',
] as const satisfies readonly (keyof EnrollmentPersonalData)[];

/**
 * True si el formulario del Paso 1 tiene texto distinto del último guardado (fix-310-m): es lo
 * que se perdería al cerrar el wizard. Solo mira lo que se escribe; elegir sexo, tipo de licencia
 * o curso no cuenta, porque se rehace con un clic.
 */
export function hasUnsavedPersonalData(
  form: EnrollmentPersonalData,
  saved: EnrollmentPersonalData,
): boolean {
  return TYPED_FIELDS.some((field) => (form[field] ?? '').trim() !== (saved[field] ?? '').trim());
}
