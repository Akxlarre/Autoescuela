import { TestBed } from '@angular/core/testing';
import { RelatoresFacade } from './relatores.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('RelatoresFacade', () => {
  let facade: RelatoresFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null }),
          in: jasmine.createSpy('in').and.returnValue({
             not: jasmine.createSpy('not').and.resolveTo({ data: [], error: null })
          }),
          eq: jasmine.createSpy('eq').and.returnValue({
             order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
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
    expect(facade.isLoading()).toBeFalse();
    expect(facade.totalRelatores()).toBe(0);
  });

  it('selectRelator should update selectedRelator signal', () => {
    const relator = { id: 1 } as any;
    facade.selectRelator(relator);
    expect(facade.selectedRelator()).toBe(relator);
  });
});
