/**
 * Siembra de clases prácticas para los tests de Asistencia Clase B (fix-366-m, ASG-i-027).
 *
 * Las clases se siembran AYER (día de Chile), entre la 01:00 y las 06:59: siempre son "hora
 * pasada" sin depender de a qué hora corre la suite, y a esas horas no hay clases reales con las
 * que chocar. Cada test usa su propio par (instructor, hora) —un "cupo"— para poder correr en
 * paralelo: la BD rechaza dos clases solapadas del mismo instructor o vehículo, y un instructor no
 * puede tener dos clases en curso.
 */
import {
  addDaysIso,
  chileToday,
  chileWallTimeToInstant,
} from '../../src/app/core/utils/chile-time.utils';
import { createE2eAlumno, type E2eAlumno } from './alumnos-seed';
import type { Cleanup } from './fixtures';
import { getAdminClient } from './supabase-admin';

export const SEDE_A = 1;
export const SEDE_B = 2;

/** Ayer, en el día de Chile: el día en que viven las clases sembradas. */
export function ayer(): string {
  return addDaysIso(chileToday(), -1);
}

/** Cupo de una clase sembrada: instructor (índice dentro de la sede) y hora (1 a 6). */
export interface Cupo {
  inst: number;
  hora: number;
}

export interface ClaseSpec {
  label: string;
  branchId: number;
  cupo: Cupo;
  /** Día de la clase (YYYY-MM-DD). Por defecto, ayer. */
  dia?: string;
  status?: 'scheduled' | 'no_show' | 'cancelled' | 'completed';
  classNumber?: number;
  enrollmentStatus?: 'active' | 'withdrawn';
  /** Deja además la inasistencia registrada (`absent`). `archived` la deja como historial. */
  falta?: 'vigente' | 'archivada';
  /** Otra clase del MISMO alumno: reutiliza su matrícula en vez de crear un alumno nuevo. */
  de?: ClaseSembrada;
}

export interface ClaseSembrada {
  sessionId: number;
  alumno: E2eAlumno;
  enrollmentId: number;
  instructorId: number;
  vehicleId: number;
  /** "HH:00" de la clase, como se ve en la columna Agendada. */
  hora: string;
}

interface Recursos {
  instructors: number[];
  vehicles: { id: number; km: number }[];
}

const recursos = new Map<number, Promise<Recursos>>();
/** Sesiones sembradas por este worker, para borrar lo que la app les cuelga (asistencias). */
const sesiones: number[] = [];
/** Usuarios de los alumnos sembrados: la app les deja notificaciones ("Clase completada"). */
const usuarios: number[] = [];
/** Kilometraje original de los vehículos usados, para devolverlo al terminar. */
const kmOriginal = new Map<number, number>();

function recursosDe(branchId: number): Promise<Recursos> {
  let found = recursos.get(branchId);
  if (!found) {
    found = (async () => {
      const sb = await getAdminClient();
      const { data: inst, error: instErr } = await sb
        .from('instructors')
        .select('id, users!inner(branch_id)')
        .eq('active', true)
        .eq('users.branch_id', branchId)
        .order('id');
      if (instErr)
        throw new Error(`[e2e] No se pudieron leer los instructores: ${instErr.message}`);
      const { data: veh, error: vehErr } = await sb
        .from('vehicles')
        .select('id, current_km')
        .eq('branch_id', branchId)
        .order('id');
      if (vehErr) throw new Error(`[e2e] No se pudieron leer los vehículos: ${vehErr.message}`);
      return {
        instructors: (inst ?? []).map((i) => i.id as number),
        vehicles: (veh ?? []).map((v) => ({
          id: v.id as number,
          km: (v.current_km ?? 0) as number,
        })),
      };
    })();
    recursos.set(branchId, found);
  }
  return found;
}

