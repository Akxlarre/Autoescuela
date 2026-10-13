/** Campos de un vehículo por los que busca el listado de Flota. */
export interface VehicleSearchable {
  licensePlate: string;
  brand: string | null;
  model: string | null;
}

/** Minúsculas y sin tildes. */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * ¿El vehículo coincide con lo escrito en el buscador de Flota? (hotfix-073-b: antes el buscador
 * no filtraba nada). Busca en patente, marca y modelo; cada palabra del texto debe aparecer en
 * alguno. La patente se compara sin guiones ni espacios ("AB-CD 43" encuentra "ABCD43").
 */
export function matchesVehicleSearch(vehicle: VehicleSearchable, term: string): boolean {
  const query = normalize(term).trim();
  if (!query) return true;

  const plate = normalize(vehicle.licensePlate).replace(/[^a-z0-9]/g, '');
  if (plate.includes(query.replace(/[^a-z0-9]/g, ''))) return true;

  const haystack = `${plate} ${normalize(vehicle.brand ?? '')} ${normalize(vehicle.model ?? '')}`;
  return query.split(/\s+/).every((word) => haystack.includes(word));
}
