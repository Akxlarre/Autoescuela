import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { DailyAgendaDrawerComponent } from './daily-agenda-drawer.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LiveClassModel } from '@core/models/ui/dashboard.model';

function buildClass(overrides: Partial<LiveClassModel> = {}): LiveClassModel {
  return {
    id: 'prac-1',
    originalId: 1,
    classNumber: 3,
    studentName: 'Ana Pérez',
    instructorName: 'Instructor Torres',
    timeLabel: '08:30 - 09:15',
    status: 'pending',
    type: 'practical',
    vehicle: 'Nissan Versa - RTRE29',
    scheduledAt: '2026-08-05T08:30:00',
    studentId: 10,
    kmStart: null,
    ...overrides,
  };
}

describe('DailyAgendaDrawerComponent', () => {
  let component: DailyAgendaDrawerComponent;
  let dataSignal: ReturnType<typeof signal>;
  let pushSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dataSignal = signal({ liveClasses: [] as LiveClassModel[] });
    pushSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [DailyAgendaDrawerComponent],
      providers: [
        {
          provide: DashboardFacade,
          useValue: {
            data: dataSignal,
            loading: signal(false),
          },
        },
        {
          provide: AsistenciaClaseBFacade,
          useValue: { selectPractica: vi.fn() },
        },
        {
          provide: AgendaFacade,
          useValue: { setSelectedSlot: vi.fn() },
        },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { push: pushSpy, close: vi.fn() },
        },
      ],
    });

    component = TestBed.createComponent(DailyAgendaDrawerComponent).componentInstance;
  });

  it('muestra todas las clases de hoy sin límite de budget', () => {
    const classes = Array.from({ length: 12 }, (_, i) =>
      buildClass({ id: `prac-${i}`, originalId: i }),
    );
    dataSignal.set({ liveClasses: classes });

    expect(component.classes().length).toBe(12);
  });

  it('delega el click de una clase al mismo flujo de acción que el dashboard (informativo → push AgendaSlotDetailDrawerComponent)', async () => {
    await component.handleClassAction(buildClass({ status: 'completed' }));

    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][1]).toBe('Clase: Ana Pérez');
    expect(pushSpy.mock.calls[0][2]).toBe('calendar-clock');
  });

  describe('lectura fallida (spec 0060-b T1.4)', () => {
    let facade: any;

    function montar(estado: { data: unknown; error?: string; refreshFailed?: boolean }) {
      facade = {
        data: signal(estado.data),
        loading: signal(false),
        error: signal(estado.error ?? null),
        refreshFailed: signal(estado.refreshFailed ?? false),
        refreshing: signal(false),
        reintentar: vi.fn(),
      };
      TestBed.overrideProvider(DashboardFacade, { useValue: facade });
      TestBed.overrideComponent(DailyAgendaDrawerComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      });
      const fixture = TestBed.createComponent(DailyAgendaDrawerComponent);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [DailyAgendaDrawerComponent],
        providers: [
          { provide: DashboardFacade, useValue: {} },
          { provide: AsistenciaClaseBFacade, useValue: { selectPractica: vi.fn() } },
          { provide: AgendaFacade, useValue: { setSelectedSlot: vi.fn() } },
          { provide: LayoutDrawerFacadeService, useValue: { push: vi.fn(), close: vi.fn() } },
        ],
      });
    });

    it('caso A: error con Reintentar en vez de un panel vacío', () => {
      const host = montar({ data: null, error: 'Error al cargar' });

      expect(host.querySelector('app-live-classes-panel')).toBeNull();
      const vacio = host.querySelector('app-empty-state') as HTMLElement;
      expect(vacio.getAttribute('actionLabel')).toBe('Reintentar');
      vacio.dispatchEvent(new CustomEvent('action'));
      expect(facade.reintentar).toHaveBeenCalledTimes(1);
    });

    it('caso B: las clases se quedan, con el aviso dentro del panel', () => {
      const host = montar({ data: { liveClasses: [buildClass()] }, refreshFailed: true });

      expect(host.querySelector('app-live-classes-panel app-alert-card')).not.toBeNull();
      (
        host.querySelector('[data-llm-action="reintentar-agenda-hoy"]') as HTMLButtonElement
      ).click();
      expect(facade.reintentar).toHaveBeenCalledTimes(1);
    });

    it('con la carga bien no muestra avisos', () => {
      const host = montar({ data: { liveClasses: [buildClass()] } });

      expect(host.querySelector('app-alert-card')).toBeNull();
      expect(host.querySelector('app-empty-state')).toBeNull();
    });
  });
});
