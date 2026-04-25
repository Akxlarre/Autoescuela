import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { AlumnoDashboardComponent } from './alumno-dashboard.component';
import { StudentHomeFacade } from '@core/facades/student-home.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { StudentHomeSnapshot } from '@core/models/ui/student-home.model';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeClassBSnapshot(overrides: Partial<StudentHomeSnapshot> = {}): StudentHomeSnapshot {
  return {
    hero: {
      studentFirstName: 'María',
      enrollmentNumber: 'E-010',
      licenseGroup: 'class_b',
      branchName: 'Sede Centro',
      courseStartDate: '2026-04-01T00:00:00Z',
      enrollmentStatus: 'active',
    },
    progress: {
      practicesCompleted: 8,
      practicesTotal: 12,
      pctTheoryAttendance: 92,
      pctOverall: 77,
      practices: Array.from({ length: 12 }, (_, i) => ({
        number: i + 1,
        status: i < 8 ? ('completed' as const) : ('pending' as const),
        date: i < 8 ? '2026-04-01' : null,
      })),
    },
    attendance: {
      consecutiveAbsences: 0,
      semaphore: 'green',
      recentSessions: [
        {
          id: '1',
          date: '2026-04-20T10:00:00Z',
          kind: 'practice',
          status: 'present',
          label: 'Práctica',
        },
        {
          id: '2',
          date: '2026-04-18T09:00:00Z',
          kind: 'theory',
          status: 'present',
          label: 'Teoría',
        },
      ],
    },
    grades: {
      finalExamGrade: 5.5,
      finalExamDate: '2026-04-15T00:00:00Z',
      passed: true,
      modules: [],
      averageGrade: 5.5,
    },
    certificate: {
      state: 'locked',
      folio: null,
      issuedDate: null,
      pdfUrl: null,
      blockingReason: 'Te faltan 4 clases prácticas para habilitar tu certificado',
    },
    side: {
      nextClass: { date: 'jue. 24 abr.', time: '10:00', instructorName: '' },
      pendingBalance: 0,
      totalPaid: 200000,
    },
    ...overrides,
  };
}

function makeFacadeMock(snapshot: StudentHomeSnapshot | null = makeClassBSnapshot()) {
  const _snapshot = signal(snapshot);
  const _loading = signal(false);
  const _error = signal<string | null>(null);

  return {
    snapshot: _snapshot.asReadonly(),
    isLoading: _loading.asReadonly(),
    error: _error.asReadonly(),
    hero: vi.fn(() => snapshot?.hero ?? null),
    progress: vi.fn(() => snapshot?.progress ?? null),
    attendance: vi.fn(() => snapshot?.attendance ?? null),
    grades: vi.fn(() => snapshot?.grades ?? null),
    certificate: vi.fn(() => snapshot?.certificate ?? null),
    side: vi.fn(() => snapshot?.side ?? null),
    licenseGroup: vi.fn(() => snapshot?.hero.licenseGroup ?? null),
    initialize: vi.fn().mockResolvedValue(undefined),
    downloadCertificate: vi.fn().mockResolvedValue(null),
  };
}

