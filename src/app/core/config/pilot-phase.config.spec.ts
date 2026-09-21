import { isBlockedInPilot, type PilotBlockedModule } from './pilot-phase.config';

describe('isBlockedInPilot (fix-255-m)', () => {
  it.each<PilotBlockedModule>([
    'instructor',
    'alumno',
    'inscripcion-publica',
    'clase-profesional-recorte',
  ])('%s está bloqueado durante la fase piloto', (module) => {
    expect(isBlockedInPilot(module)).toBe(true);
  });
});
