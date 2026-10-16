/**
 * Reglas del formulario de vehículo de Flota (hotfix-075-b). Funciones puras.
 */

/** Patentes chilenas de auto: antiguas (AA1234) y actuales (ABCD12). */
const LICENSE_PLATE_RE = /^([A-Z]{2}\d{4}|[A-Z]{4}\d{2})$/;

/** Año más antiguo que acepta el formulario. */
export const MIN_VEHICLE_YEAR = 1900;

/** Mayúsculas y sin guiones, puntos ni espacios: "ab-cd 12" → "ABCD12". */
export function normalizeLicensePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * ¿La patente (ya normalizada) tiene un formato válido?
 * `savedPlate` es la patente que el vehículo ya tenía guardada: si no se cambió, se respeta aunque
 * sea de otro formato (datos antiguos o de prueba), para que editar otro campo no quede bloqueado.
 */
export function isValidLicensePlate(plate: string, savedPlate?: string | null): boolean {
  if (savedPlate && plate === savedPlate) return true;
  return LICENSE_PLATE_RE.test(plate);
}

/** Año máximo aceptado: el próximo (los modelos nuevos se venden con el año siguiente). */
export function maxVehicleYear(currentYear: number): number {
  return currentYear + 1;
}

/** ¿Se está guardando un kilometraje menor al que el vehículo ya tenía registrado? */
export function isKmDecrease(savedKm: number | null, nextKm: number | null): boolean {
  if (savedKm === null || nextKm === null) return false;
  return nextKm < savedKm;
}

/**
 * hotfix-078-b: mensaje para un error al guardar un vehículo que la persona puede corregir. Hoy
 * solo la patente duplicada (`UNIQUE (license_plate)` → 23505); el resto devuelve null y lo
 * resuelve el sanitizador.
 */
export function vehicleSaveErrorMessage(error: unknown, plate: string): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return code === '23505' ? `Ya existe un vehículo con la patente ${plate}.` : null;
}
