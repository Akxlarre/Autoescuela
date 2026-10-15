/**
 * Modelos UI para la vista de tabla de Flota.
 * Estas interfaces son el contrato entre FlotaFacade y FlotaListContentComponent.
 */

export type VehicleStatus = 'available' | 'maintenance' | 'out_of_service';
export type DocStatus = 'valid' | 'expiring_soon' | 'expired';

export interface VehicleDocSummary {
  type: string; // 'soap' | 'technical_inspection' | 'circulation_permit' | 'insurance'
  expiryDate: string;
  status: DocStatus;
  /** Storage path en el bucket 'documents' (no URL pública) — null si nunca se adjuntó archivo. */
  filePath: string | null;
}

export interface VehicleTableRow {
  id: number;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  /** "{brand} {model}" combinado para la columna Vehículo */
  vehicleLabel: string;
  status: VehicleStatus;
  currentKm: number;
  nextMaintenanceDate: string | null;
  instructorName: string | null;
  instructorId: number | null;
  branchId: number | null;
  bothBranches: boolean;
  /**
   * ¿La persona con sesión puede operar este vehículo (editar la ficha, documentos y
   * mantenimientos)? Lo calcula el facade con `canManageVehicle()` (spec 0051-b).
   */
  canManage: boolean;
  documents: VehicleDocSummary[];
  /** Suma de expenses.amount con category='combustible' del mes en curso (fix-007-i). 0 si no registra gastos. */
  combustibleMes: number;
}

export interface FlotaKpis {
  total: number;
  available: number;
  maintenance: number;
}
