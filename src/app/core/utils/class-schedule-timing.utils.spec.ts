import { isClassStartOverdue } from './class-schedule-timing.utils';

describe('isClassStartOverdue', () => {
  const now = new Date('2026-08-14T15:30:00-04:00');

  it('detecta clases agendadas cuya hora de inicio ya pasó', () => {
    expect(isClassStartOverdue('2026-08-14T15:00:00-04:00', 'scheduled', now)).toBe(true);
  });

  it('no marca como atrasada una clase agendada que todavía no llega a su hora', () => {
    expect(isClassStartOverdue('2026-08-14T16:00:00-04:00', 'scheduled', now)).toBe(false);
  });

  it('no marca como atrasada una clase que ya está en curso', () => {
    expect(isClassStartOverdue('2026-08-14T15:00:00-04:00', 'in_progress', now)).toBe(false);
  });

  it('no marca como atrasada una clase completada', () => {
    expect(isClassStartOverdue('2026-08-14T15:00:00-04:00', 'completed', now)).toBe(false);
  });

  it('retorna false si no hay scheduledAt', () => {
    expect(isClassStartOverdue(null, 'scheduled', now)).toBe(false);
  });
});
