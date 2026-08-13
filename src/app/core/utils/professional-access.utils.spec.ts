import {
  canAccessProfessional,
  canUnlockProfessional,
  visibleNavGroups,
} from './professional-access.utils';

describe('canAccessProfessional (fix-028)', () => {
  // branch 1 = sin profesional · branch 2 = con profesional
  const branches = [
    { id: 1, hasProfessional: false },
    { id: 2, hasProfessional: true },
  ];

  describe('admin', () => {
    it('"Todas las sedes" (selector null) → accesible (ve todo)', () => {
      expect(canAccessProfessional('admin', null, null, branches)).toBe(true);
    });

    it('sede sin profesional seleccionada → NO accesible', () => {
      expect(canAccessProfessional('admin', null, 1, branches)).toBe(false);
    });

    it('sede con profesional seleccionada → accesible', () => {
      expect(canAccessProfessional('admin', null, 2, branches)).toBe(true);
    });
  });

  describe('secretaria sin grant (anclada a su sede)', () => {
    it('sede base sin profesional → NO accesible (ignora el selector)', () => {
      expect(canAccessProfessional('secretaria', 1, 2, branches, false)).toBe(false);
    });

    it('sede base con profesional → accesible', () => {
      expect(canAccessProfessional('secretaria', 2, null, branches, false)).toBe(true);
    });

    it('sin sede asignada (misconfig) → NO accesible', () => {
      expect(canAccessProfessional('secretaria', null, null, branches, false)).toBe(false);
    });
  });

  describe('secretaria CON grant (se comporta como admin)', () => {
    it('selecciona sede con profesional → accesible (aunque su base no lo tenga)', () => {
      expect(canAccessProfessional('secretaria', 1, 2, branches, true)).toBe(true);
    });

    it('selecciona sede sin profesional → NO accesible', () => {
      expect(canAccessProfessional('secretaria', 2, 1, branches, true)).toBe(false);
    });

    it('"Todas las sedes" (selector null) → accesible', () => {
      expect(canAccessProfessional('secretaria', 1, null, branches, true)).toBe(true);
    });
  });

  it('sede inexistente en la lista → NO accesible (fallback seguro)', () => {
    expect(canAccessProfessional('admin', null, 99, branches)).toBe(false);
  });
});

describe('canUnlockProfessional (fix-156)', () => {
  it('admin siempre puede desbloquear', () => {
    expect(canUnlockProfessional('admin')).toBe(true);
    expect(canUnlockProfessional('admin', false)).toBe(true);
  });

  it('secretaria con grant puede desbloquear', () => {
    expect(canUnlockProfessional('secretaria', true)).toBe(true);
  });

  it('secretaria sin grant NO puede desbloquear', () => {
    expect(canUnlockProfessional('secretaria', false)).toBe(false);
    expect(canUnlockProfessional('secretaria')).toBe(false);
  });

  it('instructor/alumno nunca pueden desbloquear', () => {
    expect(canUnlockProfessional('instructor', true)).toBe(false);
    expect(canUnlockProfessional('alumno', true)).toBe(false);
  });
});

describe('visibleNavGroups (fix-156)', () => {
  const groups = [
    { group: 'Academia Clase B', items: [] },
    { group: 'Academia Profesional', items: [] },
    { group: 'Finanzas y Caja', items: [] },
  ];

  it('secretaria sin grant en sede sin profesional → oculta el grupo (AC-1)', () => {
    const result = visibleNavGroups(groups, false, false);
    expect(result.map((g) => g.group)).toEqual(['Academia Clase B', 'Finanzas y Caja']);
  });

  it('admin sin sede profesional seleccionada → conserva el grupo bloqueable (AC-2)', () => {
    const result = visibleNavGroups(groups, false, true);
    expect(result.map((g) => g.group)).toContain('Academia Profesional');
  });

  it('secretaria con grant sin sede profesional seleccionada → conserva el grupo (AC-2)', () => {
    const result = visibleNavGroups(groups, false, true);
    expect(result.map((g) => g.group)).toContain('Academia Profesional');
  });

  it('secretaria sin grant en sede CON profesional → conserva el grupo desbloqueado (AC-3)', () => {
    const result = visibleNavGroups(groups, true, false);
    expect(result.map((g) => g.group)).toContain('Academia Profesional');
  });
});
