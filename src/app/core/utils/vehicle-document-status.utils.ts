import type { DocStatus } from '@core/models/ui/vehicle-table.model';
import { chileToday, diffDaysIso, toChileDate } from '@core/utils/chile-time.utils';
import { VEHICLE_DOC_TYPES } from '@core/utils/vehicle-doc-types.util';

const EXPIRY_SOON_DAYS = 30;

export function resolveDocStatus(expiryDate: string | null, rawStatus: string | null): DocStatus {
  // hotfix-081-b (I07): manda la fecha. El estado guardado solo cuenta si no hay fecha.
  if (!expiryDate) return rawStatus === 'expired' ? 'expired' : 'valid';
  // Días de calendario hasta el vencimiento, contados desde el hoy de Chile.
  const diffDays = diffDaysIso(chileToday(), toChileDate(expiryDate));
  return diffDays < 0 ? 'expired' : diffDays <= EXPIRY_SOON_DAYS ? 'expiring_soon' : 'valid';
}

/** Advertencia agregada de un vehículo: nombres de los documentos específicos en cada estado. */
export interface VehicleDocWarningInfo {
  expiredDocs: string[];
  expiringSoonDocs: string[];
}

export type VehicleDocWarning = VehicleDocWarningInfo | null | undefined;

/** Decide si el badge de advertencia de documentos de vehículo debe mostrarse en un slot. */
export function shouldShowVehicleDocWarning(
  vehicleDocWarning: VehicleDocWarning,
  showVehicleWarnings: boolean,
): boolean {
  if (!showVehicleWarnings || !vehicleDocWarning) return false;
  return vehicleDocWarning.expiredDocs.length > 0 || vehicleDocWarning.expiringSoonDocs.length > 0;
}

function joinDocNames(docs: string[]): string {
  if (docs.length === 0) return '';
  if (docs.length === 1) return docs[0];
  return `${docs.slice(0, -1).join(', ')} y ${docs[docs.length - 1]}`;
}

/** Arma "SOAP vencido" / "SOAP y Seguro vencidos; Revisión Técnica por vencer", etc. */
function buildWarningSentence(vehicleDocWarning: VehicleDocWarning): string {
  if (!vehicleDocWarning) return '';
  const parts: string[] = [];
  const { expiredDocs, expiringSoonDocs } = vehicleDocWarning;
  if (expiredDocs.length > 0) {
    parts.push(`${joinDocNames(expiredDocs)} vencido${expiredDocs.length > 1 ? 's' : ''}`);
  }
  if (expiringSoonDocs.length > 0) {
    parts.push(`${joinDocNames(expiringSoonDocs)} por vencer`);
  }
  return parts.join('; ');
}

/** Texto del tooltip del badge de advertencia, con los documentos específicos afectados. */
export function vehicleDocWarningLabel(
  vehiclePlate: string,
  vehicleDocWarning: VehicleDocWarning,
): string {
  const sentence = buildWarningSentence(vehicleDocWarning);
  return sentence ? `Vehículo ${vehiclePlate}: ${sentence}` : '';
}

/** Variante sin patente — para grillas que no muestran el vehículo por slot (ScheduleGridComponent). */
export function vehicleDocWarningLabelGeneric(vehicleDocWarning: VehicleDocWarning): string {
  const sentence = buildWarningSentence(vehicleDocWarning);
  return sentence ? `Vehículo con ${sentence}` : '';
}

/**
 * fix-251-b: el aviso solo sirve donde el vehículo todavía va a salir. El estado del documento se
 * calcula contra hoy, no contra el día de la clase: en una clase que ya pasó diría algo falso.
 */
export function vehicleDocWarningApplies(status: string): boolean {
  return status === 'available' || status === 'scheduled' || status === 'in_progress';
}

/** Lo mínimo de un slot que necesita el resumen de vehículos observados. */
export interface VehicleDocWarningSlot {
  status: string;
  vehicleId: number;
  vehiclePlate: string;
  vehicleDocWarning: VehicleDocWarning;
}

/**
 * fix-251-b: una línea sobre la grilla con los vehículos observados de los días visibles. El aviso
 * es del vehículo, no del horario: se nombra una vez aunque tenga muchos horarios.
 */
export function vehicleDocWarningsNotice(slots: readonly VehicleDocWarningSlot[]): string | null {
  const byVehicle = new Map<number, { plate: string; sentence: string }>();
  for (const s of slots) {
    if (byVehicle.has(s.vehicleId) || !vehicleDocWarningApplies(s.status)) continue;
    const sentence = buildWarningSentence(s.vehicleDocWarning);
    if (sentence) byVehicle.set(s.vehicleId, { plate: s.vehiclePlate, sentence });
  }
  const vehicles = [...byVehicle.values()].sort((a, b) => a.plate.localeCompare(b.plate));
  if (vehicles.length === 0) return null;
  const tail = 'Sus horas se siguen ofreciendo.';
  if (vehicles.length === 1) {
    return `Vehículo ${vehicles[0].plate}: ${vehicles[0].sentence}. ${tail}`;
  }
  const list = vehicles.map((v) => `${v.plate} (${v.sentence})`).join(', ');
  return `${vehicles.length} vehículos con documentos vencidos o por vencer: ${list}. ${tail}`;
}

export interface VehicleDocumentRow {
  vehicle_id: number;
  type: string;
  expiry_date: string | null;
  status: string | null;
}

function vehicleDocTypeLabel(type: string): string {
  return VEHICLE_DOC_TYPES.find((d) => d.value === type)?.label ?? type;
}

/**
 * Reduce filas crudas de `vehicle_documents` a un mapa `vehicle_id → documentos vencidos/por vencer`.
 */
export function buildVehicleDocWarningMap(
  rows: readonly VehicleDocumentRow[],
): Map<number, VehicleDocWarningInfo> {
  const map = new Map<number, VehicleDocWarningInfo>();
  for (const row of rows) {
    const status = resolveDocStatus(row.expiry_date, row.status);
    if (status === 'valid') continue;
    const entry = map.get(row.vehicle_id) ?? { expiredDocs: [], expiringSoonDocs: [] };
    const label = vehicleDocTypeLabel(row.type);
    if (status === 'expired') entry.expiredDocs.push(label);
    else entry.expiringSoonDocs.push(label);
    map.set(row.vehicle_id, entry);
  }
  return map;
}
