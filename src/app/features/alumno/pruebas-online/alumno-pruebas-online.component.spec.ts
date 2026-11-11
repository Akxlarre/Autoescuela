import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlumnoPruebasOnlineComponent } from './alumno-pruebas-online.component';
import { StudentHomeFacade } from '@core/facades/student-home.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { StudentHomeSnapshot } from '@core/models/ui/student-home.model';

function makeSnapshot(licenseGroup: 'class_b' | 'professional'): StudentHomeSnapshot {
  return {
    hero: {
      studentFirstName: 'María',
      enrollmentNumber: 'E-010',
      licenseGroup,
      branchName: 'Sede Centro',
      courseStartDate: '2026-04-01T00:00:00Z',
      enrollmentStatus: 'active',
    },
    progress: {
      practicesCompleted: 4,
      practicesTotal: 12,
      pctTheoryAttendance: 80,
      pctOverall: 40,
      practices: [],
    },
    attendance: { consecutiveAbsences: 0, semaphore: 'green', recentSessions: [] },
    grades: {
      finalExamGrade: null,
      finalExamDate: null,
      passed: null,
      modules: [],
      averageGrade: null,
    },
    certificate: {
      state: 'locked',
      folio: null,
      issuedDate: null,
      pdfUrl: null,
      blockingReason: null,
    },
    side: { nextClass: null, pendingBalance: 0, totalPaid: 0 },
  };
}

describe('AlumnoPruebasOnlineComponent — errores de lectura (0060-b)', () => {
  function setup(opts: {
    snapshot?: StudentHomeSnapshot | null;
    error?: string | null;
    refreshFailed?: boolean;
  }) {
    const snapSig = signal<StudentHomeSnapshot | null>(opts.snapshot ?? null);
    const errorSig = signal<string | null>(opts.error ?? null);
    const refreshFailedSig = signal<boolean>(opts.refreshFailed ?? false);

    const facadeMock = {
      isLoading: signal(false).asReadonly(),
      snapshot: snapSig.asReadonly(),
      error: errorSig.asReadonly(),
      refreshFailed: refreshFailedSig.asReadonly(),
      licenseGroup: () => snapSig()?.hero.licenseGroup ?? null,
      initialize: vi.fn().mockResolvedValue(undefined),
      reintentar: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [AlumnoPruebasOnlineComponent],
      providers: [
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
    }).overrideComponent(AlumnoPruebasOnlineComponent, {
      set: {
        imports: [],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(AlumnoPruebasOnlineComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      facadeMock,
    };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('Caso A: con error y sin snapshot, no asume Clase B y muestra app-empty-state con Reintentar', () => {
    const { fixture, component, facadeMock } = setup({
      snapshot: null,
      error: 'No se pudo cargar tu resumen.',
    });
    const text = fixture.nativeElement.textContent as string;
    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;

    expect(component.showErrorState()).toBe(true);
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.message).toBe('No se pudo cargar tu resumen.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');
    expect(text).not.toContain('Formato del Examen — Licencia Clase B');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(facadeMock.reintentar).toHaveBeenCalledTimes(1);
  });

  it('Caso B: con snapshot cargado y refreshFailed true, mantiene simuladores y muestra app-alert-card con Reintentar', () => {
    const { fixture, component, facadeMock } = setup({
      snapshot: makeSnapshot('class_b'),
      refreshFailed: true,
    });
    const text = fixture.nativeElement.textContent as string;
    const alertEl = fixture.nativeElement.querySelector('app-alert-card') as any;

    expect(component.showErrorState()).toBe(false);
    expect(text).toContain('Formato del Examen — Licencia Clase B');
    expect(alertEl).not.toBeNull();
    expect(alertEl.title).toBe('No se pudo actualizar tu información');

    const retryBtn = fixture.nativeElement.querySelector(
      '[data-llm-action="reintentar-pruebas-online"]',
    ) as HTMLButtonElement | null;
    expect(retryBtn).not.toBeNull();
    retryBtn?.click();
    expect(facadeMock.reintentar).toHaveBeenCalledTimes(1);
  });
});
