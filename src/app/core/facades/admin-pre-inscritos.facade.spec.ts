import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AdminPreInscritosFacade } from './admin-pre-inscritos.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { EpqPrintService } from '@core/services/ui/epq-print.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

type TableConfig = {
  data?: unknown;
  error?: unknown;
  single?: { data: unknown; error: unknown };
  maybeSingle?: { data: unknown; error: unknown };
};

function createMockSupabase(tables: Record<string, TableConfig>) {
  const builders = new Map<string, any>();
  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      const cfg = tables[table] ?? {};
      const listRes = { data: cfg.data ?? [], error: cfg.error ?? null };
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(cfg.single ?? listRes),
        maybeSingle: vi.fn().mockResolvedValue(cfg.maybeSingle ?? { data: null, error: null }),
        then: (resolve: any, reject: any) => Promise.resolve(listRes).then(resolve, reject),
      };
      builders.set(table, builder);
    }
    return builders.get(table);
  });
  return {
    client: {
      from,
      rpc: vi.fn().mockResolvedValue({ data: 'A4-0042', error: null }),
      functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
      storage: {
        from: vi.fn().mockReturnValue({ upload: vi.fn().mockResolvedValue({ error: null }) }),
      },
    },
    _builders: builders,
  };
}

function setup(tables: Record<string, TableConfig> = {}) {
  const mockSupabase = createMockSupabase(tables);
  const mockEpq = { printTest: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: mockSupabase },
      {
        provide: AuthFacade,
        useValue: {
          currentUser: vi.fn(() => ({
            role: 'admin',
            dbId: 9,
            branchId: 1,
            canAccessBothBranches: false,
          })),
        },
      },
      { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
      { provide: EpqPrintService, useValue: mockEpq },
      { provide: ErrorSanitizerService, useValue: { sanitize: vi.fn((e: Error) => e) } },
    ],
  });
  return { facade: TestBed.inject(AdminPreInscritosFacade), mockSupabase, mockEpq };
}

function rawPreInscrito(overrides: Record<string, unknown> = {}) {
  const in3Days = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  return {
    id: 1,
    temp_user_id: 50,
    status: 'pending_review',
    registration_channel: 'online',
    convalidates_simultaneously: false,
    registered_at: '2026-07-01T10:00:00Z',
    expires_at: in3Days,
    requested_license_class: 'A4',
    desired_course_class: null,
    branch_id: 1,
    psych_test_result: null,
    psych_test_answers: null,
    psych_evaluated_at: null,
    psych_rejection_reason: null,
    converted_enrollment_id: null,
    notes: null,
    birth_date: '1990-05-01',
    gender: 'M',
    address: 'Calle 1',
    users: {
      id: 50,
      rut: '12345678-5',
      first_names: 'Pedro',
      paternal_last_name: 'Pérez',
      maternal_last_name: 'Soto',
      email: 'p@x.cl',
      phone: null,
      branch_id: 1,
      branches: { id: 1, name: 'Centro' },
    },
    evaluator: null,
    enrollment: null,
    ...overrides,
  };
}

