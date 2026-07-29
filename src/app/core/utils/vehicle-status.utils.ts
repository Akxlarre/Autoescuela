import type { VehicleStatus } from '@core/models/ui/vehicle-table.model';

const STATUS_MAP: Record<string, VehicleStatus> = {
  operational: 'available',
  available: 'available',
  disponible: 'available',
  in_use: 'in_class',
  in_class: 'in_class',
  'en clase': 'in_class',
  maintenance: 'maintenance',
  mantenimiento: 'maintenance',
  out_of_service: 'out_of_service',
  blocked: 'out_of_service',
};

export function resolveVehicleStatus(raw: string | null | undefined): VehicleStatus {
  return STATUS_MAP[raw?.toLowerCase() ?? ''] ?? 'available';
}
