import { canManageVehicle, canViewVehicle } from './vehicle-permissions.utils';

const ADMIN = { role: 'admin', branchId: null, canAccessBothBranches: false };
const SEC_A = { role: 'secretaria', branchId: 1, canAccessBothBranches: false };
const SEC_GRANT = { role: 'secretaria', branchId: 1, canAccessBothBranches: true };
const INSTRUCTOR = { role: 'instructor', branchId: 1, canAccessBothBranches: false };

const DE_A = { branchId: 1, bothBranches: false };
const DE_B = { branchId: 2, bothBranches: false };
const AMBAS_A = { branchId: 1, bothBranches: true };
const AMBAS_B = { branchId: 2, bothBranches: true };

describe('vehicle-permissions.utils (spec 0051-b)', () => {
  describe('canManageVehicle — crear/editar ficha, documentos y mantenimientos', () => {
    it.each([
      ['admin', ADMIN, DE_A, true],
      ['admin, "Ambas"', ADMIN, AMBAS_B, true],
      ['secretaria, vehículo de su sede', SEC_A, DE_A, true],
      ['secretaria, vehículo de la otra sede', SEC_A, DE_B, false],
      ['secretaria sin grant, "Ambas" de su sede', SEC_A, AMBAS_A, false],
      ['secretaria sin grant, "Ambas" de la otra sede', SEC_A, AMBAS_B, false],
      ['secretaria con grant, otra sede', SEC_GRANT, DE_B, true],
      ['secretaria con grant, "Ambas"', SEC_GRANT, AMBAS_B, true],
      ['instructor', INSTRUCTOR, DE_A, false],
    ] as const)('%s → %s', (_caso, user, vehicle, esperado) => {
      expect(canManageVehicle(user, vehicle)).toBe(esperado);
    });

    it('sin usuario cargado, nadie opera', () => {
      expect(canManageVehicle(null, DE_A)).toBe(false);
      expect(canManageVehicle(undefined, DE_A)).toBe(false);
    });

    it('secretaria sin sede asignada no opera ningún vehículo', () => {
      const sinSede = { role: 'secretaria', branchId: null, canAccessBothBranches: false };
      expect(canManageVehicle(sinSede, DE_A)).toBe(false);
      expect(canManageVehicle(sinSede, { branchId: null, bothBranches: false })).toBe(false);
    });
  });

  describe('canViewVehicle — aparece en su Flota', () => {
    it.each([
      ['admin', ADMIN, DE_B, true],
      ['secretaria, su sede', SEC_A, DE_A, true],
      ['secretaria, "Ambas" de la otra sede', SEC_A, AMBAS_B, true],
      ['secretaria, exclusivo de la otra sede', SEC_A, DE_B, false],
      ['secretaria con grant, otra sede', SEC_GRANT, DE_B, true],
      ['instructor', INSTRUCTOR, DE_A, false],
    ] as const)('%s → %s', (_caso, user, vehicle, esperado) => {
      expect(canViewVehicle(user, vehicle)).toBe(esperado);
    });
  });
});
