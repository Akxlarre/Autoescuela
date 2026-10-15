import type { CicloOption } from '@core/models/ui/ciclos-teoricos.model';

export interface CicloSelectGroup {
  label: string;
  items: { label: string; value: number }[];
}

/**
 * Ciclos a los que se puede cambiar un alumno del ciclo elegido: los demás ciclos de SU sede
 * (fix-387-m). Con "Todas las sedes" la lista trae ciclos de varias sedes, y un alumno nunca debe
 * terminar en el ciclo de otra: recibiría el enlace de una sede que no es la suya.
 */
export function cycleMoveTargets(
  cycles: CicloOption[],
  selectedCycleId: number | null,
): { label: string; value: number }[] {
  const selected = cycles.find((c) => c.id === selectedCycleId);
  if (!selected) return [];
  return cycles
    .filter((c) => c.id !== selected.id && c.branchId === selected.branchId)
    .map((c) => ({ label: c.label, value: c.id }));
}

/**
 * Agrupa los ciclos teóricos en "Activos" / "Finalizados" para el selector.
 * Evita que el dropdown se vuelva una lista plana ilegible a medida que
 * se acumula el historial de ciclos finalizados (meses/años de uso).
 */
export function groupCyclesByStatus(cycles: CicloOption[]): CicloSelectGroup[] {
  const activos = cycles.filter((c) => c.status === 'active');
  const finalizados = cycles.filter((c) => c.status === 'finished');

  return [
    { label: 'Activos', items: activos.map((c) => ({ label: c.label, value: c.id })) },
    { label: 'Finalizados', items: finalizados.map((c) => ({ label: c.label, value: c.id })) },
  ].filter((group) => group.items.length > 0);
}
