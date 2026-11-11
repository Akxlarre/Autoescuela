import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentHomeFacade } from './student-home.facade';
import { AuthFacade } from './auth.facade';
import { StudentEnrollmentContextFacade } from './student-enrollment-context.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

const toastMock = { success: vi.fn(), error: vi.fn(), warn: vi.fn() };
const contextMock = {
  initialize: vi.fn().mockResolvedValue(undefined),
  activeEnrollmentId: vi.fn().mockReturnValue(42),
  enrollments: vi.fn().mockReturnValue([]),
  setActive: vi.fn(),
  reset: vi.fn(),
};

// ── Helpers de mock ───────────────────────────────────────────────────────────

function mockEnrollmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    number: 'E-042',
    status: 'active',
    license_group: 'class_b',
    pending_balance: 150000,
    total_paid: 200000,
    certificate_enabled: false,
    certificate_b_pdf_url: null,
    certificate_professional_pdf_url: null,
    created_at: '2026-04-01T10:00:00Z',
    student_id: 10,
    promotion_course_id: null,
    students: {
      id: 10,
      users: { first_names: 'Benjamín Carlos', paternal_last_name: 'Ruiz' },
    },
    courses: { code: 'class_b' },
    branches: { name: 'Sede Centro' },
    ...overrides,
  };
}

function buildSupabaseMock(
  enrollmentRow: unknown | null = mockEnrollmentRow(),
  examData: unknown | null = null,
) {
  const progressData = { completed_practices: 8 };
  const sessionsData = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    scheduled_at: new Date(Date.now() - (8 - i) * 86400000).toISOString(),
    class_b_practice_attendance: [{ status: i < 7 ? 'present' : 'absent' }],
  }));
  const certData = null;
  const nextClassData = null;

  // Fluent mock that chains .from().select()...
  const chain = (data: unknown) => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      in: () => q,
      gt: () => q,
      order: () => q,
      limit: () => q,
      maybeSingle: () => Promise.resolve({ data, error: null }),
    };
    return q;
  };

  let callIndex = 0;
  const fromResponses = [
    chain(enrollmentRow), // enrollments
    chain(progressData), // v_student_progress_b
    chain(sessionsData), // class_b_sessions (timeline)
    chain(examData), // class_b_exam_scores
    chain(certData), // certificates
    chain(nextClassData), // class_b_sessions (next class)
  ];

  return {
    client: {
      from: vi.fn(() => {
        const response = fromResponses[callIndex % fromResponses.length] ?? chain(null);
        callIndex++;
        return response;
      }),
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi
            .fn()
            .mockResolvedValue({ data: { signedUrl: 'https://signed.url/cert.pdf' } }),
        })),
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StudentHomeFacade', () => {
  let facade: StudentHomeFacade;
  let supabaseMock: ReturnType<typeof buildSupabaseMock>;

  function setupFacade(enrollmentRow: unknown = mockEnrollmentRow()) {
    supabaseMock = buildSupabaseMock(enrollmentRow);

    TestBed.configureTestingModule({
      providers: [
        StudentHomeFacade,
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ dbId: 1, name: 'Benjamín', role: 'alumno' }),
          },
        },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ToastService, useValue: toastMock },
        { provide: StudentEnrollmentContextFacade, useValue: contextMock },
      ],
    });

    facade = TestBed.inject(StudentHomeFacade);
  }

  beforeEach(() => {
    setupFacade();
  });

  it('inicia con snapshot null e isLoading false', () => {
    expect(facade.snapshot()).toBeNull();
    expect(facade.isLoading()).toBe(false);
  });

  it('setea isLoading=true durante initialize y false al terminar', async () => {
    const loadingValues: boolean[] = [];
    // capture changes
    await facade.initialize();
    expect(facade.isLoading()).toBe(false);
  });

  it('arma snapshot con hero correcto para Clase B', async () => {
    await facade.initialize();
    const snap = facade.snapshot();
    expect(snap).not.toBeNull();
    expect(snap?.hero.licenseGroup).toBe('class_b');
    expect(snap?.hero.studentFirstName).toBe('Benjamín');
    expect(snap?.hero.enrollmentNumber).toBe('E-042');
    expect(snap?.hero.branchName).toBe('Sede Centro');
  });

  it('expone licenseGroup computed correctamente', async () => {
    await facade.initialize();
    expect(facade.licenseGroup()).toBe('class_b');
  });

  it('SWR: segunda llamada no resetea snapshot ni activa skeleton', async () => {
    await facade.initialize();
    const snapAfterFirst = facade.snapshot();
    expect(snapAfterFirst).not.toBeNull();

    // Segunda invocación — SWR path
    await facade.initialize();
    // snapshot no es null durante la segunda carga (datos stale visibles)
    expect(facade.snapshot()).not.toBeNull();
  });

  it('progress computed refleja los datos del snapshot', async () => {
    await facade.initialize();
    const progress = facade.progress();
    expect(progress?.practicesTotal).toBe(12);
    expect(progress?.practicesCompleted).toBe(8);
  });

  it('downloadCertificate devuelve null si no hay pdfUrl', async () => {
    await facade.initialize();
    const url = await facade.downloadCertificate();
    // snap.certificate.pdfUrl = null (certificate_enabled=false)
    expect(url).toBeNull();
  });
});

