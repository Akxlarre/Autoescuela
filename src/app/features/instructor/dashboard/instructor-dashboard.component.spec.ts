import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { InstructorDashboardComponent } from './instructor-dashboard.component';
import { InstructorClasesFacade } from '@core/facades/instructor-clases.facade';
import { InstructorProfileFacade } from '@core/facades/instructor-profile.facade';
import { InstructorHorasFacade } from '@core/facades/instructor-horas.facade';
import type { InstructorClassRow } from '@core/models/ui/instructor-portal.model';

describe('InstructorDashboardComponent — manejo de errores de lectura (0060-b)', () => {
  function setup(options: {
    error?: string | null;
    refreshFailed?: boolean;
    todayClasses?: InstructorClassRow[];
    renderDom?: boolean;
  }) {
    const todayClassesSig = signal<InstructorClassRow[]>(options.todayClasses ?? []);
    const errorSig = signal<string | null>(options.error ?? null);
    const refreshFailedSig = signal<boolean>(options.refreshFailed ?? false);
    const reintentarSpy = vi.fn().mockResolvedValue(undefined);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [InstructorDashboardComponent],
      providers: [
        provideRouter([]),
        {
          provide: InstructorClasesFacade,
          useValue: {
            todayClasses: todayClassesSig.asReadonly(),
            upcomingDays: signal([]).asReadonly(),
            upcomingDaysError: signal<string | null>(null).asReadonly(),
            isLoading: signal(false).asReadonly(),
            error: errorSig.asReadonly(),
            refreshFailed: refreshFailedSig.asReadonly(),
            kpis: signal({
              clasesHoy: todayClassesSig().length,
              completadas: 0,
              pendientes: todayClassesSig().length,
              enCurso: 0,
            }),
            nextClass: signal(null).asReadonly(),
            initialize: vi.fn().mockResolvedValue(undefined),
            reintentar: reintentarSpy,
            dispose: vi.fn(),
          },
        },
        {
          provide: InstructorProfileFacade,
          useValue: {
            vehicle: signal(null).asReadonly(),
            initialize: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: InstructorHorasFacade,
          useValue: {
            isLoading: signal(false).asReadonly(),
            monthlyHours: signal([]).asReadonly(),
            liquidacionKpis: signal({ totalHorasMes: 0 }).asReadonly(),
            fetchMonthlyHours: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    });

    if (options.renderDom) {
      TestBed.overrideComponent(InstructorDashboardComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      });
      const fixture = TestBed.createComponent(InstructorDashboardComponent);
      (fixture.componentInstance as any)._localLoading.set(false);
      fixture.detectChanges();
      return { comp: fixture.componentInstance, fixture, reintentarSpy };
    }

    TestBed.overrideComponent(InstructorDashboardComponent, {
      set: { template: '', imports: [] },
    });

    const fixture = TestBed.createComponent(InstructorDashboardComponent);
    return { comp: fixture.componentInstance, fixture, reintentarSpy };
  }

  it('Caso A: con error y sin clases hoy, heroKpis queda vacío (sin renderizar en 0)', () => {
    const { comp } = setup({
      error: 'No se pudieron cargar las clases del día.',
      todayClasses: [],
    });
    expect(comp.heroKpis()).toEqual([]);
  });

  it('Caso B: con refreshFailed y clases visibles, heroKpis sigue mostrando las métricas', () => {
    const { comp } = setup({
      error: null,
      refreshFailed: true,
      todayClasses: [{ sessionId: 1 } as InstructorClassRow],
    });
    expect(comp.heroKpis()).toHaveLength(4);
  });

  it('render Caso A: muestra app-empty-state con Reintentar que llama clasesFacade.reintentar()', () => {
    const { fixture, reintentarSpy } = setup({
      error: 'No se pudieron cargar las clases del día.',
      todayClasses: [],
      renderDom: true,
    });

    const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.message).toBe('No se pudieron cargar las clases del día.');
    expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');

    emptyEl.dispatchEvent(new CustomEvent('action'));
    expect(reintentarSpy).toHaveBeenCalledTimes(1);

    expect(fixture.nativeElement.textContent).not.toContain(
      'Sin clases programadas los próximos días',
    );
  });

  it('render Caso B: muestra app-alert-card con [data-llm-action="reintentar-clases"] y llama reintentar()', () => {
    const { fixture, reintentarSpy } = setup({
      error: null,
      refreshFailed: true,
      todayClasses: [
        {
          sessionId: 1,
          scheduledAt: '2026-07-29T09:00:00Z',
          timeLabel: '09:00 - 09:45',
          status: 'scheduled',
          statusLabel: 'Agendada',
          statusColor: 'info',
          studentName: 'Ana Soto',
          vehiclePlate: 'AB-CD-12',
          canStart: true,
          canFinish: false,
        } as InstructorClassRow,
      ],
      renderDom: true,
    });

    const alertEl = fixture.nativeElement.querySelector('app-alert-card') as any;
    expect(alertEl).not.toBeNull();
    expect(alertEl.title).toBe('No se pudieron actualizar tus clases');

    const retryBtn = fixture.nativeElement.querySelector(
      '[data-llm-action="reintentar-clases"]',
    ) as HTMLButtonElement | null;
    expect(retryBtn).not.toBeNull();
    retryBtn?.click();
    expect(reintentarSpy).toHaveBeenCalledTimes(1);
  });
});
