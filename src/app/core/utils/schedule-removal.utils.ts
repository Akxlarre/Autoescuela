/**
 * spec 0058-b — Textos de "Eliminar horario" / "Reactivar horario" (Clase B).
 *
 * Funciones puras: los facades de Asistencia y de alertas del dashboard arman con esto los avisos
 * al alumno e instructores y el mensaje del modal de confirmación. Fechas siempre en hora de Chile.
 */
import { formatChileDate, formatChileTime } from './chile-time.utils';

/** AC4: la matrícula no tiene una eliminación que deshacer. Mismo texto que la RPC. */
export const SIN_ELIMINACION_MSG =
  'Estas clases no se cancelaron con "Eliminar horario". Usa "Reagendar Clases" en la ficha del alumno.';

export type ScheduleNoticeKind = 'removed' | 'reactivated';

export interface ScheduleNoticeInput {
  kind: ScheduleNoticeKind;
  count: number;
  /** Instante de la primera clase afectada (ISO). */
  firstAt: string;
  alumnoName: string;
}

interface ScheduleNotice {
  subject: string;
  message: string;
}

const dia = (iso: string): string => formatChileDate(iso, { day: 'numeric', month: 'long' });
const diaHora = (iso: string): string => `${dia(iso)} a las ${formatChileTime(iso)}`;

function removedNotices(count: number, firstAt: string, alumnoName: string) {
  const subject = 'Horario eliminado';
  if (count === 1) {
    return {
      alumno: {
        subject,
        message: `Se canceló tu clase práctica del ${diaHora(firstAt)}. Comunícate con la escuela para reagendarla.`,
      },
      instructor: {
        subject,
        message: `Se canceló la clase de ${alumnoName} del ${diaHora(firstAt)}.`,
      },
    };
  }
  return {
    alumno: {
      subject,
      message: `Se cancelaron tus ${count} clases prácticas a partir del ${dia(firstAt)}. Comunícate con la escuela para reagendarlas.`,
    },
    instructor: {
      subject,
      message: `Se cancelaron ${count} clases de ${alumnoName} a partir del ${dia(firstAt)}.`,
    },
  };
}

function reactivatedNotices(count: number, firstAt: string, alumnoName: string) {
  const subject = 'Horario reactivado';
  if (count === 1) {
    return {
      alumno: {
        subject,
        message: `Tu clase práctica del ${diaHora(firstAt)} volvió a la agenda.`,
      },
      instructor: {
        subject,
        message: `Volvió a tu agenda la clase de ${alumnoName} del ${diaHora(firstAt)}.`,
      },
    };
  }
  return {
    alumno: {
      subject,
      message: `Tus ${count} clases prácticas volvieron a la agenda en su horario original. La primera es el ${diaHora(firstAt)}.`,
    },
    instructor: {
      subject,
      message: `Volvieron a tu agenda ${count} clases de ${alumnoName}. La primera es el ${diaHora(firstAt)}.`,
    },
  };
}

/** Avisos al alumno y a los instructores tras eliminar (AC9) o reactivar (AC5) un horario. */
export function scheduleRemovalNotices(input: ScheduleNoticeInput): {
  alumno: ScheduleNotice;
  instructor: ScheduleNotice;
} {
  const { kind, count, firstAt, alumnoName } = input;
  return kind === 'removed'
    ? removedNotices(count, firstAt, alumnoName)
    : reactivatedNotices(count, firstAt, alumnoName);
}

/** Mensaje del modal de "Reactivar horario": cuántas vuelven, quién y cuándo las eliminó. */
export function reactivateConfirmMessage(input: {
  count: number;
  alumnoName: string;
  removedAt: string;
  removedByName: string | null;
}): string {
  const { count, alumnoName, removedAt, removedByName } = input;
  const cuantas =
    count === 1
      ? 'Se volverá a agendar 1 clase futura'
      : `Se volverán a agendar ${count} clases futuras`;
  const quien = removedByName
    ? `que eliminó ${removedByName} el ${dia(removedAt)}`
    : `que se eliminó el ${dia(removedAt)}`;
  return `${cuantas} de ${alumnoName}, ${quien}, en su horario original. Las clases de fechas pasadas quedan canceladas.`;
}
