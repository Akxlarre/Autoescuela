import type { VehicleStatus } from '@core/models/ui/vehicle-table.model';

const STATUS_MAP: Record<string, VehicleStatus> = {
  operational: 'available',
  available: 'available',
  disponible: 'available',
  in_use: 'available',
  in_class: 'available',
  'en clase': 'available',
  maintenance: 'maintenance',
  mantenimiento: 'maintenance',
  out_of_service: 'out_of_service',
  blocked: 'out_of_service',
};

export function resolveVehicleStatus(raw: string | null | undefined): VehicleStatus {
  return STATUS_MAP[raw?.toLowerCase() ?? ''] ?? 'available';
}

/**
 * fix-224-b: un vehículo en Mantenimiento o Fuera de servicio no ofrece horarios ni aparece en
 * los selectores. Espejo SQL: `public.vehicle_is_operational(text)`.
 */
export function isVehicleOperational(raw: string | null | undefined): boolean {
  return resolveVehicleStatus(raw) === 'available';
}