describe('AdminPreInscritosFacade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('mapeo de filas', () => {
    it('calcula días para vencer (futuro) y marca vencidos (pasado) con días null', async () => {
      const ayer = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { facade } = setup({
        professional_pre_registrations: {
          data: [rawPreInscrito({ id: 1 }), rawPreInscrito({ id: 2, expires_at: ayer })],
        },
      });
      await facade.initialize();
      const [vigente, vencido] = facade.preInscritos();
      expect(vigente.isVencido).toBe(false);
      expect(vigente.diasParaVencer).toBe(3);
      expect(vencido.isVencido).toBe(true);
      expect(vencido.diasParaVencer).toBeNull();
    });

    it('licencia: requested → desired → "—" y labels de estado/test', async () => {
      const { facade } = setup({
        professional_pre_registrations: {
          data: [
            rawPreInscrito({ id: 1, requested_license_class: null, desired_course_class: 'A2' }),
            rawPreInscrito({
              id: 2,
              requested_license_class: null,
              desired_course_class: null,
              status: 'approved',
              psych_test_result: 'fit',
              evaluator: { first_names: 'Eva', paternal_last_name: 'Luna' },
            }),
          ],
        },
      });
      await facade.initialize();
      const [a, b] = facade.preInscritos();
      expect(a.licencia).toBe('A2');
      expect(a.statusLabel).toBe('Pendiente revisión');
      expect(a.psychResultLabel).toBe('Sin evaluar');
      expect(b.licencia).toBe('—');
      expect(b.statusLabel).toBe('Aprobado');
      expect(b.psychResultLabel).toBe('Apto');
      expect(b.psychEvaluatedByName).toBe('Eva Luna');
    });

    it('KPIs: total, pendientes de test (sin resultado) y aprobados', async () => {
      const { facade } = setup({
        professional_pre_registrations: {
          data: [
            rawPreInscrito({ id: 1 }),
            rawPreInscrito({ id: 2, psych_test_result: 'fit', status: 'approved' }),
            rawPreInscrito({ id: 3, psych_test_result: 'unfit', status: 'rejected' }),
          ],
        },
      });
      await facade.initialize();
      expect(facade.total()).toBe(3);
      expect(facade.pendientesTest()).toBe(1);
      expect(facade.aprobados()).toBe(1);
    });
  });

  describe('evaluarTest', () => {
    it('fit → status approved con evaluador y timestamp; actualiza el selected', async () => {
      const { facade, mockSupabase } = setup({
        professional_pre_registrations: { data: [rawPreInscrito({ id: 1 })] },
      });
      await facade.initialize();
      const ok = await facade.evaluarTest({ preInscritoId: 1, result: 'fit' } as any);
      expect(ok).toBe(true);
      const updateMock = mockSupabase._builders.get('professional_pre_registrations').update;
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          psych_test_result: 'fit',
          status: 'approved',
          psych_evaluated_by: 9,
        }),
      );
      expect(facade.selected()?.id).toBe(1);
      expect(facade.isSaving()).toBe(false);
    });

    it('unfit → status rejected con razón de rechazo', async () => {
      const { facade, mockSupabase } = setup({
        professional_pre_registrations: { data: [rawPreInscrito({ id: 1 })] },
      });
      await facade.initialize();
      await facade.evaluarTest({
        preInscritoId: 1,
        result: 'unfit',
        rejectionReason: 'No apto psicológico',
      } as any);
      const updateMock = mockSupabase._builders.get('professional_pre_registrations').update;
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          psych_rejection_reason: 'No apto psicológico',
        }),
      );
    });
  });

  describe('completarMatricula — reglas de pago', () => {
    function matriculaTables(): Record<string, TableConfig> {
      return {
        professional_pre_registrations: { data: [rawPreInscrito({ id: 1 })] },
        students: {
          maybeSingle: { data: { id: 70 }, error: null }, // student ya existe
        },
        roles: { single: { data: { id: 4 }, error: null } },
        enrollments: { single: { data: { id: 500 }, error: null } },
      };
    }

    const basePayload = {
      preInscritoId: 1,
      courseId: 3,
      promotionCourseId: 8,
      basePrice: 100000,
      discountAmount: 10000,
      currentLicenseClass: 'B',
      licenseObtainedDate: '2020-01-01',
    };

    it('pago total → payment_status paid y pending_balance 0', async () => {
      const { facade, mockSupabase } = setup(matriculaTables());
      await facade.initialize();
      const res = await facade.completarMatricula({
        ...basePayload,
        totalPaid: 90000,
        paymentMethod: 'efectivo',
      } as any);
      expect(res).toEqual({ enrollmentId: 500, enrollmentNumber: 'A4-0042' });
      const insertMock = mockSupabase._builders.get('enrollments').insert;
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_status: 'paid',
          pending_balance: 0,
          registration_channel: 'in_person',
          registered_by: 9,
        }),
      );
    });

    it('abono parcial → partial con saldo pendiente; método "pendiente" → pending', async () => {
      const { facade, mockSupabase } = setup(matriculaTables());
      await facade.initialize();
      await facade.completarMatricula({
        ...basePayload,
        totalPaid: 40000,
        paymentMethod: 'efectivo',
      } as any);
      const insertMock = mockSupabase._builders.get('enrollments').insert;
      expect(insertMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ payment_status: 'partial', pending_balance: 50000 }),
      );

      await facade.completarMatricula({
        ...basePayload,
        totalPaid: 0,
        paymentMethod: 'pendiente',
      } as any);
      expect(insertMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ payment_status: 'pending', pending_balance: 90000 }),
      );
    });

    it('pre-inscrito inexistente → null con error, sin tocar la BD', async () => {
      const { facade, mockSupabase } = setup(matriculaTables());
      await facade.initialize();
      const res = await facade.completarMatricula({ ...basePayload, preInscritoId: 999 } as any);
      expect(res).toBeNull();
      expect(facade.error()).toBe('Pre-inscrito no encontrado');
      expect(mockSupabase.client.from).not.toHaveBeenCalledWith('enrollments');
    });
  });

  describe('promociones para licencia', () => {
    it('filtra cursos por clase de licencia, calcula cupos y descarta promos sin match', async () => {
      const { facade } = setup({
        professional_promotions: {
          data: [
            {
              id: 1,
              code: 'P1',
              name: 'Con A4',
              start_date: '2026-08-01',
              end_date: '2026-12-01',
              status: 'planned',
              promotion_courses: [
                {
                  id: 11,
                  course_id: 3,
                  max_students: 30,
                  courses: {
                    id: 3,
                    name: 'Camión',
                    code: 'A4',
                    license_class: 'A4',
                    base_price: 500,
                  },
                  enrollments: [{ id: 1 }, { id: 2 }],
                },
                {
                  id: 12,
                  course_id: 4,
                  max_students: 20,
                  courses: { id: 4, name: 'Bus', code: 'A2', license_class: 'A2', base_price: 400 },
                  enrollments: [],
                },
              ],
            },
            {
              id: 2,
              code: 'P2',
              name: 'Sin A4',
              start_date: '2026-09-01',
              end_date: '2026-12-01',
              status: 'planned',
              promotion_courses: [],
            },
          ],
        },
      });
      await facade.cargarPromocionesParaLicencia('A4');
      const promos = facade.promociones();
      expect(promos).toHaveLength(1); // P2 descartada (sin cursos A4)
      expect(promos[0].courses).toHaveLength(1); // el curso A2 se filtra
      expect(promos[0].courses[0].available).toBe(28); // 30 - 2 inscritos
    });

    it('es lazy: la segunda llamada no re-consulta hasta resetPromocionesCache()', async () => {
      const { facade, mockSupabase } = setup({ professional_promotions: { data: [] } });
      await facade.cargarPromocionesParaLicencia('A4');
      await facade.cargarPromocionesParaLicencia('A4');
      const calls = () =>
        mockSupabase.client.from.mock.calls.filter((c: any[]) => c[0] === 'professional_promotions')
          .length;
      expect(calls()).toBe(1);
      facade.resetPromocionesCache();
      await facade.cargarPromocionesParaLicencia('A4');
      expect(calls()).toBe(2);
    });
  });

  it('printBlankTest delega en EpqPrintService con los datos del pre-inscrito', () => {
    const { facade, mockEpq } = setup();
    facade.printBlankTest({ nombreCompleto: 'Pedro Pérez', rut: '1-9', licencia: 'A4' } as any);
    expect(mockEpq.printTest).toHaveBeenCalledWith({
      studentName: 'Pedro Pérez',
      rut: '1-9',
      licencia: 'A4',
    });
  });
});
