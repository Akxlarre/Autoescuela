import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SecretariaDashboardComponent } from './secretaria-dashboard.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

describe('SecretariaDashboardComponent', () => {
  let component: SecretariaDashboardComponent;
  let pagosFacadeSpy: any;
  let layoutDrawerSpy: any;

  beforeEach(() => {
    pagosFacadeSpy = {
      seleccionarParaPago: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    layoutDrawerSpy = { close: vi.fn(), open: vi.fn(), isOpen: signal(false) };

    TestBed.configureTestingModule({
      imports: [SecretariaDashboardComponent],
      providers: [
        {
          provide: DashboardFacade,
          useValue: { loading: signal(false), data: signal(null), initialize: vi.fn() },
        },
        {
          provide: DashboardAlertsFacade,
          useValue: { initialize: vi.fn(), activeAlerts: signal([]), alertCount: signal(0) },
        },
        { provide: AuthFacade, useValue: { currentUser: signal(null) } },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
        { provide: AgendaFacade, useValue: { setSelectedSlot: vi.fn() } },
        { provide: AsistenciaClaseBFacade, useValue: { selectPractica: vi.fn() } },
        { provide: PagosFacade, useValue: pagosFacadeSpy },
      ],
    });

    component = TestBed.createComponent(SecretariaDashboardComponent).componentInstance;
  });

  // ─── fix-080: Registrar Pago abre el drawer real (no navega a /pagos) ──────
  describe('handleQuickAction("qa3") (fix-080)', () => {
    it('llama pagosFacade.seleccionarParaPago(null) e initialize() de forma síncrona', () => {
      component.handleQuickAction('qa3');

      expect(pagosFacadeSpy.seleccionarParaPago).toHaveBeenCalledWith(null);
      expect(pagosFacadeSpy.initialize).toHaveBeenCalled();
    });
  });

  // ─── fix-080: botón "Registrar Pago" con el mismo estilo primary que Admin ─
  describe('heroActions (fix-080)', () => {
    it('marca qa1 y qa3 como primary, igual que el Dashboard de Admin', () => {
      (component as any).dashboardFacade.data.set({
        kpis: [],
        activities: [],
        alerts: [],
        quickActions: [
          { id: 'qa1', icon: 'users', label: 'Matricular' },
          { id: 'qa2', icon: 'calendar', label: 'Agenda' },
          { id: 'qa3', icon: 'credit-card', label: 'Registrar Pago' },
        ],
        systemStatus: [],
      });

      const actions = component.heroActions();

      expect(actions.find((a) => a.id === 'qa1')?.primary).toBe(true);
      expect(actions.find((a) => a.id === 'qa2')?.primary).toBe(false);
      expect(actions.find((a) => a.id === 'qa3')?.primary).toBe(true);
    });
  });
});
