import { TestBed } from '@angular/core/testing';
import { InstructorClasesFacade } from './instructor-clases.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('InstructorClasesFacade', () => {
  let facade: InstructorClasesFacade;
  let supabaseMock: any;
  let profileMock: any;

  function createChainMock(resolvedValue: any = { data: [], error: null }) {
    const chain: any = {};
    const methods = [
      'select',
      'eq',
      'in',
      'gte',
      'lte',
      'order',
      'limit',
      'maybeSingle',
      'update',
      'insert',
      'upsert',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.order = vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.eq = vi.fn().mockReturnValue(chain);
    // For update().eq() terminal
    chain.lte = vi.fn().mockResolvedValue(resolvedValue);
    return chain;
  }

  beforeEach(() => {
    const chain = createChainMock();
    // Make update/upsert return chain for .eq() chaining, terminal resolves
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { enrollment_id: 10, enrollments: { student_id: 5 } },
      error: null,
    });

    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue(chain),
        channel: vi.fn().mockReturnValue({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn().mockReturnThis(),
        }),
        removeChannel: vi.fn(),
      },
    };

    profileMock = {
      getInstructorId: vi.fn().mockResolvedValue(1),
      instructorId: vi.fn().mockReturnValue(1),
      instructorData: vi.fn().mockReturnValue({ user_id: 99 }),
    };

    TestBed.configureTestingModule({
      providers: [
        InstructorClasesFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
        },
      ],
    });

    facade = TestBed.inject(InstructorClasesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with default state', () => {
    expect(facade.todayClasses()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
  });

  it('startClass should complete without throwing (mock mode)', async () => {
    // InstructorClasesFacade.useMock = true — real DB is bypassed; uses 800ms mock delay.
    vi.useFakeTimers();
    const promise = facade.startClass(1, 50000);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    vi.useRealTimers();
    // No supabase calls expected in mock mode
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('finishClass should complete without throwing (mock mode)', async () => {
    vi.useFakeTimers();
    const promise = facade.finishClass(1, 50100);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    vi.useRealTimers();
    // No supabase calls expected in mock mode
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });
});
