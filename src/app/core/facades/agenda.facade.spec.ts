import { TestBed } from '@angular/core/testing';
import { AgendaFacade } from './agenda.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';

describe('AgendaFacade', () => {
  let facade: AgendaFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let authFacadeSpy: jasmine.SpyObj<AuthFacade>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client', 'removeChannel']);
    authFacadeSpy = jasmine.createSpyObj('AuthFacade', ['currentUser']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
             gte: jasmine.createSpy('gte').and.returnValue({
               lt: jasmine.createSpy('lt').and.returnValue({
                 order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null }),
                 neq: jasmine.createSpy('neq').and.resolveTo({ data: [], error: null })
               })
             })
          }),
          neq: jasmine.createSpy('neq').and.resolveTo({ data: [], error: null })
        }),
        channel: jasmine.createSpy('channel').and.returnValue({
          on: jasmine.createSpy('on').and.returnValue({
            subscribe: jasmine.createSpy('subscribe').and.returnValue({})
          })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        AgendaFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy }
      ]
    });

    facade = TestBed.inject(AgendaFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(facade.isLoading()).toBeFalse();
    expect(facade.weekData()).toBeNull();
    expect(facade.isCurrentWeek()).toBeTrue();
  });

  it('nextWeek and prevWeek should change weekStart', () => {
    const initial = facade.weekStart();
    facade.goToNextWeek();
    expect(facade.weekStart()).not.toBe(initial);
    facade.goToPrevWeek();
    expect(facade.weekStart()).toBe(initial);
  });

  it('setSelectedSlot should update selectedSlot signal', () => {
    const slot = { id: 'test' } as any;
    facade.setSelectedSlot(slot);
    expect(facade.selectedSlot()).toBe(slot);
  });
});