describe('StudentHomeFacade — Refuerzo Clase B (spec 0006-m, AC2)', () => {
  function setupWith(enrollmentRow: unknown) {
    const supabaseMock = buildSupabaseMock(enrollmentRow);
    TestBed.configureTestingModule({
      providers: [
        StudentHomeFacade,
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ dbId: 1, name: 'Benjamín', role: 'alumno' }),
          },
        },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ToastService, useValue: toastMock },
        { provide: StudentEnrollmentContextFacade, useValue: contextMock },
      ],
    });
    return TestBed.inject(StudentHomeFacade);
  }

  it('practicesTotal deriva de courses.practical_hours (4.5h → 6), no queda hardcodeado en 12', async () => {
    const facade = setupWith(
      mockEnrollmentRow({ courses: { code: 'refuerzo_b_1', practical_hours: 4.5 } }),
    );
    await facade.initialize();
    expect(facade.progress()?.practicesTotal).toBe(6);
  });

  it('regresión AC-E1: sin practical_hours en el fixture, sigue usando 12', async () => {
    const facade = setupWith(mockEnrollmentRow({ courses: { code: 'class_b' } }));
    await facade.initialize();
    expect(facade.progress()?.practicesTotal).toBe(12);
  });
});

describe('StudentHomeFacade — sin enrollment activo', () => {
  it('setea snapshot=null y error=null cuando no hay enrollment', async () => {
    const supabaseMock = buildSupabaseMock(null);

    TestBed.configureTestingModule({
      providers: [
        StudentHomeFacade,
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ dbId: 1, name: 'Test', role: 'alumno' }),
          },
        },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ToastService, useValue: toastMock },
        {
          provide: StudentEnrollmentContextFacade,
          useValue: { ...contextMock, activeEnrollmentId: vi.fn().mockReturnValue(null) },
        },
      ],
    });

    const f = TestBed.inject(StudentHomeFacade);
    await f.initialize();
    expect(f.snapshot()).toBeNull();
    expect(f.error()).toBeNull();
  });
});

describe('StudentHomeFacade — nota de examen final (regresión H-017 / H-035)', () => {
  it('expone finalExamGrade cuando class_b_exam_scores trae una nota real (columna score)', async () => {
    const supabaseMock = buildSupabaseMock(mockEnrollmentRow(), {
      score: 85,
      created_at: '2026-07-01T12:00:00Z',
    });

    TestBed.configureTestingModule({
      providers: [
        StudentHomeFacade,
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ dbId: 1, name: 'Benjamín', role: 'alumno' }),
          },
        },
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ToastService, useValue: toastMock },
        { provide: StudentEnrollmentContextFacade, useValue: contextMock },
      ],
    });

    const f = TestBed.inject(StudentHomeFacade);
    await f.initialize();

    expect(f.grades()?.finalExamGrade).toBe(85);
    expect(f.grades()?.finalExamDate).toBe('2026-07-01T12:00:00Z');
    expect(f.grades()?.passed).toBe(true);
  });
});

describe('StudentHomeFacade — error handling', () => {
  it('captura el error en error() si Supabase falla', async () => {
    const errorMock = {
      client: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
        })),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        StudentHomeFacade,
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue({ dbId: 1 }) } },
        { provide: SupabaseService, useValue: errorMock },
        { provide: ToastService, useValue: toastMock },
        { provide: StudentEnrollmentContextFacade, useValue: contextMock },
      ],
    });

    const f = TestBed.inject(StudentHomeFacade);
    await f.initialize();
    expect(f.error()).not.toBeNull();
    expect(f.snapshot()).toBeNull();
  });
});

