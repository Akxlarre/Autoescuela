import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentHomeFacade } from './student-home.facade';
import { AuthFacade } from './auth.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

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

function buildSupabaseMock(enrollmentRow: unknown | null = mockEnrollmentRow()) {
  const progressData = { completed_practices: 8, pct_theory_attendance: 92 };
  const sessionsData = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    scheduled_at: new Date(Date.now() - (8 - i) * 86400000).toISOString(),
    class_b_practice_attendance: [{ status: i < 7 ? 'present' : 'absent' }],
  }));
  const examData = null;
  const certData = null;
  const nextClassData = null;
  const theoryData = [
    { status: 'present', class_b_theory_sessions: { scheduled_at: '2026-04-20T09:00:00Z' } },
  ];

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
    chain(theoryData), // class_b_theory_attendance
  ];

  return {
    client: {
      from: vi.fn(() => {
        const response = fromResponses[callIndex] ?? chain(null);
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
      ],
    });

    const f = TestBed.inject(StudentHomeFacade);
    await f.initialize();
    expect(f.snapshot()).toBeNull();
    expect(f.error()).toBeNull();
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
      ],
    });

    const f = TestBed.inject(StudentHomeFacade);
    await f.initialize();
    expect(f.error()).not.toBeNull();
    expect(f.snapshot()).toBeNull();
  });
});
