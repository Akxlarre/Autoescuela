import type { BadgeVariant } from './alumno-status.utils';

export interface EgresadoAccountStatus {
  label: string;
  variant: BadgeVariant;
}

const CLP_FORMATTER = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** Deriva el pill de estado de cuenta de un egresado a partir de su saldo pendiente. */
export function getEgresadoAccountStatus(saldoPendiente: number): EgresadoAccountStatus {
  if (saldoPendiente > 0) {
    return { label: `Debe ${CLP_FORMATTER.format(saldoPendiente)}`, variant: 'warning' };
  }
  return { label: 'Al día', variant: 'success' };
}
