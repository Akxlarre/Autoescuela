import { TestBed } from '@angular/core/testing';
import { RelatoresFacade } from './relatores.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('RelatoresFacade', () => {
  let facade: RelatoresFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          in: vi.fn().mockReturnValue({
             not: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          eq: vi.fn().mockReturnValue({
             order: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        RelatoresFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });

    facade = TestBed.inject(RelatoresFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.relatores()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalRelatores()).toBe(0);
  });

  it('selectRelator should update selectedRelator signal', () => {
    const relator = { id: 1 } as any;
    facade.selectRelator(relator);
    expect(facade.selectedRelator()).toBe(relator);
  });
});
