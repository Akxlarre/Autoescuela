/**
 * Formatos de la página de mantenimientos de un vehículo (hotfix-086-b). Antes usaba
 * `toLocaleString()` sin locale (separador inglés: "1,500,000") y "1 servicios".
 */

const KM = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });

/** "1.200 km"; "—" si no hay kilometraje. */
export function formatKm(km: number | null | undefined): string {
  return km === null || km === undefined ? '—' : `${KM.format(km)} km`;
}

/** "1 servicio" / "N servicios". */
export function servicesLabel(count: number): string {
  return `${count} ${count === 1 ? 'servicio' : 'servicios'}`;
}
