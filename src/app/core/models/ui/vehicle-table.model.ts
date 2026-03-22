/**
 * Modelos UI para la vista de tabla de Flota.
 * Estas interfaces son el contrato entre FlotaFacade y FlotaListContentComponent.
 */

export type VehicleType = 'class_b' | 'professional';
export type VehicleStatus = 'available' | 'in_class' | 'maintenance' | 'out_of_service';
export type DocStatus = 'valid' | 'expiring_soon' | 'expired';

export interface VehicleDocSummary {
  type: string; // 'soap' | 'technical_inspection' | 'circulation_permit' | 'insurance'
  expiryDate: string;
  status: DocStatus;
}

export interface VehicleTableRow {
  id: number;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  /** "{brand} {model}" combinado para la columna Vehículo */
  vehicleLabel: string;
  type: VehicleType;
  status: VehicleStatus;
  currentKm: number;
  nextMaintenanceDate: string | null;
  instructorName: string | null;
  instructorId: number | null;
  branchId: number | null;
  documents: VehicleDocSummary[];
}

export interface FlotaKpis {
  total: number;
  available: number;
  inClass: number;
  maintenance: number;
}
