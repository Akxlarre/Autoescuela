import { TestBed } from '@angular/core/testing';
import { HistorialCuadraturasFacade } from './historial-cuadraturas.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

describe('HistorialCuadraturasFacade', () => {
  let facade: HistorialCuadraturasFacade;
  let supabaseSpy: any;
  let authFacadeSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    authFacadeSpy = { currentUser: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
             gte: vi.fn().mockReturnValue({
               lte: vi.fn().mockReturnValue({
                 order: vi.fn().mockResolvedValue({ data: [], error: null })
               })
             })
          })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        HistorialCuadraturasFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });

    facade = TestBed.inject(HistorialCuadraturasFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial month and year', () => {
    const now = new Date();
    expect(facade.mesActual()).toBe(now.getMonth() + 1);
    expect(facade.anioActual()).toBe(now.getFullYear());
  });

  it('mesAnterior should decrement mesActual', () => {
    const initialMes = facade.mesActual();
    facade.mesAnterior();
    if (initialMes === 1) {
      expect(facade.mesActual()).toBe(12);
    } else {
      expect(facade.mesActual()).toBe(initialMes - 1);
    }
  });

  it('mesSiguiente should increment mesActual', () => {
    const initialMes = facade.mesActual();
    facade.mesSiguiente();
    if (initialMes === 12) {
      expect(facade.mesActual()).toBe(1);
    } else {
      expect(facade.mesActual()).toBe(initialMes + 1);
    }
  });
});
