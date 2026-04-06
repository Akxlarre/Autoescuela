import { TestBed } from '@angular/core/testing';
import { ClaseOnlineFacade } from './clase-online.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('ClaseOnlineFacade', () => {
  let facade: ClaseOnlineFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          gte: jasmine.createSpy('gte').and.returnValue({
            order: jasmine.createSpy('order').and.returnValue({
              limit: jasmine.createSpy('limit').and.returnValue({
                maybeSingle: jasmine.createSpy('maybeSingle').and.resolveTo({ data: null, error: null })
              })
            })
          }),
          eq: jasmine.createSpy('eq').and.resolveTo({ data: [], error: null })
        }),
        update: jasmine.createSpy('update').and.returnValue({
          eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
        }),
        delete: jasmine.createSpy('delete').and.returnValue({
          eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
        }),
        insert: jasmine.createSpy('insert').and.resolveTo({ error: null })
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
    expect(facade.isLoading()).toBeFalse();
    expect(facade.savedOk()).toBeFalse();
  });

  it('resetSavedOk should reset savedOk signal', () => {
    (facade as any)._savedOk.set(true);
    facade.resetSavedOk();
    expect(facade.savedOk()).toBeFalse();
  });
});
