import { LiveClassModel } from '@core/models/ui/dashboard.model';
import type { AgendaSlot } from '@core/models/ui/agenda.model';
import { toChileDate } from '@core/utils/chile-time.utils';
import { addMinutesToTime, to24hTime } from '@core/utils/date.utils';

export interface ClasePracticaActionRow {
  id: number;
  studentId?: number | null;
  classNumber?: number;
  alumnoName: string;
  instructorName: string;
  horaInicio: string;
  status: 'pendiente' | 'en_curso';
  kmStart?: number | null;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  vehicleId?: number | null;
  vehicleCurrentKm?: number | null;
  branchId?: number | null;
  /** fix-374-m: el drawer de Iniciar ofrece "Marcar ausente" cuando la hora ya pasó. */
  scheduledAt?: string;
}

/** Datos de una clase del dashboard para el drawer de detalle de la Agenda. */
export type LiveClassAgendaSlot = Omit<AgendaSlot, 'status' | 'vehicleDocWarning'> & {
  status: LiveClassModel['status'];
};

/**
 * Convierte una clase del panel "Clases Actuales" en el slot que muestra el drawer de detalle
 * (clase finalizada o "no asistió"). Único lugar donde se arma: el dashboard y el drawer "Agenda
 * de Hoy" lo armaban a mano, cada uno con sus omisiones (sin número de clase, y uno de los dos
 * sin la sesión que permite deshacer una falta — fix-406-m).
 */
export function liveClassToAgendaSlot(cls: LiveClassModel): LiveClassAgendaSlot {
  const startTime = to24hTime(cls.scheduledAt);
  return {
    id: cls.id,
    date: toChileDate(cls.scheduledAt),
    startTime,
    endTime: addMinutesToTime(startTime, cls.durationMin ?? 45),
    status: cls.status,
    instructorId: 0,
    instructorName: cls.instructorName,
    vehicleId: cls.vehicleId ?? 0,
    vehiclePlate: cls.vehicle || '',
    studentName: cls.studentName,
    sessionId: cls.type === 'practical' ? cls.originalId : undefined,
    classNumber: cls.classNumber,
    kmStart: cls.kmStart,
    kmEnd: cls.kmEnd,
    notes: cls.notes,
  };
}

export type LiveClassActionPlan =
  | { flow: 'iniciar'; row: ClasePracticaActionRow }
  | { flow: 'finalizar'; row: ClasePracticaActionRow }
  | { flow: 'informativo' };

/**
 * Decide qué drawer real corresponde abrir al hacer clic en una clase del panel
 * "Clases Actuales" del Dashboard, según su tipo y status (fix-076).
 */
export function resolveLiveClassActionPlan(cls: LiveClassModel): LiveClassActionPlan {
  if (cls.type !== 'practical') return { flow: 'informativo' };

  const horaInicio = to24hTime(cls.scheduledAt);
  const baseRow = {
    id: cls.originalId,
    classNumber: cls.classNumber,
    alumnoName: cls.studentName,
    instructorName: cls.instructorName,
    horaInicio,
    vehicleBrand: cls.vehicleBrand,
    vehicleModel: cls.vehicleModel,
    vehiclePlate: cls.vehiclePlate,
    vehicleId: cls.vehicleId,
    vehicleCurrentKm: cls.vehicleCurrentKm,
    branchId: cls.branchId,
    scheduledAt: cls.scheduledAt,
  };

  if (cls.status === 'pending') {
    return { flow: 'iniciar', row: { ...baseRow, status: 'pendiente' } };
  }

  if (cls.status === 'in_progress') {
    return {
      flow: 'finalizar',
      row: { ...baseRow, status: 'en_curso', studentId: cls.studentId, kmStart: cls.kmStart },
    };
  }

  return { flow: 'informativo' };
}
