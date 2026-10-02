import { describe, it, expect } from 'vitest';
import { buildAlumnosHeroActions } from './alumnos-hero-actions.utils';

describe('buildAlumnosHeroActions() — hotfix-119-m', () => {
  it('en la lista normal ofrece Papelera y Nueva Matrícula (única acción primaria)', () => {
    const actions = buildAlumnosHeroActions(false);

    expect(actions.map((a) => a.id)).toEqual(['papelera', 'nueva-matricula']);
    expect(actions.filter((a) => a.primary).map((a) => a.id)).toEqual(['nueva-matricula']);
    expect(actions[0].danger).toBe(false);
  });

  it('dentro de la Papelera no ofrece Nueva Matrícula: ahí solo se restaura', () => {
    const actions = buildAlumnosHeroActions(true);

    expect(actions.map((a) => a.id)).toEqual(['papelera']);
    expect(actions[0].danger).toBe(true);
  });
});
