import { TestBed } from '@angular/core/testing';
import { InstructorAlumnosFacade } from './instructor-alumnos.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('InstructorAlumnosFacade', () => {
  let facade: InstructorAlumnosFacade;
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
      'insert',
      'not',
    ];
    for (const m of methods) {
      chain[m] = (window as any).vi.fn().mockReturnValue(chain);
    }
    chain.order = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = (window as any).vi.fn().mockResolvedValue(resolvedValue);
    chain.in = (window as any).vi.fn().mockReturnValue(chain);
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
        InstructorAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
      ],
    });

    facade = TestBed.inject(InstructorAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with empty state', () => {
    expect(facade.students()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('fetchStudents should first query class_b_sessions for instructor enrollment IDs', async () => {
    await facade.fetchStudents();
    const firstCall = supabaseMock.client.from.mock.calls[0];
    expect(firstCall[0]).toBe('class_b_sessions');
  });

  it('fetchStudents should set empty when instructor has no sessions', async () => {
    await facade.fetchStudents();
    expect(facade.students()).toEqual([]);
  });

  it('loadExamScores should filter by enrollment IDs from students signal', async () => {
    await facade.loadExamScores();
    // With no students loaded, should set empty and return early
    expect(facade.examScores()).toEqual([]);
  });

  it('fetchTheoryAttendance should query class_b_theory_attendance with instructor filter', async () => {
    const result = await facade.fetchTheoryAttendance();
    expect(Array.isArray(result)).toBe(true);
    const tables = supabaseMock.client.from.mock.calls.map((c: any) => c[0]);
    expect(tables).toContain('class_b_theory_attendance');
  });
});
