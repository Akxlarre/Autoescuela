import type { LicenseStatus } from '@core/models/ui/instructor-table.model';

/** Días antes del vencimiento en que una licencia pasa a "por vencer". */
export const LICENSE_EXPIRING_SOON_DAYS = 30;

/**
 * Estado de la licencia de un instructor según su vencimiento y el día de hoy (fix-202-b, S7 de
 * ASG-i-034). `instructors.license_status` solo se recalcula al editar al instructor (trigger
 * `generate_license_alert`), así que una licencia que vence sin que nadie lo edite seguía
 * "Vigente": el estado se calcula al mostrar, no se lee de la BD.
 *
 * @param expiry  `license_expiry` (YYYY-MM-DD o timestamp; se usa solo la fecha).
 * @param today   hoy en Chile, YYYY-MM-DD (`todayIso()`).
 */
export function licenseStatusFromExpiry(
  expiry: string | null | undefined,
  today: string,
): LicenseStatus | null {
  const day = (expiry ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (day < today) return 'expired';
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(
    (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / msPerDay,
  );
  return diffDays <= LICENSE_EXPIRING_SOON_DAYS ? 'expiring_soon' : 'valid';
}

interface InstructorLicenseInfo {
  id: number;
  name: string;
  licenseExpiry?: string | null;
  licenseExpired?: boolean;
}

/**
 * Aviso de licencias vencidas para la Agenda (fix-202-b, opción B del owner: el instructor se sigue
 * ofreciendo, con aviso). Con un instructor elegido habla de él; en "Todos" (`null`) resume cuántos
 * y quiénes. `null` si no hay nada que avisar.
 */
export function expiredLicenseNotice(
  instructors: readonly InstructorLicenseInfo[],
  selectedId: number | null,
): string | null {
  if (selectedId !== null) {
    const sel = instructors.find((i) => i.id === selectedId);
    if (!sel?.licenseExpired) return null;
    const [y, m, d] = (sel.licenseExpiry ?? '').slice(0, 10).split('-');
    const fecha = y && m && d ? ` el ${d}-${m}-${y}` : '';
    return `La licencia de ${sel.name} venció${fecha}. Sus horas se siguen ofreciendo.`;
  }
  const vencidos = instructors.filter((i) => i.licenseExpired);
  if (vencidos.length === 0) return null;
  const quien = vencidos.length === 1 ? 'instructor' : 'instructores';
  return `${vencidos.length} ${quien} con licencia vencida: ${vencidos.map((i) => i.name).join(', ')}.`;
}
