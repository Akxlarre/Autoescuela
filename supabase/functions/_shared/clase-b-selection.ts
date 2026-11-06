// supabase/functions/_shared/clase-b-selection.ts
//
// Núcleo funcional (fix-240-b): decide en el servidor si los horarios que eligió el alumno en la
// matrícula online Clase B se pueden agendar. Antes `public-enrollment` confiaba en el navegador:
// la grilla filtraba sede, ocupados y días, pero una llamada directa creaba clases en cualquier
// horario. Las mismas reglas que `buildScheduleGrid` y `load-schedule` aplican al mostrar la grilla.
//
//   deno test supabase/functions/_shared/clase-b-selection.test.ts

import { chileToday, toChileDate } from './chile-time.ts';

/** Fila de `v_class_b_schedule_availability` de un instructor. */
export interface AvailabilityRow {
  slot_start: string;
  slot_status: string;
  vehicle_id: number | null;
  branch_ids: number[] | null;
}

export interface ClaseBSelectionInput {
  /** Horarios que mandó el cliente (instantes ISO; el `id` de la grilla). */
  slotIds: string[];
  /** Disponibilidad del instructor elegido. */
  rows: AvailabilityRow[];
  /** Sede de la matrícula. */
  branchId: number;
  /** `slot_start` de los holds vigentes de OTRAS sesiones para el instructor. */
  heldByOthers: string[];
  now?: Date;
}

export type ClaseBSelectionResult =
  | { ok: true; vehicleId: number | null; slotStarts: string[] }
  | {
      ok: false;
      reason: 'empty' | 'too_many' | 'duplicate' | 'unavailable' | 'held' | 'mixed_vehicle';
      slots: string[];
    };

/** Techo de horarios por matrícula (el mismo de `reserve-slots`). */
export const MAX_CLASE_B_SLOTS = 20;

export function checkClaseBSelection(input: ClaseBSelectionInput): ClaseBSelectionResult {
  const { slotIds, rows, branchId, heldByOthers, now = new Date() } = input;
  if (slotIds.length === 0) return { ok: false, reason: 'empty', slots: [] };
  if (slotIds.length > MAX_CLASE_B_SLOTS) return { ok: false, reason: 'too_many', slots: [] };

  // Se compara por instante: el cliente puede mandar el mismo horario en otro formato ISO.
  const vistos = new Set<number>();
  const repetidos = slotIds.filter((id) => {
    const t = Date.parse(id);
    if (Number.isNaN(t)) return false;
    if (vistos.has(t)) return true;
    vistos.add(t);
    return false;
  });
  if (repetidos.length) return { ok: false, reason: 'duplicate', slots: repetidos };

  // Igual que la grilla: solo días posteriores a hoy en Chile.
  const hoy = chileToday(now);
  const validas = rows.filter(
    (r) =>
      r.slot_status === 'available' &&
      (r.branch_ids ?? []).includes(branchId) &&
      toChileDate(new Date(r.slot_start)) > hoy,
  );
  const porInstante = new Map<number, AvailabilityRow>();
  for (const r of validas) {
    const t = Date.parse(r.slot_start);
    if (!porInstante.has(t)) porInstante.set(t, r);
  }

  const elegidas = slotIds.map((id) => ({ id, row: porInstante.get(Date.parse(id)) }));
  const noDisponibles = elegidas.filter((e) => !e.row).map((e) => e.id);
  if (noDisponibles.length) return { ok: false, reason: 'unavailable', slots: noDisponibles };

  const retenidos = new Set(heldByOthers.map((h) => Date.parse(h)));
  const tomados = elegidas
    .filter((e) => retenidos.has(Date.parse(e.id)))
    .map((e) => e.row!.slot_start);
  if (tomados.length) return { ok: false, reason: 'held', slots: tomados };

  // Las clases se crean con un solo vehículo (el del horario, no "cualquier asignación activa").
  const vehicleId = elegidas[0].row!.vehicle_id;
  const otroVehiculo = elegidas
    .filter((e) => e.row!.vehicle_id !== vehicleId)
    .map((e) => e.row!.slot_start);
  if (otroVehiculo.length) return { ok: false, reason: 'mixed_vehicle', slots: otroVehiculo };

  return { ok: true, vehicleId, slotStarts: elegidas.map((e) => e.row!.slot_start) };
}
