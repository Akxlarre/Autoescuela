import type { VehicleAgendaSlot } from '@core/models/ui/vehicle-detail.model';

/** Duración de una clase práctica cuando la sesión no la trae registrada. */
const DEFAULT_CLASS_MINUTES = 50;

/** Una clase del día del vehículo, con su hora de inicio ya en hora de Chile. */
export interface AgendaClassInput {
  hour: number;
  minute: number;
  durationMin: number | null;
  status: string | null;
  classNumber: number | null;
  studentName: string | null;
}

/** Un mantenimiento programado para ese día. */
export interface AgendaMaintenanceInput {
  type: string | null;
  description: string | null;
}

function hhmm(totalMinutes: number): string {
  const inDay = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(inDay / 60);
  const m = inDay % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Arma la agenda de un día de un vehículo (fix-221-b): primero los mantenimientos programados,
 * después las clases en orden, cada una con su hora real de inicio y de término. Las clases
 * canceladas no ocupan el vehículo y no se muestran.
 *
 * Antes la agenda era una grilla fija de horas en punto de 08 a 17: la clase de las 11:50 pisaba a
 * la de las 11:00 y las de la tarde no aparecían.
 */
export function buildVehicleAgenda(
  classes: AgendaClassInput[],
  maintenances: AgendaMaintenanceInput[],
): VehicleAgendaSlot[] {
  const maintenanceSlots: VehicleAgendaSlot[] = maintenances.map((m) => ({
    hour: 'Día',
    endHour: '',
    type: 'maintenance',
    description:
      [m.type, m.description].filter((part) => !!part?.trim()).join(' — ') ||
      'Mantenimiento programado',
  }));

  const classSlots: VehicleAgendaSlot[] = classes
    .filter((c) => c.status !== 'cancelled')
    .map((c) => ({ ...c, start: c.hour * 60 + c.minute }))
    .sort((a, b) => a.start - b.start)
    .map((c) => ({
      hour: hhmm(c.start),
      endHour: hhmm(c.start + (c.durationMin ?? DEFAULT_CLASS_MINUTES)),
      type: 'class',
      studentName: c.studentName?.trim() || 'Alumno',
      classNumber: c.classNumber ?? undefined,
    }));

  return [...maintenanceSlots, ...classSlots];
}
