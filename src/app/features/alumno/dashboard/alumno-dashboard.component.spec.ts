import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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

  it('heroActions no tiene acciones cuando cert está bloqueado', () => {
    const actions = component.heroActions();
    expect(actions.length).toBe(0);
  });

  it('heroActions NO incluye "Descargar certificado" cuando cert está bloqueado', () => {
    const actions = component.heroActions();
    expect(actions.some((a) => a.id === 'cert')).toBe(false);
  });

  it('nextScheduledPractice es null cuando ninguna práctica está "scheduled" (completed/pending solamente)', () => {
    expect(component.nextScheduledPractice()).toBeNull();
  });
});

describe('AlumnoDashboardComponent — heroKpis (spec 0035, reformulación)', () => {
  let component: AlumnoDashboardComponent;

  beforeEach(() => {
    component = setup();
  });

  it('expone 4 KPIs: prácticas, asist. teoría, próxima clase, saldo', () => {
    const kpis = component.heroKpis();
    expect(kpis.map((k) => k.id)).toEqual(['practicas', 'asist-teoria', 'proxima-clase', 'saldo']);
  });

  it('KPI "practicas" muestra el conteo completado/total formateado', () => {
    const kpi = component.heroKpis().find((k) => k.id === 'practicas');
    expect(kpi?.value).toBe('8');
    expect(kpi?.suffix).toBe('/12');
  });

  it('KPI "proxima-clase" y "saldo" son clickeables; "practicas" y "asist-teoria" no', () => {
    const kpis = component.heroKpis();
    expect(kpis.find((k) => k.id === 'proxima-clase')?.clickable).toBe(true);
    expect(kpis.find((k) => k.id === 'saldo')?.clickable).toBe(true);
    expect(kpis.find((k) => k.id === 'practicas')?.clickable).toBeUndefined();
    expect(kpis.find((k) => k.id === 'asist-teoria')?.clickable).toBeUndefined();
  });

  it('KPI "saldo" muestra "Al día" en success cuando pendingBalance es 0', () => {
    const kpi = component.heroKpis().find((k) => k.id === 'saldo');
    expect(kpi?.value).toBe('Al día');
    expect(kpi?.color).toBe('success');
  });

  it('KPI "saldo" muestra el monto formateado en warning cuando hay deuda', () => {
    TestBed.resetTestingModule();
    component = setup(
      makeClassBSnapshot({
        side: {
          ...makeClassBSnapshot().side,
          pendingBalance: 50000,
          totalPaid: 100000,
          nextClass: null,
        },
      }),
    );
    const kpi = component.heroKpis().find((k) => k.id === 'saldo');
    expect(kpi?.color).toBe('warning');
    expect(kpi?.value).toContain('50.000');
  });

  it('KPI "proxima-clase" muestra "Sin clases" cuando no hay próxima clase agendada', () => {
    TestBed.resetTestingModule();
    component = setup(
      makeClassBSnapshot({ side: { ...makeClassBSnapshot().side, nextClass: null } }),
    );
    const kpi = component.heroKpis().find((k) => k.id === 'proxima-clase');
    expect(kpi?.value).toBe('Sin clases');
  });
});

