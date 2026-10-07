/**
 * Avisos al desactivar un instructor (fix-205-b, S9 de ASG-i-034). Decisión del owner: avisar,
 * no bloquear. Desactivar no reasigna sus clases futuras ni libera su vehículo, así que el aviso
 * dice qué queda colgando.
 *
 * @param futureClasses clases `scheduled` desde ahora; `null` si el conteo aún no cargó.
 * @param vehiclePlate patente del vehículo asignado, o `null` si no tiene.
 */
export function instructorDeactivationNotices(
  futureClasses: number | null,
  vehiclePlate: string | null,
): string[] {
  const notices = [
    'Desactivar este instructor le impedirá iniciar sesión y recibir clases nuevas.',
  ];

  if (futureClasses !== null && futureClasses > 0) {
    notices.push(
      futureClasses === 1
        ? 'Tiene 1 clase agendada a futuro: quedará con un instructor inactivo. Reasígnala desde la Agenda.'
        : `Tiene ${futureClasses} clases agendadas a futuro: quedarán con un instructor inactivo. Reasígnalas desde la Agenda.`,
    );
  }

  if (vehiclePlate) {
    notices.push(
      `Su vehículo ${vehiclePlate} sigue asignado: quítalo arriba si quieres que otro instructor lo use.`,
    );
  }

  return notices;
}
