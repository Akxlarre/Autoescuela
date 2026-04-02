import { TestBed } from '@angular/core/testing';
import { InstructorHorasFacade } from './instructor-horas.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('InstructorHorasFacade', () => {
  let facade: InstructorHorasFacade;
  let supabaseMock: any;
  let profileMock: any;

  function createChainMock(resolvedValue: any = { data: [], error: null }) {
    const chain: any = {};
    const methods = ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'maybeSingle'];
    for (const m of methods) {
      chain[m] = (window as any).vi.fn().mockReturnValue(chain);
    }
    // Terminal: last call resolves
    chain.order = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    chain.lte = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    return chain;
  }

  beforeEach(() => {
    const chain = createChainMock();
    supabaseMock = {
      client: {
        from: (window as any).vi.fn().mockReturnValue(chain),
      },
    };

    profileMock = {
      getInstructorId: (window as any).vi.fn().mockResolvedValue(1),
      instructorId: (window as any).vi.fn().mockReturnValue(1),
    };

    TestBed.configureTestingModule({
      providers: [
        InstructorHorasFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
      ],
    });

    facade = TestBed.inject(InstructorHorasFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with default state', () => {
    expect(facade.monthlyHours()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.liquidacionKpis().anticiposMes).toBe(0);
  });

  it('initialize should set loading and fetch data', async () => {
    await facade.initialize();
    expect(profileMock.getInstructorId).toHaveBeenCalled();
    expect(supabaseMock.client.from).toHaveBeenCalledWith('instructor_monthly_hours');
    expect(supabaseMock.client.from).toHaveBeenCalledWith('instructor_advances');
  });

  it('initialize should use SWR on second call', async () => {
    await facade.initialize();
    const callCount = supabaseMock.client.from.mock.calls.length;
    await facade.initialize();
    // Should have made additional calls (refreshSilently)
    expect(supabaseMock.client.from.mock.calls.length).toBeGreaterThan(callCount);
  });

  it('fetchMonthlyTarget should query class_b_sessions and instructor_monthly_payments', async () => {
    await facade.fetchMonthlyTarget();
    const tables = supabaseMock.client.from.mock.calls.map((c: any) => c[0]);
    expect(tables).toContain('class_b_sessions');
    expect(tables).toContain('instructor_monthly_payments');
  });

  it('fetchSessionsLog should query completed class_b_sessions', async () => {
    await facade.fetchSessionsLog();
    const tables = supabaseMock.client.from.mock.calls.map((c: any) => c[0]);
    expect(tables).toContain('class_b_sessions');
  });
});
