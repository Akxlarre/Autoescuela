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
      nombre: 'X',
      rut: '1-1',
      licencia: licenseGroup === 'class_b' ? 'Clase B' : 'A4',
      licenseGroup,
      anio: 2026,
      sede: 'Sede',
      nroCertificado: null,
      saldoPendiente: 0,
    });
    (facade as any)._egresados.set([mk(1, 'class_b'), mk(2, 'professional'), mk(3, 'class_b')]);

    expect(facade.egresadosClaseBList().map((e) => e.id)).toEqual([1, 3]);
    expect(facade.egresadosProfesionalList().map((e) => e.id)).toEqual([2]);
    expect(facade.egresadosClaseB()).toBe(2);
    expect(facade.egresadosProfesional()).toBe(1);
  });
});
