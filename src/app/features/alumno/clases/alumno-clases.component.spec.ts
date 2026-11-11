import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlumnoClasesComponent } from './alumno-clases.component';
import { StudentClasesFacade } from '@core/facades/student-clases.facade';
import { StudentEnrollmentContextFacade } from '@core/facades/student-enrollment-context.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { StudentClasesData } from '@core/models/ui/student-clases.model';

function makeData(): StudentClasesData {
  return {
    licenseGroup: 'class_b',
    kpis: {
      completedPractices: 5,
      totalPractices: 12,
      scheduledUpcoming: 2,
      theoryPct: 0,
    },
    practiceSessions: [],
    theorySessions: [],
    profSessions: [],
  };
}

describe('AlumnoClasesComponent', () => {
  function setup(opts?: {
    data?: StudentClasesData | null;
    error?: string | null;
    refreshFailed?: boolean;
    renderDom?: boolean;
  }) {
    const dataSig = signal<StudentClasesData | null>(opts?.data ?? null);
    const errorSig = signal<string | null>(opts?.error ?? null);
    const refreshFailedSig = signal<boolean>(opts?.refreshFailed ?? false);

    const facadeMock = {
      isLoading: signal(false).asReadonly(),
      data: dataSig.asReadonly(),
      error: errorSig.asReadonly(),
      refreshFailed: refreshFailedSig.asReadonly(),
      licenseGroup: () => dataSig()?.licenseGroup ?? null,
      kpis: () => dataSig()?.kpis ?? null,
      practiceSessions: () => dataSig()?.practiceSessions ?? [],
      theorySessions: () => dataSig()?.theorySessions ?? [],
      profSessions: () => dataSig()?.profSessions ?? [],
      initialize: vi.fn().mockResolvedValue(undefined),
      reintentar: vi.fn().mockResolvedValue(undefined),
    };

    const contextMock = {
      enrollments: signal([{ id: 100, label: 'Clase B' }]).asReadonly(),
      activeEnrollmentId: signal(100).asReadonly(),
      setActive: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AlumnoClasesComponent],
      providers: [
        { provide: StudentClasesFacade, useValue: facadeMock },
        { provide: StudentEnrollmentContextFacade, useValue: contextMock },
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

    if (opts?.renderDom) {
      TestBed.overrideComponent(AlumnoClasesComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      });
    }

    const fixture = TestBed.createComponent(AlumnoClasesComponent);
    if (opts?.renderDom) {
      fixture.detectChanges();
    }

    return {
      fixture,
      component: fixture.componentInstance,
      facadeMock,
      contextMock,
      dataSig,
      errorSig,
      refreshFailedSig,
    };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('Caso A: con error activo y sin data, heroKpis está vacío (no renderiza ceros)', () => {
    const { component } = setup({
      data: null,
      error: 'No se pudieron cargar tus clases.',
    });

    expect(component.heroKpis()).toEqual([]);
  });

  it('Caso B: con data cargada y refreshFailed activo, conserva los KPIs visibles', () => {
    const { component } = setup({
      data: makeData(),
      error: null,
      refreshFailed: true,
    });

    const kpis = component.heroKpis();
    expect(kpis.length).toBe(2);
    expect(kpis[0].value).toBe('5');
    expect(kpis[1].value).toBe('2');
  });

  it('selectEnrollment cambia la matrícula activa y recarga', () => {
    const { component, facadeMock, contextMock } = setup({ data: makeData() });

    component.selectEnrollment(200);

    expect(contextMock.setActive).toHaveBeenCalledWith(200);
    expect(facadeMock.initialize).toHaveBeenCalledTimes(2);
  });

  it('render Caso A: muestra app-empty-state con Reintentar y oculta tabs/sin matrícula', () => {
    const { fixture, facadeMock } = setup({
      data: null,
      error: 'No se pudieron cargar tus clases.',
      renderDom: true,
    });

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    const alertEl = fixture.nativeElement.querySelector('app-alert-card');
    expect(emptyEl).not.toBeNull();
    expect(alertEl).toBeNull();
    expect(emptyEl.message).toBe('No se pudieron cargar tus clases.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(facadeMock.reintentar).toHaveBeenCalledTimes(1);
  });

  it('render Caso B: con data y refreshFailed muestra app-alert-card con [data-llm-action="reintentar-clases-alumno"]', () => {
    const { fixture, facadeMock } = setup({
      data: makeData(),
      error: null,
      refreshFailed: true,
      renderDom: true,
    });

    const alertEl = fixture.nativeElement.querySelector('app-alert-card') as any;
    expect(alertEl).not.toBeNull();
    expect(alertEl.title).toBe('No se pudieron actualizar tus clases');

    const retryBtn = fixture.nativeElement.querySelector(
      '[data-llm-action="reintentar-clases-alumno"]',
    ) as HTMLButtonElement | null;
    expect(retryBtn).not.toBeNull();
    retryBtn?.click();
    expect(facadeMock.reintentar).toHaveBeenCalledTimes(1);
  });
});
