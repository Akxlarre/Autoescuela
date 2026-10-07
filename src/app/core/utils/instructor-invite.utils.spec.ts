import { describe, expect, it } from 'vitest';
import { instructorCreatedToast } from './instructor-invite.utils';

// fix-214-b (H06/C29 de ASG-i-034): qué se le dice al admin según el correo de invitación.
describe('instructorCreatedToast', () => {
  it('se pidió el correo y salió → éxito normal', () => {
    expect(instructorCreatedToast(true, true)).toEqual({
      kind: 'success',
      summary: 'Instructor creado',
      detail: 'La cuenta ha sido creada y se envió el correo de invitación.',
    });
  });

  it('se pidió el correo y NO salió → advertencia con qué hacer', () => {
    expect(instructorCreatedToast(true, false)).toEqual({
      kind: 'warning',
      summary: 'Instructor creado',
      detail: 'No se pudo enviar el correo de invitación. Reenvíala desde Editar instructor.',
    });
  });

  it('piloto (no se pidió el correo) → éxito, aclarando que la invitación queda pendiente', () => {
    expect(instructorCreatedToast(false, false)).toEqual({
      kind: 'success',
      summary: 'Instructor creado',
      detail:
        'La cuenta ha sido creada. La invitación se enviará cuando termine el piloto del portal de instructores.',
    });
  });

  it('función vieja sin inviteEmailSent (undefined) → se asume enviado', () => {
    expect(instructorCreatedToast(true, undefined).kind).toBe('success');
  });
});
