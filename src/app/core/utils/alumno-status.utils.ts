import type { AlumnoExpediente, AlumnoStatus } from '@core/models/ui/alumno-table-row.model';

export interface ExpedienteStatus {
  label: 'Completo' | 'Parcial' | 'Pendiente';
  severity: 'success' | 'warn' | 'danger';
  count: string;
}

export type TagSeverity = 'success' | 'secondary' | 'info' | 'danger' | 'warn';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Deriva Completo/Parcial/Pendiente + conteo "n/2" a partir de CI y Foto — los únicos
 * dos documentos que el sistema efectivamente pide/registra para todo alumno en el
 * flujo de matrícula. `medico` y `semep` no entran en el cálculo (fix-035-i): el
 * certificado médico solo se sube después, si el alumno justifica una inasistencia, y
 * SEMEP no es un documento de alumno que el sistema permita subir en ningún punto de la
 * UI — contarlos como requeridos hacía que ningún alumno matriculado normalmente
 * pudiera llegar nunca a "Completo".
 */
export function getExpedienteStatus(exp: AlumnoExpediente): ExpedienteStatus {
  const docs = [exp.ci, exp.foto];
  const ok = docs.filter(Boolean).length;
  const total = docs.length;
  const count = `${ok}/${total}`;
  if (ok === total) return { label: 'Completo', severity: 'success', count };
  if (ok === 0) return { label: 'Pendiente', severity: 'danger', count };
  return { label: 'Parcial', severity: 'warn', count };
}

/** Severidad p-tag para el estado de matrícula del alumno. */
export function getAlumnoStatusSeverity(status: AlumnoStatus | string): TagSeverity {
  switch (status) {
    case 'Activo':
      return 'success';
    case 'Finalizado':
      return 'info';
    case 'Retirado':
      return 'danger';
    case 'Pre-inscrito':
      return 'warn';
    case 'Pendiente Pago':
      return 'warn';
    case 'Docs Pendientes':
      return 'info';
    case 'Inactivo':
      return 'secondary';
    default:
      return 'secondary';
  }
}

const TAG_TO_BADGE: Record<TagSeverity, BadgeVariant> = {
  success: 'success',
  warn: 'warning',
  danger: 'error',
  info: 'info',
  secondary: 'neutral',
};

/** Mapea una severidad de p-tag ('warn'/'danger'/'secondary'...) al variant equivalente de app-badge. */
export function tagSeverityToBadgeVariant(severity: TagSeverity): BadgeVariant {
  return TAG_TO_BADGE[severity];
}

/** Variant de app-badge para el estado de matrícula — atajo sobre getAlumnoStatusSeverity(). */
export function getAlumnoStatusBadgeVariant(status: AlumnoStatus | string): BadgeVariant {
  return tagSeverityToBadgeVariant(getAlumnoStatusSeverity(status));
}
