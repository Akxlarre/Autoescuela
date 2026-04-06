import { TestBed } from '@angular/core/testing';
import { PagosFacade } from './pagos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('PagosFacade', () => {
  let facade: PagosFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
             gte: vi.fn().mockReturnValue({
               lte: vi.fn().mockResolvedValue({ data: [], error: null })
             }),
             resolveTo: vi.fn().mockResolvedValue({ data: [], error: null }),
             maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
             order: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          gt: vi.fn().mockReturnValue({
             neq: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          order: vi.fn().mockReturnValue({
             limit: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          gte: vi.fn().mockReturnValue({
             lte: vi.fn().mockResolvedValue({ data: [], error: null })
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
        PagosFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });

    facade = TestBed.inject(PagosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.ingresosHoy()).toBe(0);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalDeudores()).toBe(0);
  });

  it('seleccionarEnrollment should update signal', () => {
    facade.seleccionarEnrollment(123);
    expect(facade.enrollmentSeleccionado()).toBe(123);
  });
});
