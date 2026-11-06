/**
 * Siembra de clases para los e2e de la Agenda (ASG-i-026). Lo usan `agenda-3.spec.ts` y
 * `agenda-4.spec.ts`. Todo lo que se inserta se registra en `cleanup` y se borra al terminar el
 * test: la BD del piloto es producción.
 */
import { getAdminClient } from './supabase-admin';
import type { Cleanup } from './fixtures';

/** El instructor que usa `agenda.spec.ts` para iniciar clases: los demás tests lo evitan. */
export const AGENDA_INSTRUCTOR_223 = 223;
/** Bloques de 45 min de Clase B (indices/DATABASE.md, `courses.schedule_blocks`). */
export const BLOQUES = [
  '08:30',
  '09:20',
  '10:10',
  '11:00',
  '11:50',
  '12:40',
  '15:00',
  '15:50',
  '16:40',
];

/** YYYY-MM-DD en hora Chile, desplazado `dias` desde el lunes de esta semana. */
export function diaDeEstaSemana(dias: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  const lunes = new Date(d);
  lunes.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + dias);
  return lunes.toISOString().slice(0, 10);
}

/** "HH:MM" en hora Chile de un instante. */
export function horaChile(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

/** Día del mes (en hora Chile) de un instante. */
export function diaDelMesChile(iso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', day: 'numeric' }).format(
      new Date(iso),
    ),
  );
}

export interface InstructorSembrable {
  id: number;
  vehicleId: number;
  nombre: string;
  /** Horarios libres (instantes ISO) de la semana siguiente, según la vista de disponibilidad. */
  libresProxSemana: string[];
}

let instructorCache: InstructorSembrable | null = null;

/** Un instructor activo de la sede 1 con vehículo, que no sea el 223, y 6+ horarios libres. */
export async function instructorSembrable(): Promise<InstructorSembrable> {
  if (instructorCache) return instructorCache;
  const sb = await getAdminClient();
  const lunes = diaDeEstaSemana(7);
  const viernes = diaDeEstaSemana(11);
  // La vista no tiene sede: se eligen instructores de la sede 1 que no sean "ambas sedes".
  const { data: deSede1 } = await sb
    .from('instructors')
    .select('id, users!inner(branch_id)')
    .eq('users.branch_id', 1)
    .eq('both_branches', false)
    .neq('id', AGENDA_INSTRUCTOR_223);
  const ids = (deSede1 ?? []).map((r) => r.id as number);
  const { data: slots, error } = await sb
    .from('v_class_b_schedule_availability')
    .select('instructor_id, vehicle_id, slot_start')
    .eq('slot_status', 'available')
    .in('instructor_id', ids)
    .gte('slot_start', `${lunes}T00:00:00-03:00`)
    .lt('slot_start', `${viernes}T23:59:00-03:00`)
    .order('slot_start');
  if (error) throw new Error(`[e2e] Vista de disponibilidad: ${error.message}`);
  const porInstructor = new Map<number, { vehicleId: number; libres: string[] }>();
  for (const s of (slots ?? []) as {
    instructor_id: number;
    vehicle_id: number;
    slot_start: string;
  }[]) {
    const e = porInstructor.get(s.instructor_id) ?? { vehicleId: s.vehicle_id, libres: [] };
    e.libres.push(s.slot_start);
    porInstructor.set(s.instructor_id, e);
  }
  const elegido = [...porInstructor.entries()].find(([, e]) => e.libres.length >= 6);
  if (!elegido) throw new Error('[e2e] Ningún instructor de la sede 1 con horarios libres');
  const [id, { vehicleId, libres }] = elegido;
  const { data: inst } = await sb
    .from('instructors')
    .select('users!inner(first_names, paternal_last_name)')
    .eq('id', id)
    .single();
  const u = (inst as unknown as { users: { first_names: string; paternal_last_name: string } })
    .users;
  // No contiguos entre sí: la regla de clases por día no afecta a la vista.
  const espaciados = libres.filter((_, i) => i % 2 === 0);
  instructorCache = {
    id,
    vehicleId,
    nombre: `${u.first_names} ${u.paternal_last_name}`,
    libresProxSemana: espaciados,
  };
  return instructorCache;
}

export async function sembrarClase(
  enrollmentId: number,
  inst: InstructorSembrable,
  fila: Record<string, unknown>,
  cleanup: Cleanup,
): Promise<number> {
  const sb = await getAdminClient();
  const { data, error } = await sb
    .from('class_b_sessions')
    .insert({
      ...fila,
      enrollment_id: enrollmentId,
      instructor_id: inst.id,
      vehicle_id: inst.vehicleId,
    })
    .select('id')
    .single();
  if (error) throw new Error(`[e2e] No se pudo sembrar la clase: ${error.message}`);
  cleanup.track('class_b_sessions', data.id);
  return data.id;
}
