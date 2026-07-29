import { describe, it, expect } from 'vitest';
import { findSelectedPromotion, licenseWarningFn } from './assignment.component';
import type {
  EnrollmentAssignmentData,
  PromotionGroup,
} from '@core/models/ui/enrollment-assignment.model';

function buildPromotionGroups(startDate: string | null, promotionId = 1): PromotionGroup[] {
  return [
    {
      label: 'Promoción A2 – P-01',
      options: [
        {
          id: promotionId,
          label: 'A2',
          code: 'P-01',
          courseCode: 'A2',
          enrolledCount: 3,
          maxCapacity: 20,
          status: 'open',
          startDate,
        },
      ],
    },
  ];
}

function buildData(over: Partial<EnrollmentAssignmentData> = {}): EnrollmentAssignmentData {
  return {
    view: 'professional',
    studentSummary: { initials: 'JP', fullName: 'Juan Pérez', courseLabel: 'A2' },
    paymentMode: null,
    totalSessions: 0,
    instructorId: null,
    instructors: [],
    scheduleGrid: null,
    scheduleLoading: false,
    slotSelection: {
      selectedSlotIds: [],
      requiredCount: 0,
      currentCount: 0,
      maxClassesPerDay: 2,
      isComplete: true,
    },
    promotionId: null,
    promotionGroups: [],
    convalidatesSimultaneously: false,
    convalidatedLicense: null,
    licenseObtainedDate: null,
    ...over,
  };
}

describe('findSelectedPromotion()', () => {
  it('retorna null si promotionId es null', () => {
    expect(findSelectedPromotion(buildPromotionGroups('2026-08-10'), null)).toBeNull();
  });

  it('retorna null si el id no existe en ningún grupo', () => {
    expect(findSelectedPromotion(buildPromotionGroups('2026-08-10', 1), 99)).toBeNull();
  });

  it('retorna la promoción cuando el id coincide', () => {
    const groups = buildPromotionGroups('2026-08-10', 7);
    expect(findSelectedPromotion(groups, 7)?.startDate).toBe('2026-08-10');
  });
});

describe('licenseWarningFn()', () => {
  it('es null si la vista no es profesional', () => {
    expect(
      licenseWarningFn(buildData({ view: 'class-b', licenseObtainedDate: '2025-01-01' })),
    ).toBeNull();
  });

  it('es null si aún no se seleccionó una promoción', () => {
    expect(
      licenseWarningFn(
        buildData({
          promotionGroups: buildPromotionGroups('2026-08-10'),
          promotionId: null,
          licenseObtainedDate: '2025-06-10',
        }),
      ),
    ).toBeNull();
  });

  it('advierte (no bloquea) cuando la licencia tiene menos de 2 años a la fecha de inicio', () => {
    const warning = licenseWarningFn(
      buildData({
        promotionGroups: buildPromotionGroups('2026-08-10'),
        promotionId: 1,
        licenseObtainedDate: '2025-06-10',
      }),
    );
    expect(warning?.valid).toBe(false);
    expect(warning?.message).toContain('2 años');
  });

  it('no advierte cuando la licencia ya supera los 2 años a la fecha de inicio', () => {
    const warning = licenseWarningFn(
      buildData({
        promotionGroups: buildPromotionGroups('2026-08-10'),
        promotionId: 1,
        licenseObtainedDate: '2020-01-01',
      }),
    );
    expect(warning?.valid).toBe(true);
  });
});
