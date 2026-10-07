import { describe, expect, it } from 'vitest';
import { instructorDeactivationNotices } from './instructor-deactivation.utils';

// fix-205-b (S9 de ASG-i-034): avisar, no bloquear.
describe('instructorDeactivationNotices', () => {
  const BASE = 'Desactivar este instructor le impedirá iniciar sesión y recibir clases nuevas.';

  it('sin clases futuras ni vehículo → solo el aviso base', () => {
    expect(instructorDeactivationNotices(0, null)).toEqual([BASE]);
  });

  it('con clases futuras → cuántas y que hay que reasignarlas (singular/plural)', () => {
    expect(instructorDeactivationNotices(1, null)).toEqual([
      BASE,
      'Tiene 1 clase agendada a futuro: quedará con un instructor inactivo. Reasígnala desde la Agenda.',
    ]);
    expect(instructorDeactivationNotices(3, null)[1]).toBe(
      'Tiene 3 clases agendadas a futuro: quedarán con un instructor inactivo. Reasígnalas desde la Agenda.',
    );
  });

  it('con vehículo asignado → sugiere quitarlo', () => {
    expect(instructorDeactivationNotices(0, 'ABCD12')).toEqual([
      BASE,
      'Su vehículo ABCD12 sigue asignado: quítalo arriba si quieres que otro instructor lo use.',
    ]);
  });

  it('conteo aún no cargado (null) → no inventa el aviso de clases', () => {
    expect(instructorDeactivationNotices(null, null)).toEqual([BASE]);
  });
});
