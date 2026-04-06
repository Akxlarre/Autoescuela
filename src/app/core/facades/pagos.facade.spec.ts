import { TestBed } from '@angular/core/testing';
import { PagosFacade } from './pagos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('PagosFacade', () => {
  let facade: PagosFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
             gte: jasmine.createSpy('gte').and.returnValue({
               lte: jasmine.createSpy('lte').and.resolveTo({ data: [], error: null })
             }),
             resolveTo: jasmine.createSpy('resolveTo').and.resolveTo({ data: [], error: null }),
             maybeSingle: jasmine.createSpy('maybeSingle').and.resolveTo({ data: null, error: null }),
             order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          }),
          gt: jasmine.createSpy('gt').and.returnValue({
             neq: jasmine.createSpy('neq').and.resolveTo({ data: [], error: null })
          }),
          order: jasmine.createSpy('order').and.returnValue({
             limit: jasmine.createSpy('limit').and.resolveTo({ data: [], error: null })
          }),
          gte: jasmine.createSpy('gte').and.returnValue({
             lte: jasmine.createSpy('lte').and.resolveTo({ data: [], error: null })
          })
        }),
        insert: jasmine.createSpy('insert').and.resolveTo({ error: null }),
        update: jasmine.createSpy('update').and.returnValue({
          eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
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
    expect(facade.isLoading()).toBeFalse();
    expect(facade.totalDeudores()).toBe(0);
  });

  it('seleccionarEnrollment should update signal', () => {
    facade.seleccionarEnrollment(123);
    expect(facade.enrollmentSeleccionado()).toBe(123);
  });
});
