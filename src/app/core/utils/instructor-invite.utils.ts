/**
 * Mensaje al crear un instructor según el correo de invitación (fix-214-b, H06/C29 de ASG-i-034).
 * Antes siempre decía "creado" aunque el correo no hubiera salido (C29), y durante el piloto se
 * mandaba una invitación a un portal bloqueado (H06).
 *
 * @param inviteRequested se pidió enviar el correo (false durante el piloto del portal de instructores).
 * @param inviteEmailSent lo que respondió `create-instructor`; `undefined` = versión sin el campo.
 */
export function instructorCreatedToast(
  inviteRequested: boolean,
  inviteEmailSent: boolean | undefined,
): { kind: 'success' | 'warning'; summary: string; detail: string } {
  const summary = 'Instructor creado';
  if (!inviteRequested) {
    return {
      kind: 'success',
      summary,
      detail:
        'La cuenta ha sido creada. La invitación se enviará cuando termine el piloto del portal de instructores.',
    };
  }
  if (inviteEmailSent === false) {
    return {
      kind: 'warning',
      summary,
      detail: 'No se pudo enviar el correo de invitación. Reenvíala desde Editar instructor.',
    };
  }
  return {
    kind: 'success',
    summary,
    detail: 'La cuenta ha sido creada y se envió el correo de invitación.',
  };
}
