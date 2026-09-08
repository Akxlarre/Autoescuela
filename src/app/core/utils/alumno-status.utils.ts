import type { AlumnoExpediente, AlumnoStatus } from '@core/models/ui/alumno-table-row.model';

export interface ExpedienteStatus {
  label: 'Completo' | 'Parcial' | 'Pendiente';
  severity: 'success' | 'warn' | 'danger';
  count: string;
}

export type TagSeverity = 'success' | 'secondary' | 'info' | 'danger' | 'warn';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** Deriva Completo/Parcial/Pendiente + conteo "n/4" a partir de los 4 documentos del expediente. */
export function getExpedienteStatus(exp: AlumnoExpediente): ExpedienteStatus {
  const docs = [exp.ci, exp.foto, exp.medico, exp.semep];
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
