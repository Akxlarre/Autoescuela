import { TestBed } from '@angular/core/testing';
import { ExAlumnosFacade } from './ex-alumnos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('ExAlumnosFacade', () => {
  let facade: ExAlumnosFacade;
  let supabaseSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        ExAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });

    facade = TestBed.inject(ExAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.egresados()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalEgresados()).toBe(0);
  });

  it('separa egresados por grupo de licencia (AC11)', () => {
    const mk = (id: number, licenseGroup: 'class_b' | 'professional') => ({
      id,
      studentId: String(id),
      nombre: 'X',
      rut: '1-1',
      correo: 'x@x.cl',
      nroExpediente: null,
      licencia: licenseGroup === 'class_b' ? 'Clase B' : 'A4',
      licenseGroup,
      anio: 2026,
      sede: 'Sede',
      branchId: 1,
      nroCertificado: null,
      saldoPendiente: 0,
    });
    (facade as any)._egresados.set([mk(1, 'class_b'), mk(2, 'professional'), mk(3, 'class_b')]);

    expect(facade.egresadosClaseBList().map((e) => e.id)).toEqual([1, 3]);
    expect(facade.egresadosProfesionalList().map((e) => e.id)).toEqual([2]);
    expect(facade.egresadosClaseB()).toBe(2);
    expect(facade.egresadosProfesional()).toBe(1);
  });

  it('mapea studentId, correo y nroExpediente desde la query (AC-1)', async () => {
    const row = {
      id: 99,
      number: 'EXP-123',
      pending_balance: 0,
      updated_at: '2026-01-15T00:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 7, name: 'Sede Central' },
      students: {
        id: 42,
        users: {
          first_names: 'Ana',
          paternal_last_name: 'Soto',
          maternal_last_name: null,
          rut: '11.111.111-1',
          email: 'ana@correo.cl',
        },
      },
    };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [row], error: null }),
          }),
        }),
      }),
    };

    await facade.loadEgresados();

    const egresado = facade.egresadosClaseBList()[0];
    expect(egresado.studentId).toBe('42');
    expect(egresado.correo).toBe('ana@correo.cl');
    expect(egresado.nroExpediente).toBe('EXP-123');
  });

  it('mapea branchId desde branches.id (fix-085-m)', async () => {
    const row = {
      id: 100,
      number: 'EXP-200',
      pending_balance: 0,
      updated_at: '2026-01-15T00:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 3, name: 'Sede Norte' },
      students: {
        id: 55,
        users: {
          first_names: 'Luis',
          paternal_last_name: 'Pérez',
          maternal_last_name: null,
          rut: '22.222.222-2',
          email: 'luis@correo.cl',
        },
      },
    };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [row], error: null }),
          }),
        }),
      }),
    };

    await facade.loadEgresados();

    const egresado = facade.egresadosClaseBList()[0];
    expect(egresado.branchId).toBe(3);
  });

  describe('loadStatistics — annualEgresadosTotal (fix-005-i, H-003)', () => {
    /** Builder Supabase encadenable: soporta select/eq/gte y es awaitable (thenable). */
    function makeChainMock(result: { data?: any; count?: number; error: any }) {
      const b: any = {
        select: vi.fn(() => b),
        eq: vi.fn(() => b),
        gte: vi.fn(() => b),
        then: (resolve: any) => resolve(result),
      };
      return b;
    }

    it('filtra por license_group=class_b y por sede activa — mismo criterio que loadEgresadosList (antes: 2 vs 16)', async () => {
      const examsChain = makeChainMock({ data: [], error: null });
      const enrollmentsChain = makeChainMock({ count: 2, error: null });
      const surveysChain = makeChainMock({ count: 0, error: null });

      (supabaseSpy as any).client = {
        from: vi.fn((table: string) => {
          if (table === 'class_b_exam_scores') return examsChain;
          if (table === 'enrollments') return enrollmentsChain;
          if (table === 'student_surveys') return surveysChain;
          throw new Error(`tabla inesperada: ${table}`);
        }),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ExAlumnosFacade,
          { provide: SupabaseService, useValue: supabaseSpy },
          { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
          { provide: BranchFacade, useValue: { selectedBranchId: () => 7 } },
          {
            provide: ErrorSanitizerService,
            useValue: { sanitize: (e: Error) => ({ message: e.message }) },
          },
        ],
      });
      const scopedFacade = TestBed.inject(ExAlumnosFacade);

      await (scopedFacade as any).loadStatistics();

      expect(enrollmentsChain.eq).toHaveBeenCalledWith('status', 'completed');
      expect(enrollmentsChain.eq).toHaveBeenCalledWith('license_group', 'class_b');
      expect(enrollmentsChain.eq).toHaveBeenCalledWith('branch_id', 7);
      expect(scopedFacade.annualEgresadosTotal()).toBe(2);
    });
  });
});
