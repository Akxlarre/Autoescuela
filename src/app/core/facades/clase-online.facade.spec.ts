import { TestBed } from '@angular/core/testing';
import { ClaseOnlineFacade } from './clase-online.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('ClaseOnlineFacade', () => {
  let facade: ClaseOnlineFacade;
  let supabaseSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          }),
          eq: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        insert: vi.fn().mockResolvedValue({ error: null })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        ClaseOnlineFacade,
        { provide: SupabaseService, useValue: supabaseSpy }
      ]
    });

    facade = TestBed.inject(ClaseOnlineFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.sesionHoy()).toBeNull();
    expect(facade.alumnos()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.savedOk()).toBe(false);
  });

  it('resetSavedOk should reset savedOk signal', () => {
    (facade as any)._savedOk.set(true);
    facade.resetSavedOk();
    expect(facade.savedOk()).toBe(false);
  });
});
