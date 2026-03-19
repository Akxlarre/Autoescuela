/**
 * Modelos UI para la vista de detalle de vehículo (mantenimientos + agenda).
 * Estas interfaces son el contrato entre FlotaDetalleFacade y las páginas/drawers de detalle.
 */

export interface MaintenanceRow {
  id: number;
  date: string;
  type: string;
  km: number | null;
  cost: number | null;
  workshop: string | null;
  nextServiceDate: string | null;
  description: string | null;
  status: string;
}

export interface MaintenanceKpis {
  totalCount: number;
  totalSpent: number;
  avgMonthly: number;
  kmTraveled: number;
}

export interface ScheduledMaintenance {
  type: string;
  dueDate: string | null;
  status: 'ok' | 'soon' | 'overdue';
}

export interface VehicleAgendaSlot {
  hour: string;
  endHour: string;
  type: 'class' | 'available' | 'maintenance' | 'empty';
  studentName?: string;
  classNumber?: number;
  description?: string;
}
