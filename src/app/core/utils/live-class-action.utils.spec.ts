import { resolveLiveClassActionPlan } from './live-class-action.utils';
import { LiveClassModel } from '@core/models/ui/dashboard.model';

function buildLiveClass(overrides: Partial<LiveClassModel>): LiveClassModel {
  return {
    id: 'prac-1',
    originalId: 1,
    classNumber: 3,
    studentName: 'Julio Verstappen',
    instructorName: 'Robert Smith',
    timeLabel: '11:50 - 12:35',
    status: 'pending',
    type: 'practical',
    vehiclePlate: 'RTRE29',
    vehicleBrand: 'Nissan',
    vehicleModel: 'Versa',
    scheduledAt: '2026-07-27T11:50:00',
    studentId: 42,
    kmStart: null,
    ...overrides,
  };
}

// ─── fix-076: finalizar clase en curso desde el Dashboard ────────────────────
describe('resolveLiveClassActionPlan (fix-076)', () => {
  it('clase practical pending → flow "iniciar" con status "pendiente"', () => {
    const plan = resolveLiveClassActionPlan(buildLiveClass({ status: 'pending' }));

    expect(plan.flow).toBe('iniciar');
    expect(plan).toEqual(
      expect.objectContaining({
        flow: 'iniciar',
        row: expect.objectContaining({ id: 1, status: 'pendiente' }),
      }),
    );
  });

  it('clase practical in_progress → flow "finalizar" con studentId y kmStart', () => {
    const plan = resolveLiveClassActionPlan(
      buildLiveClass({ status: 'in_progress', studentId: 42, kmStart: 12000 }),
    );

    expect(plan.flow).toBe('finalizar');
    expect(plan).toEqual(
      expect.objectContaining({
        flow: 'finalizar',
        row: expect.objectContaining({
          id: 1,
          status: 'en_curso',
          studentId: 42,
          kmStart: 12000,
        }),
      }),
    );
  });

  it('clase practical completed → flow "informativo"', () => {
    const plan = resolveLiveClassActionPlan(buildLiveClass({ status: 'completed' }));

    expect(plan.flow).toBe('informativo');
  });

  it('clase theoretical in_progress → flow "informativo" (no es practical)', () => {
    const plan = resolveLiveClassActionPlan(
      buildLiveClass({ status: 'in_progress', type: 'theoretical' }),
    );

    expect(plan.flow).toBe('informativo');
  });
});

// ─── fix-133-m: propagar vehicleId/vehicleCurrentKm/branchId desde el Dashboard ──
describe('resolveLiveClassActionPlan propaga vehicleId, vehicleCurrentKm y branchId en el row de iniciar/finalizar (fix-133-m)', () => {
  it('flow "iniciar" incluye vehicleId, vehicleCurrentKm y branchId de la clase', () => {
    const plan = resolveLiveClassActionPlan(
      buildLiveClass({ status: 'pending', vehicleId: 6, vehicleCurrentKm: 6543, branchId: 2 }),
    );

    expect(plan).toEqual(
      expect.objectContaining({
        flow: 'iniciar',
        row: expect.objectContaining({ vehicleId: 6, vehicleCurrentKm: 6543, branchId: 2 }),
      }),
    );
  });

  it('flow "finalizar" incluye vehicleId, vehicleCurrentKm y branchId de la clase', () => {
    const plan = resolveLiveClassActionPlan(
      buildLiveClass({
        status: 'in_progress',
        vehicleId: 6,
        vehicleCurrentKm: 6543,
        branchId: 2,
      }),
    );

    expect(plan).toEqual(
      expect.objectContaining({
        flow: 'finalizar',
        row: expect.objectContaining({ vehicleId: 6, vehicleCurrentKm: 6543, branchId: 2 }),
      }),
    );
  });
});
