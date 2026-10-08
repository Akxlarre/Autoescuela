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

/**
 * Aviso al cambiar de sede a un instructor (hotfix-070-b, E13 de ASG-i-034). Igual que al
 * desactivar: sus clases ya agendadas no se mueven. Si queda en "Ambas" sigue cubriendo la sede
 * anterior, así que no hay nada que avisar.
 */
export function instructorBranchChangeNotice(
  futureClasses: number | null,
  scopeChanged: boolean,
  nowBothBranches: boolean,
): string | null {
  if (!scopeChanged || nowBothBranches || futureClasses === null || futureClasses <= 0) {
    return null;
  }
  return futureClasses === 1
    ? 'Tiene 1 clase agendada a futuro en su sede actual: no se mueve al cambiarlo de sede. Revísala en la Agenda.'
    : `Tiene ${futureClasses} clases agendadas a futuro en su sede actual: no se mueven al cambiarlo de sede. Revísalas en la Agenda.`;
}
