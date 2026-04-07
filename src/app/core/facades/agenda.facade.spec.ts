import { TestBed } from '@angular/core/testing';
import { AgendaFacade } from './agenda.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';

describe('AgendaFacade', () => {
  let facade: AgendaFacade;
  let supabaseSpy: any;
  let authFacadeSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn(), removeChannel: vi.fn() };
    authFacadeSpy = { currentUser: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
             gte: vi.fn().mockReturnValue({
               lt: vi.fn().mockReturnValue({
                 order: vi.fn().mockResolvedValue({ data: [], error: null }),
                 neq: vi.fn().mockResolvedValue({ data: [], error: null })
               })
             })
          }),
          neq: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        channel: vi.fn().mockReturnValue({
          on: vi.fn().mockReturnValue({
            subscribe: vi.fn().mockReturnValue({})
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
    expect(facade.isLoading()).toBe(false);
    expect(facade.weekData()).toBeNull();
    expect(facade.isCurrentWeek()).toBe(true);
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