describe('AlumnoDashboardComponent — onKpiClick (navegación, spec 0035)', () => {
  let component: AlumnoDashboardComponent;
  let router: Router;

  beforeEach(() => {
    component = setup();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('navega a /app/alumno/horario al clickear "proxima-clase"', () => {
    component.onKpiClick('proxima-clase');
    expect(router.navigate).toHaveBeenCalledWith(['/app/alumno/horario']);
  });

  it('navega a /app/alumno/pagos al clickear "saldo"', () => {
    component.onKpiClick('saldo');
    expect(router.navigate).toHaveBeenCalledWith(['/app/alumno/pagos']);
  });

  it('no navega para KPIs no clickeables (ej. "practicas")', () => {
    component.onKpiClick('practicas');
    expect(router.navigate).not.toHaveBeenCalled();
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

  it('heroActions incluye "Descargar certificado"', () => {
    const actions = component.heroActions();
    expect(actions.some((a) => a.id === 'cert')).toBe(true);
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

describe('AlumnoDashboardComponent — journeySteps / "Camino al Certificado" (spec 0035)', () => {
  it('Clase B en progreso: prácticas="current" (primer paso no completado), examen ya aprobado="done", certificado="pending"', () => {
    const component = setup(); // 8/12 prácticas, passed=true, certificado locked
    const steps = component.journeySteps();
    expect(steps.map((s) => s.id)).toEqual(['practicas', 'evaluacion', 'certificado']);
    expect(steps[0]).toMatchObject({ done: false, state: 'current', detail: '8/12' });
    expect(steps[1]).toMatchObject({ done: true, state: 'done', label: 'Examen Final' });
    expect(steps[2]).toMatchObject({ done: false, state: 'pending', detail: 'Pendiente' });
  });

  it('Clase B con todo completado: los 3 pasos quedan "done"', () => {
    const component = setup(
      makeClassBSnapshot({
        progress: {
          practicesCompleted: 12,
          practicesTotal: 12,
          pctTheoryAttendance: 100,
          pctOverall: 100,
          practices: [],
        },
        certificate: {
          state: 'issued',
          folio: 'F-100',
          issuedDate: '2026-05-01',
          pdfUrl: 'cert.pdf',
          blockingReason: null,
        },
      }),
    );
    const steps = component.journeySteps();
    expect(steps.every((s) => s.state === 'done')).toBe(true);
    expect(steps[2].detail).toBe('Folio F-100');
  });

  it('Clase B sin rendir examen: paso "current" es prácticas si aún faltan, si no pasa a examen', () => {
    const component = setup(
      makeClassBSnapshot({
        progress: {
          practicesCompleted: 12,
          practicesTotal: 12,
          pctTheoryAttendance: 100,
          pctOverall: 90,
          practices: [],
        },
        grades: {
          finalExamGrade: null,
          finalExamDate: null,
          passed: null,
          modules: [],
          averageGrade: null,
        },
      }),
    );
    const steps = component.journeySteps();
    expect(steps[0].state).toBe('done');
    expect(steps[1]).toMatchObject({ state: 'current', detail: 'Pendiente' });
    expect(steps[2].state).toBe('pending');
  });

  it('Profesional: paso "Módulos" solo queda "done" si TODOS los módulos tienen passed=true', () => {
    const profSnapshot = makeClassBSnapshot({
      progress: {
        practicesCompleted: 12,
        practicesTotal: 12,
        pctTheoryAttendance: 100,
        pctOverall: 100,
        practices: [],
      },
      grades: {
        finalExamGrade: null,
        finalExamDate: null,
        passed: null,
        averageGrade: 70,
        modules: [
          { number: 1, name: 'Módulo 1', grade: 85, passed: true },
          { number: 2, name: 'Módulo 2', grade: 55, passed: false },
        ],
      },
    });
    profSnapshot.hero.licenseGroup = 'professional';
    const component = setup(profSnapshot);
    const steps = component.journeySteps();
    expect(steps[1]).toMatchObject({ label: 'Módulos', done: false, detail: 'Promedio 70' });
  });

  it('Profesional: paso "Módulos" es "done" cuando todos los módulos pasaron', () => {
    const profSnapshot = makeClassBSnapshot({
      grades: {
        finalExamGrade: null,
        finalExamDate: null,
        passed: null,
        averageGrade: 88,
        modules: [
          { number: 1, name: 'Módulo 1', grade: 85, passed: true },
          { number: 2, name: 'Módulo 2', grade: 90, passed: true },
        ],
      },
    });
    profSnapshot.hero.licenseGroup = 'professional';
    const component = setup(profSnapshot);
    const steps = component.journeySteps();
    expect(steps[1].done).toBe(true);
  });
});
