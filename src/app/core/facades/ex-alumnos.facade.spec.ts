import { TestBed } from '@angular/core/testing';
import { ExAlumnosFacade } from './ex-alumnos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('ExAlumnosFacade', () => {
  let facade: ExAlumnosFacade;
  let supabaseSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null })
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
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalEgresados()).toBe(0);
  });
});
