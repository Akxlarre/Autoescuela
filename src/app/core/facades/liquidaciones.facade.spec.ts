import { TestBed } from '@angular/core/testing';
import { LiquidacionesFacade } from './liquidaciones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

describe('LiquidacionesFacade', () => {
  let facade: LiquidacionesFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let authFacadeSpy: jasmine.SpyObj<AuthFacade>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    authFacadeSpy = jasmine.createSpyObj('AuthFacade', ['currentUser']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
             gte: jasmine.createSpy('gte').and.returnValue({
               lte: jasmine.createSpy('lte').and.resolveTo({ data: [], error: null })
             }),
             resolveTo: jasmine.createSpy('resolveTo').and.resolveTo({ data: [], error: null })
          }),
          resolveTo: jasmine.createSpy('resolveTo').and.resolveTo({ data: [], error: null })
        }),
        upsert: jasmine.createSpy('upsert').and.resolveTo({ error: null }),
        delete: jasmine.createSpy('delete').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
            eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
          })
        }),
        update: jasmine.createSpy('update').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
            gte: jasmine.createSpy('gte').and.returnValue({
              lte: jasmine.createSpy('lte').and.resolveTo({ error: null })
            })
          })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        LiquidacionesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });

    facade = TestBed.inject(LiquidacionesFacade);
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
