import { TestBed } from '@angular/core/testing';
import { AdminAlumnoDetalleFacade } from './admin-alumno-detalle.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('AdminAlumnoDetalleFacade', () => {
  let facade: AdminAlumnoDetalleFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
            single: jasmine.createSpy('single').and.resolveTo({ data: null, error: null }),
            order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          })
        }),
        update: jasmine.createSpy('update').and.returnValue({
          eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
        }),
        insert: jasmine.createSpy('insert').and.resolveTo({ error: null })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnoDetalleFacade,
        { provide: SupabaseService, useValue: supabaseSpy }
      ]
    });

    facade = TestBed.inject(AdminAlumnoDetalleFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.alumno()).toBeNull();
    expect(facade.inasistencias()).toEqual([]);
    expect(facade.clasesPracticas()).toEqual([]);
    expect(facade.isLoading()).toBeFalse();
  });

  it('porcentajePracticas should return 0 initially', () => {
    expect(facade.porcentajePracticas()).toBe(0);
  });

  it('porcentajeTeoricas should return 0 initially', () => {
    expect(facade.porcentajeTeoricas()).toBe(0);
  });
});
