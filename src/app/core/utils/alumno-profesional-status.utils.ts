import type { SemaforoAsistencia } from '@core/models/ui/alumno-profesional-table-row.model';
import type { BadgeVariant } from './alumno-status.utils';

export interface SemaforoInfo {
  label: string;
  severity: 'success' | 'warn' | 'danger' | 'secondary';
}

/** Progreso de módulos aprobados como porcentaje entero (0 si el total es 0). */
export function moduloPct(modulosAprobados: number, modulosTotal: number): number {
  return modulosTotal > 0 ? Math.round((modulosAprobados / modulosTotal) * 100) : 0;
}

/** Deriva label + severidad para el semáforo de asistencia profesional. */
export function getSemaforo(flag: SemaforoAsistencia | null): SemaforoInfo {
  switch (flag) {
    case 'green':
      return { label: 'Al día', severity: 'success' };
    case 'yellow':
      return { label: 'En riesgo', severity: 'warn' };
    case 'red':
      return { label: 'Crítico', severity: 'danger' };
    default:
      return { label: 'Sin datos', severity: 'secondary' };
  }
}

const SEMAFORO_SEVERITY_TO_BADGE: Record<SemaforoInfo['severity'], BadgeVariant> = {
  success: 'success',
  warn: 'warning',
  danger: 'error',
  secondary: 'neutral',
};

/** Variant de app-badge para el semáforo — atajo sobre getSemaforo(). */
export function getSemaforoBadgeVariant(flag: SemaforoAsistencia | null): BadgeVariant {
  return SEMAFORO_SEVERITY_TO_BADGE[getSemaforo(flag).severity];
}
