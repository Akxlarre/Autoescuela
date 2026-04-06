import { TestBed } from '@angular/core/testing';
import { PromocionesFacade } from './promociones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('PromocionesFacade', () => {
  let facade: PromocionesFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          in: vi.fn().mockReturnValue({
             not: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          eq: vi.fn().mockReturnValue({
             eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null })
             }),
             order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
             single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });

    facade = TestBed.inject(PromocionesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.promociones()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalPromociones()).toBe(0);
  });

  it('selectPromocion should update selectedPromocion signal', () => {
    const promo = { id: 1, cursos: [] } as any;
    facade.selectPromocion(promo);
    expect(facade.selectedPromocion()).toBe(promo);
  });
});
