import { describe, expect, it } from 'vitest';
import {
  instructorBranchChangeNotice,
  instructorDeactivationNotices,
} from './instructor-deactivation.utils';

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

// hotfix-070-b (E13 de ASG-i-034): cambiar de sede, igual que desactivar, solo avisa.
describe('instructorBranchChangeNotice', () => {
  it('cambió de sede, no quedó en "Ambas" y tiene clases → avisa con el conteo', () => {
    expect(instructorBranchChangeNotice(3, true, false)).toBe(
      'Tiene 3 clases agendadas a futuro en su sede actual: no se mueven al cambiarlo de sede. Revísalas en la Agenda.',
    );
    expect(instructorBranchChangeNotice(1, true, false)).toBe(
      'Tiene 1 clase agendada a futuro en su sede actual: no se mueve al cambiarlo de sede. Revísala en la Agenda.',
    );
  });

  it('sin cambio, quedando en "Ambas", sin clases o sin conteo → nada', () => {
    expect(instructorBranchChangeNotice(3, false, false)).toBeNull();
    expect(instructorBranchChangeNotice(3, true, true)).toBeNull();
    expect(instructorBranchChangeNotice(0, true, false)).toBeNull();
    expect(instructorBranchChangeNotice(null, true, false)).toBeNull();
  });
});
