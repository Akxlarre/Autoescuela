import { formatChileDate, formatChileTime } from './chile-time.utils';

/**
 * fix-245-b (N03) — qué clase choca al "Reactivar horario".
 *
 * Reactivar vuelve a agendar de una vez todas las clases futuras canceladas de un alumno. Los
 * triggers de doble agendamiento de la BD (instructor, alumno, vehículo) siguen siendo la red de
 * seguridad, pero su mensaje no dice cuál clase choca. Estas funciones repiten la misma regla de
 * solape ANTES de escribir, para avisar con precisión y sin pedir una confirmación que va a fallar.
 */

/** Duración por defecto de una práctica, igual que el `COALESCE(duration_min, 45)` de los triggers. */
const DURACION_DEFAULT_MIN = 45;

/** Una clase práctica con lo necesario para evaluar el solape. */
export interface SesionAgendable {
  id: number;
  classNumber: number | null;
  scheduledAt: string | null;
  durationMin: number | null;
  instructorId: number | null;
  vehicleId: number | null;
  enrollmentId: number | null;
}

/** Columnas de `class_b_sessions` que necesita el chequeo (mismo orden que `SesionAgendableRow`). */
export const SESION_AGENDABLE_SELECT =
  'id, class_number, scheduled_at, duration_min, instructor_id, vehicle_id, enrollment_id';

/** Fila de `class_b_sessions` tal como la devuelve `SESION_AGENDABLE_SELECT`. */
export interface SesionAgendableRow {
  id: number;
  class_number?: number | null;
  scheduled_at?: string | null;
  duration_min?: number | null;
  instructor_id?: number | null;
  vehicle_id?: number | null;
  enrollment_id?: number | null;
}

export function toSesionAgendable(row: SesionAgendableRow): SesionAgendable {
  return {
    id: row.id,
    classNumber: row.class_number ?? null,
    scheduledAt: row.scheduled_at ?? null,
    durationMin: row.duration_min ?? null,
    instructorId: row.instructor_id ?? null,
    vehicleId: row.vehicle_id ?? null,
    enrollmentId: row.enrollment_id ?? null,
  };
}

/** Con qué choca la clase: otra clase del instructor, del vehículo o del propio alumno. */
export type MotivoChoque = 'instructor' | 'vehiculo' | 'alumno';

export interface ChoqueReactivacion {
  clase: SesionAgendable;
  motivo: MotivoChoque;
}

function intervalo(s: SesionAgendable): { inicio: number; fin: number } | null {
  if (!s.scheduledAt) return null;
  const inicio = new Date(s.scheduledAt).getTime();
  if (Number.isNaN(inicio)) return null;
  return { inicio, fin: inicio + (s.durationMin ?? DURACION_DEFAULT_MIN) * 60_000 };
}

function motivoEntre(a: SesionAgendable, b: SesionAgendable): MotivoChoque | null {
  if (a.instructorId !== null && a.instructorId === b.instructorId) return 'instructor';
  if (a.vehicleId !== null && a.vehicleId === b.vehicleId) return 'vehiculo';
  if (a.enrollmentId !== null && a.enrollmentId === b.enrollmentId) return 'alumno';
  return null;
}

/**
 * Clases candidatas que chocan con alguna clase ya ocupada (mismo instructor, vehículo o
 * matrícula, con intervalos que se solapan). Las candidatas no chocan entre sí: se reactivan
 * juntas y ya convivían antes de cancelarse. Ordenadas por fecha.
 */
export function findReactivationConflicts(
  candidatas: readonly SesionAgendable[],
  ocupadas: readonly SesionAgendable[],
): ChoqueReactivacion[] {
  const idsCandidatas = new Set(candidatas.map((c) => c.id));
  const choques: ChoqueReactivacion[] = [];

  for (const clase of candidatas) {
    const propio = intervalo(clase);
    if (!propio) continue;
    for (const otra of ocupadas) {
      if (idsCandidatas.has(otra.id)) continue;
      const ajeno = intervalo(otra);
      if (!ajeno || !(propio.inicio < ajeno.fin && ajeno.inicio < propio.fin)) continue;
      const motivo = motivoEntre(clase, otra);
      if (motivo) {
        choques.push({ clase, motivo });
        break;
      }
    }
  }

  return choques.sort(
    (a, b) => new Date(a.clase.scheduledAt!).getTime() - new Date(b.clase.scheduledAt!).getTime(),
  );
}

const TEXTO_MOTIVO: Record<MotivoChoque, string> = {
  instructor: 'el instructor ya tiene otra clase a esa hora',
  vehiculo: 'el vehículo ya tiene otra clase a esa hora',
  alumno: 'el alumno ya tiene otra clase a esa hora',
};

/** Texto del aviso: cada clase que choca (número, día y hora en Chile) y qué hacer. */
export function reactivationConflictMessage(choques: readonly ChoqueReactivacion[]): string {
  const lineas = choques.map(({ clase, motivo }) => {
    const numero = clase.classNumber !== null ? `Clase ${clase.classNumber}` : 'Una clase';
    const dia = formatChileDate(clase.scheduledAt, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `${numero} (${dia}, ${formatChileTime(clase.scheduledAt)}): ${TEXTO_MOTIVO[motivo]}.`;
  });
  return `${lineas.join(' ')} No se reactivó ninguna clase. Usa "Reagendar Clases" en la ficha del alumno para darle nuevas horas.`;
}
