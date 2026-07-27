import { LiveClassModel } from '@core/models/ui/dashboard.model';
import { to24hTime } from '@core/utils/date.utils';

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
