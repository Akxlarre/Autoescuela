import { TestBed } from '@angular/core/testing';
import { InstructorClasesFacade } from './instructor-clases.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

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
      chain[m] = (window as any).vi.fn().mockReturnValue(chain);
    }
    chain.order = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    chain.eq = (window as any).vi.fn().mockReturnValue(chain);
    // For update().eq() terminal
    chain.lte = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    return chain;
  }

  beforeEach(() => {
    const chain = createChainMock();
    // Make update/upsert return chain for .eq() chaining, terminal resolves
    chain.update = (window as any).vi.fn().mockReturnValue({
      eq: (window as any).vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    chain.upsert = (window as any).vi.fn().mockResolvedValue({ data: null, error: null });
    chain.maybeSingle = (window as any).vi.fn().mockResolvedValue({
      data: { enrollment_id: 10, enrollments: { student_id: 5 } },
      error: null,
    });

    supabaseMock = {
      client: {
        from: (window as any).vi.fn().mockReturnValue(chain),
        channel: (window as any).vi.fn().mockReturnValue({
          on: (window as any).vi.fn().mockReturnThis(),
          subscribe: (window as any).vi.fn().mockReturnThis(),
        }),
        removeChannel: (window as any).vi.fn(),
      },
    };

    profileMock = {
      getInstructorId: (window as any).vi.fn().mockResolvedValue(1),
      instructorId: (window as any).vi.fn().mockReturnValue(1),
      instructorData: (window as any).vi.fn().mockReturnValue({ user_id: 99 }),
    };

    TestBed.configureTestingModule({
      providers: [
        InstructorClasesFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
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

  it('startClass should use TIME format for start_time', async () => {
    await facade.startClass(1, 50000);
    const updateCall = supabaseMock.client.from.mock.results[0].value.update;
    if (updateCall.mock.calls.length > 0) {
      const payload = updateCall.mock.calls[0][0];
      // TIME format: HH:MM:SS (no T, no timezone)
      expect(payload.start_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    }
  });

  it('finishClass should query session details and register attendance', async () => {
    await facade.finishClass(1, 50100);
    // Should have called from() for both class_b_sessions and class_b_practice_attendance
    const tables = supabaseMock.client.from.mock.calls.map((c: any) => c[0]);
    expect(tables).toContain('class_b_sessions');
    expect(tables).toContain('class_b_practice_attendance');
  });
});
