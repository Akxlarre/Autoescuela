import { TestBed } from '@angular/core/testing';
import { PromocionesFacade } from './promociones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('PromocionesFacade', () => {
  let facade: PromocionesFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success', 'info']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null }),
          in: jasmine.createSpy('in').and.returnValue({
             not: jasmine.createSpy('not').and.resolveTo({ data: [], error: null })
          }),
          eq: jasmine.createSpy('eq').and.returnValue({
             eq: jasmine.createSpy('eq').and.returnValue({
                order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
             }),
             order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          })
        }),
        insert: jasmine.createSpy('insert').and.returnValue({
          select: jasmine.createSpy('select').and.returnValue({
             single: jasmine.createSpy('single').and.resolveTo({ data: { id: 1 }, error: null })
          })
        }),
        update: jasmine.createSpy('update').and.returnValue({
          eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
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
    expect(facade.isLoading()).toBeFalse();
    expect(facade.totalPromociones()).toBe(0);
  });

  it('selectPromocion should update selectedPromocion signal', () => {
    const promo = { id: 1, cursos: [] } as any;
    facade.selectPromocion(promo);
    expect(facade.selectedPromocion()).toBe(promo);
  });
});
