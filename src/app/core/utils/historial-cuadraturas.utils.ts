import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';

/**
 * Cierres del mes agrupados por fecha. Con "Todas las sedes" un día puede tener un cierre por
 * sede: antes el calendario usaba `Map(fecha → cierre)` y el segundo pisaba al primero (fix-078-i).
 * Dentro del día van ordenados por sede.
 */
export function groupCierresByFecha(cierres: HistorialCierre[]): Map<string, HistorialCierre[]> {
  const map = new Map<string, HistorialCierre[]>();
  for (const c of cierres) {
    const lista = map.get(c.fecha);
    if (lista) lista.push(c);
    else map.set(c.fecha, [c]);
  }
  for (const lista of map.values()) {
    lista.sort((a, b) => (a.branchId ?? 0) - (b.branchId ?? 0));
  }
  return map;
}
