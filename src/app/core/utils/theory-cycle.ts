/**
 * Funciones puras del Motor de Ciclos Teóricos (Clase B).
 *
 * Espejo en TypeScript de la lógica SQL del trigger `assign_theory_cycle()`.
 * Permiten testear las reglas de cohorte sin levantar Angular ni la BD, y
 * derivar etiquetas/fechas para la UI.
 *
 * Reglas de negocio:
 * - Un ciclo siempre inicia un Lunes y termina el Viernes de la semana siguiente
 *   (start + 11 días).
 * - Tiene 6 clases en Lun/Mié/Vie de las dos semanas (offsets 0,2,4,7,9,11).
 * - RF-04: matrícula Lun/Mar/Mié → ciclo de la semana en curso.
 * - RF-05: matrícula Jue/Vie/Sáb/Dom → ciclo de la semana siguiente.
 */

import { isoToDate, toISODate, capitalize } from './date.utils';

/** Día de la semana en formato ISO: 1 = Lunes … 7 = Domingo. */
function isoDayOfWeek(date: Date): number {
  const js = date.getDay(); // 0 = Domingo … 6 = Sábado
  return js === 0 ? 7 : js;
}

/** Suma `days` días a una fecha ISO ('YYYY-MM-DD') y devuelve ISO. */
function addDays(iso: string, days: number): string {
  const d = isoToDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * Devuelve el lunes (ISO 'YYYY-MM-DD') del ciclo al que corresponde una matrícula
 * registrada en `enrollDate`.
 * - dow ∈ {1,2,3} (Lun–Mié) → lunes de la semana en curso.
 * - dow ∈ {4,5,6,7} (Jue–Dom) → lunes de la semana siguiente.
 */
export function cycleStartMonday(enrollDate: string): string {
  const d = isoToDate(enrollDate);
  if (!d) return enrollDate;
  const dow = isoDayOfWeek(d);
  const mondayThisWeek = addDays(enrollDate, -(dow - 1));
  return dow <= 3 ? mondayThisWeek : addDays(mondayThisWeek, 7);
}

/** Viernes de la semana siguiente = lunes de inicio + 11 días. */
export function cycleEnd(startMonday: string): string {
  return addDays(startMonday, 11);
}

/** Offsets en días de las 6 clases respecto del lunes de inicio (L/X/V × 2 semanas). */
const CLASS_DAY_OFFSETS = [0, 2, 4, 7, 9, 11] as const;

/** Las 6 fechas (ISO) de clases del ciclo, en orden cronológico. */
export function cycleClassDates(startMonday: string): string[] {
  return CLASS_DAY_OFFSETS.map((offset) => addDays(startMonday, offset));
}

/**
 * Etiqueta legible del ciclo, ej: "Ciclo — Lunes 9 de marzo".
 * Si se provee `branchName`, se agrega al final (ej: "... · Autoescuela Chillán")
 * para distinguir ciclos de distintas sedes que comparten el mismo lunes de inicio
 * (ocurre cuando el filtro activo es "Todas las escuelas").
 */
export function formatCycleLabel(startMonday: string, branchName?: string): string {
  const d = isoToDate(startMonday);
  if (!d) return 'Ciclo';
  const weekday = capitalize(d.toLocaleDateString('es-CL', { weekday: 'long' }));
  const day = d.toLocaleDateString('es-CL', { day: 'numeric' });
  const month = d.toLocaleDateString('es-CL', { month: 'long' });
  const base = `Ciclo — ${weekday} ${day} de ${month}`;
  return branchName ? `${base} · ${branchName}` : base;
}