function setup(snapshot: StudentHomeSnapshot | null = makeClassBSnapshot()) {
  const facadeMock = makeFacadeMock(snapshot);

  TestBed.configureTestingModule({
    imports: [AlumnoDashboardComponent],
    providers: [
      provideRouter([]),
      { provide: StudentHomeFacade, useValue: facadeMock },
      {
        provide: GsapAnimationsService,
        useValue: {
          animateBentoGrid: vi.fn(),
          animateHero: vi.fn(),
          animateCounter: vi.fn(),
          addCardHover: vi.fn(),
          createShimmer: vi.fn(),
        },
      },
    ],
  });

  return TestBed.createComponent(AlumnoDashboardComponent).componentInstance;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AlumnoDashboardComponent — defaults (Clase B, sin faltas)', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    component = setup();
  });

  it('llama facade.initialize() en el constructor', () => {
    const facade = TestBed.inject(StudentHomeFacade) as any;
    expect(facade.initialize).toHaveBeenCalled();
  });

  it('heroTitle devuelve "Hola, María" para Clase B', () => {
    expect(component.heroTitle()).toBe('Hola, María');
  });

  it('heroContextLine incluye tipo de curso, sede y número de matrícula', () => {
    const line = component.heroContextLine();
    expect(line).toContain('Clase B');
    expect(line).toContain('Sede Centro');
    expect(line).toContain('E-010');
  });

  it('heroChips muestra "Curso activo" cuando no hay faltas', () => {
    const chips = component.heroChips();
    expect(chips.some((c) => c.label === 'Curso activo')).toBe(true);
    expect(chips.length).toBe(1);
  });

  it('licenseGroup es "class_b" para snapshot de Clase B', () => {
    expect(component.licenseGroup()).toBe('class_b');
  });

  it('practicesPct devuelve porcentaje correcto (8/12 = 67%)', () => {
    expect(component.practicesPct()).toBe(67);
  });

  it('gradeColor es "success" cuando la nota es >= 4', () => {
    expect(component.gradeColor()).toBe('success');
  });

  it('certIcon es "lock" cuando certificado está bloqueado', () => {
    expect(component.certIcon()).toBe('lock');
  });

  it('semaphoreLabel es "Al día" con semaphore green', () => {
    expect(component.semaphoreLabel()).toBe('Al día');
  });

  it('heroActions incluye "Agendar clase" como acción primaria', () => {
    const actions = component.heroActions();
    const agendar = actions.find((a) => a.id === 'agendar');
    expect(agendar?.primary).toBe(true);
  });

  it('heroActions NO incluye "Descargar certificado" cuando cert está bloqueado', () => {
    const actions = component.heroActions();
    expect(actions.some((a) => a.id === 'cert')).toBe(false);
  });
});

describe('AlumnoDashboardComponent — heroChips con 1 falta', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    component = setup(
      makeClassBSnapshot({
        attendance: { consecutiveAbsences: 1, semaphore: 'yellow', recentSessions: [] },
      }),
    );
  });

  it('agrega chip de advertencia', () => {
    const chips = component.heroChips();
    expect(chips.some((c) => c.style === 'warning')).toBe(true);
  });
});

describe('AlumnoDashboardComponent — heroChips con ≥2 faltas', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    component = setup(
      makeClassBSnapshot({
        attendance: { consecutiveAbsences: 2, semaphore: 'red', recentSessions: [] },
      }),
    );
  });

  it('agrega chip de error', () => {
    const chips = component.heroChips();
    expect(chips.some((c) => c.style === 'error')).toBe(true);
  });
});

describe('AlumnoDashboardComponent — gradeColor con nota < 4', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    component = setup(
      makeClassBSnapshot({
        grades: {
          finalExamGrade: 3,
          finalExamDate: null,
          passed: false,
          modules: [],
          averageGrade: 3,
        },
      }),
    );
  });

  it('gradeColor es "error"', () => {
    expect(component.gradeColor()).toBe('error');
  });
});

describe('AlumnoDashboardComponent — certificado emitido', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    component = setup(
      makeClassBSnapshot({
        certificate: {
          state: 'issued',
          folio: 'F-001',
          issuedDate: '2026-04-20',
          pdfUrl: 'cert.pdf',
          blockingReason: null,
        },
      }),
    );
  });

  it('certIcon es "award"', () => {
    expect(component.certIcon()).toBe('award');
  });

  it('heroActions incluye "Descargar certificado"', () => {
    const actions = component.heroActions();
    expect(actions.some((a) => a.id === 'cert')).toBe(true);
  });
});

describe('AlumnoDashboardComponent — semaphore red', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    component = setup(
      makeClassBSnapshot({
        attendance: { consecutiveAbsences: 2, semaphore: 'red', recentSessions: [] },
      }),
    );
  });

  it('semaphoreLabel es "En riesgo"', () => {
    expect(component.semaphoreLabel()).toBe('En riesgo');
  });
});

describe('AlumnoDashboardComponent — licenseGroup professional', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    const profSnapshot = makeClassBSnapshot();
    profSnapshot.hero.licenseGroup = 'professional';
    component = setup(profSnapshot);
  });

  it('licenseGroup es "professional"', () => {
    expect(component.licenseGroup()).toBe('professional');
  });
});
