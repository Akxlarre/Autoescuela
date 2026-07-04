import type { CicloOption } from '@core/models/ui/ciclos-teoricos.model';

export interface CicloSelectGroup {
  label: string;
  items: { label: string; value: number }[];
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
