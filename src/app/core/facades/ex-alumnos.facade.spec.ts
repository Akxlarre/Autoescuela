import { TestBed } from '@angular/core/testing';
import { ExAlumnosFacade } from './ex-alumnos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('ExAlumnosFacade', () => {
  let facade: ExAlumnosFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
            order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        ExAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseSpy }
      ]
    });

    facade = TestBed.inject(ExAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.egresados()).toEqual([]);
    expect(facade.isLoading()).toBeFalse();
    expect(facade.totalEgresados()).toBe(0);
  });
});