describe('StudentHomeFacade — manejo explícito de errores de lectura (0060-b / DoD-F)', () => {
  type TableResponse = { data?: unknown; count?: number | null; error: unknown };

  function makeTableMock(responses: Record<string, TableResponse | TableResponse[]>) {
    const counters: Record<string, number> = {};
    const from = vi.fn().mockImplementation((table: string) => {
      const entry = responses[table];
      let res: TableResponse;
      if (Array.isArray(entry)) {
        const idx = counters[table] ?? 0;
        counters[table] = idx + 1;
        res = entry[idx] ?? entry[entry.length - 1] ?? { data: null, count: 0, error: null };
      } else {
        res = entry ?? { data: null, count: 0, error: null };
      }
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(res),
        then: (resolve: any, reject: any) => Promise.resolve(res).then(resolve, reject),
      };
      return chain;
    });
    return { client: { from } };
  }

  function setupErrorCase(opts: {
    responses: Record<string, TableResponse | TableResponse[]>;
    activeEnrollmentId?: () => number | null;
  }) {
    TestBed.resetTestingModule();
    const mockSupabase = makeTableMock(opts.responses);
    const localContextMock = {
      initialize: vi.fn().mockResolvedValue(undefined),
      activeEnrollmentId: vi.fn().mockImplementation(opts.activeEnrollmentId ?? (() => 42)),
      enrollments: vi.fn().mockReturnValue([]),
      setActive: vi.fn(),
      reset: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        StudentHomeFacade,
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ dbId: 1, name: 'Benjamín', role: 'alumno' }),
          },
        },
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toastMock },
        { provide: StudentEnrollmentContextFacade, useValue: localContextMock },
      ],
    });
    return {
      facade: TestBed.inject(StudentHomeFacade),
      mockSupabase,
      localContextMock,
    };
  }

  it('Caso A: primera carga con error en enrollments deja snapshot null, error amigable y _initialized false', async () => {
    const { facade } = setupErrorCase({
      responses: {
        enrollments: { data: null, error: { message: 'relation "enrollments" failed' } },
      },
    });

    await facade.initialize();

    expect(facade.snapshot()).toBeNull();
    expect(facade.side()).toBeNull();
    expect(facade.error()).toBe('No se pudo cargar tu resumen.');
    expect(facade.isLoading()).toBe(false);
    expect((facade as any)._initialized).toBe(false);
  });

  it('Caso A (Clase B): si falla v_student_progress_b en Promise.all, falla toda la carga y no expone saldos parciales', async () => {
    const { facade } = setupErrorCase({
      responses: {
        enrollments: {
          data: mockEnrollmentRow({ pending_balance: 0, total_paid: 200000 }),
          error: null,
        },
        v_student_progress_b: { data: null, error: { message: 'view unavailable' } },
        class_b_sessions: { data: [], error: null },
        class_b_exam_scores: { data: null, error: null },
        certificates: { data: null, error: null },
      },
    });

    await facade.initialize();

    expect(facade.snapshot()).toBeNull();
    expect(facade.progress()).toBeNull();
    expect(facade.side()).toBeNull();
    expect(facade.error()).toBe('No se pudo cargar tu resumen.');
  });

  it('Caso A (Profesional): si falla professional_practice_attendance en Promise.all, falla toda la carga', async () => {
    const { facade } = setupErrorCase({
      responses: {
        enrollments: {
          data: mockEnrollmentRow({
            license_group: 'professional',
            promotion_course_id: 9,
          }),
          error: null,
        },
        professional_module_grades: { data: [], error: null },
        v_professional_attendance: { data: null, error: null },
        professional_practice_sessions: { data: null, count: 5, error: null },
        certificates: { data: null, error: null },
        professional_practice_attendance: {
          data: null,
          count: null,
          error: { message: 'count query failed' },
        },
        professional_theory_sessions: { data: null, count: 4, error: null },
        professional_theory_attendance: { data: null, count: 3, error: null },
      },
    });

    await facade.initialize();

    expect(facade.snapshot()).toBeNull();
    expect(facade.error()).toBe('No se pudo cargar tu resumen.');
  });

  it('Caso A (cambio de matrícula): limpia snapshot previo al empezar y expone error si la nueva matrícula falla', async () => {
    let currentEnrollmentId = 42;
    const { facade, mockSupabase } = setupErrorCase({
      activeEnrollmentId: () => currentEnrollmentId,
      responses: {
        enrollments: { data: mockEnrollmentRow({ id: 42, pending_balance: 150000 }), error: null },
        v_student_progress_b: { data: { completed_practices: 8 }, error: null },
        class_b_sessions: { data: [], error: null },
        class_b_exam_scores: { data: null, error: null },
        certificates: { data: null, error: null },
      },
    });

    await facade.initialize();
    expect(facade.snapshot()?.side.pendingBalance).toBe(150000);

    // Cambiar de matrícula y simular fallo
    currentEnrollmentId = 99;
    mockSupabase.client.from = makeTableMock({
      enrollments: { data: null, error: { message: 'enrollment 99 failed' } },
    }).client.from;

    await facade.initialize();

    expect(facade.snapshot()).toBeNull();
    expect(facade.side()).toBeNull();
    expect(facade.error()).toBe('No se pudo cargar tu resumen.');
  });

  it('Caso B: refresco con error en la misma matrícula mantiene snapshot visible y activa refreshFailed', async () => {
    const { facade, mockSupabase } = setupErrorCase({
      responses: {
        enrollments: { data: mockEnrollmentRow({ id: 42, pending_balance: 150000 }), error: null },
        v_student_progress_b: { data: { completed_practices: 8 }, error: null },
        class_b_sessions: { data: [], error: null },
        class_b_exam_scores: { data: null, error: null },
        certificates: { data: null, error: null },
      },
    });

    await facade.initialize();
    expect(facade.snapshot()?.side.pendingBalance).toBe(150000);
    expect(facade.refreshFailed()).toBe(false);

    // Segundo initialize (SWR) con fallo
    mockSupabase.client.from = makeTableMock({
      enrollments: { data: null, error: { message: 'temp failure' } },
    }).client.from;

    await facade.initialize();

    expect(facade.snapshot()?.side.pendingBalance).toBe(150000);
    expect(facade.refreshFailed()).toBe(true);
    expect(facade.error()).toBeNull();
    expect(facade.isLoading()).toBe(false);
  });

  it('reintentar limpia el error, vuelve a cargar y despeja refreshFailed', async () => {
    const { facade, mockSupabase } = setupErrorCase({
      responses: {
        enrollments: { data: null, error: { message: 'network down' } },
      },
    });

    await facade.initialize();
    expect(facade.error()).toBe('No se pudo cargar tu resumen.');

    mockSupabase.client.from = makeTableMock({
      enrollments: { data: mockEnrollmentRow({ id: 42, pending_balance: 80000 }), error: null },
      v_student_progress_b: { data: { completed_practices: 4 }, error: null },
      class_b_sessions: { data: [], error: null },
      class_b_exam_scores: { data: null, error: null },
      certificates: { data: null, error: null },
    }).client.from;

    await facade.reintentar();

    expect(facade.error()).toBeNull();
    expect(facade.refreshFailed()).toBe(false);
    expect(facade.snapshot()?.side.pendingBalance).toBe(80000);
  });

  it('request guard descarta respuesta vieja fuera de orden', async () => {
    let currentEnrollmentId = 42;
    let resolveFirst: any;
    const firstPromise = new Promise((r) => {
      resolveFirst = r;
    });

    const { facade, mockSupabase } = setupErrorCase({
      activeEnrollmentId: () => currentEnrollmentId,
      responses: {},
    });

    mockSupabase.client.from = vi.fn().mockImplementation((table: string) => {
      if (currentEnrollmentId === 42 && table === 'enrollments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => firstPromise),
        };
      }
      const okResponses: Record<string, TableResponse> = {
        enrollments: {
          data: mockEnrollmentRow({ id: 99, number: 'E-099', pending_balance: 10000 }),
          error: null,
        },
        v_student_progress_b: { data: { completed_practices: 10 }, error: null },
        class_b_sessions: { data: [], error: null },
        class_b_exam_scores: { data: null, error: null },
        certificates: { data: null, error: null },
      };
      const res = okResponses[table] ?? { data: null, error: null };
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(res),
        then: (r: any, j: any) => Promise.resolve(res).then(r, j),
      };
    });

    const p1 = facade.initialize();
    currentEnrollmentId = 99;
    const p2 = facade.initialize();

    await p2;
    expect(facade.snapshot()?.hero.enrollmentNumber).toBe('E-099');

    resolveFirst({ data: null, error: { message: 'stale err' } });
    await p1;

    expect(facade.snapshot()?.hero.enrollmentNumber).toBe('E-099');
    expect(facade.error()).toBeNull();
  });

  it('Lección 5: un refresco que pide token nuevo no deja isLoading pegado en true', async () => {
    let resolveFirst: any;
    const firstPromise = new Promise((r) => {
      resolveFirst = r;
    });

    const { facade, mockSupabase } = setupErrorCase({
      responses: {},
    });

    let call = 0;
    mockSupabase.client.from = vi.fn().mockImplementation((table: string) => {
      call++;
      if (call === 1 && table === 'enrollments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => firstPromise),
        };
      }
      const res: TableResponse =
        table === 'enrollments'
          ? { data: mockEnrollmentRow({ id: 42 }), error: null }
          : { data: [], error: null };
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(res),
        then: (r: any, j: any) => Promise.resolve(res).then(r, j),
      };
    });

    const pInit = facade.initialize();
    const pRefresh = (facade as any).refreshSilently();
    resolveFirst({ data: mockEnrollmentRow({ id: 42 }), error: null });

    await Promise.all([pInit, pRefresh]);

    expect(facade.isLoading()).toBe(false);
  });
});
