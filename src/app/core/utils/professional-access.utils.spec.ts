import { canAccessProfessional } from './professional-access.utils';

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