/** Siembra una clase práctica (y su alumno, salvo que se pase `de`). */
export async function seedClase(spec: ClaseSpec, cleanup: Cleanup): Promise<ClaseSembrada> {
  const sb = await getAdminClient();
  const { instructors, vehicles } = await recursosDe(spec.branchId);
  // Un vehículo por instructor: comparten índice para que tampoco se solapen los vehículos.
  const usable = Math.min(instructors.length, vehicles.length);
  if (spec.cupo.inst >= usable)
    throw new Error(
      `[e2e] La sede ${spec.branchId} no tiene ${spec.cupo.inst + 1} instructores con vehículo`,
    );
  const instructorId = instructors[spec.cupo.inst];
  const vehicle = vehicles[spec.cupo.inst];
  if (!kmOriginal.has(vehicle.id)) kmOriginal.set(vehicle.id, vehicle.km);

  const alumno =
    spec.de?.alumno ??
    (await createE2eAlumno(
      {
        label: spec.label,
        branchId: spec.branchId,
        enrollments: [{ status: spec.enrollmentStatus ?? 'active' }],
      },
      cleanup,
    ));
  const enrollmentId = spec.de?.enrollmentId ?? alumno.enrollmentIds[0];
  if (!spec.de) usuarios.push(alumno.userId);

  const hora = `${String(spec.cupo.hora).padStart(2, '0')}:00`;
  const { data: session, error } = await sb
    .from('class_b_sessions')
    .insert({
      enrollment_id: enrollmentId,
      instructor_id: instructorId,
      vehicle_id: vehicle.id,
      class_number: spec.classNumber ?? 1,
      scheduled_at: chileWallTimeToInstant(spec.dia ?? ayer(), hora),
      status: spec.status ?? 'scheduled',
    })
    .select('id')
    .single();
  if (error) throw new Error(`[e2e] No se pudo sembrar la clase "${spec.label}": ${error.message}`);
  cleanup.track('class_b_sessions', session.id);
  sesiones.push(session.id);

  if (spec.falta) {
    const { error: attErr } = await sb.from('class_b_practice_attendance').insert({
      class_b_session_id: session.id,
      student_id: alumno.studentId,
      status: 'absent',
      archived_at: spec.falta === 'archivada' ? new Date().toISOString() : null,
    });
    if (attErr) throw new Error(`[e2e] No se pudo sembrar la inasistencia: ${attErr.message}`);
  }

  return { sessionId: session.id, alumno, enrollmentId, instructorId, vehicleId: vehicle.id, hora };
}

/**
 * Deja la BD lista para que el `cleanup` del test pueda borrar las clases sembradas: quita las
 * asistencias que les colgó la app (o la siembra) y devuelve el kilometraje de los vehículos.
 * Va en un `test.afterEach`, que corre antes del teardown de las fixtures.
 */
export async function limpiarAsistencia(): Promise<void> {
  const sb = await getAdminClient();
  const ids = sesiones.splice(0);
  if (ids.length) {
    await sb.from('class_b_practice_attendance').delete().in('class_b_session_id', ids);
    await sb.from('class_b_reschedule_history').delete().in('class_session_id', ids);
  }
  const userIds = usuarios.splice(0);
  if (userIds.length) await sb.from('notifications').delete().in('recipient_id', userIds);
  for (const [vehicleId, km] of kmOriginal) {
    await sb.from('vehicles').update({ current_km: km }).eq('id', vehicleId);
  }
  kmOriginal.clear();
  // La caché de recursos guarda el km leído al inicio: se relee en el test siguiente.
  recursos.clear();
}

/** Estado en la BD de una clase sembrada y de su asistencia vigente. */
export async function estadoClase(sessionId: number): Promise<{
  status: string;
  startTime: string | null;
  kmStart: number | null;
  kmEnd: number | null;
  asistencias: { status: string; archived: boolean; justification: string | null }[];
}> {
  const sb = await getAdminClient();
  const { data: s, error } = await sb
    .from('class_b_sessions')
    .select('status, start_time, km_start, km_end')
    .eq('id', sessionId)
    .single();
  if (error) throw new Error(`[e2e] No se pudo leer la clase ${sessionId}: ${error.message}`);
  const { data: a } = await sb
    .from('class_b_practice_attendance')
    .select('status, archived_at, justification')
    .eq('class_b_session_id', sessionId);
  return {
    status: s.status,
    startTime: s.start_time,
    kmStart: s.km_start,
    kmEnd: s.km_end,
    asistencias: (a ?? []).map((r) => ({
      status: r.status,
      archived: r.archived_at !== null,
      justification: r.justification,
    })),
  };
}
