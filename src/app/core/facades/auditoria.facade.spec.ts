import { TestBed } from '@angular/core/testing';
import { AuditoriaFacade } from './auditoria.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('AuditoriaFacade', () => {
  let facade: AuditoriaFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
            order: jasmine.createSpy('order').and.returnValue({
               range: jasmine.createSpy('range').and.resolveTo({ data: [], error: null, count: 0 })
            }),
            not: jasmine.createSpy('not').and.resolveTo({ data: [], error: null, count: 0 })
          })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        AuditoriaFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });

    facade = TestBed.inject(AuditoriaFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.logs()).toEqual([]);
    expect(facade.isLoading()).toBeFalse();
    expect(facade.currentPage()).toBe(1);
  });

  it('setPage should update currentPage signal', () => {
    facade.setPage(2);
    expect(facade.currentPage()).toBe(2);
  });

  it('clearFilters should reset filters', () => {
    facade.setFilters({ accion: 'INSERT' });
    facade.clearFilters();
    expect(facade.filters().accion).toBeNull();
  });
});
