import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SecretariaDashboardComponent } from './secretaria-dashboard.component';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { PagosFacade } from '@core/facades/pagos.facade';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

describe('SecretariaDashboardComponent', () => {
  let component: SecretariaDashboardComponent;
  let fixture: ComponentFixture<SecretariaDashboardComponent>;
  let branchSig: ReturnType<typeof signal<number | null>>;
  let pagosFacadeSpy: any;
  let cuadraturaFacadeSpy: any;
  let layoutDrawerSpy: any;
  let tierSig: ReturnType<typeof signal<'mobile' | 'tablet' | 'desktop'>>;

  function buildActivity(id: number) {
    return {
      id,
      icon: 'activity',
      iconBg: '#fff',
      iconColor: '#000',
      title: `A${id}`,
      description: '',
      time: '',
    };
  }

  function buildAlert(id: number) {
    return { id, severity: 'warning' as const, title: `Alerta ${id}`, description: '' };
  }

  beforeEach(() => {
    pagosFacadeSpy = {
      seleccionarParaPago: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    };
    cuadraturaFacadeSpy = { egresoTipoPreset: signal<string | null>(null) };
    layoutDrawerSpy = { close: vi.fn(), open: vi.fn(), isOpen: signal(false) };
    tierSig = signal<'mobile' | 'tablet' | 'desktop'>('desktop');
    branchSig = signal<number | null>(null);

    TestBed.configureTestingModule({
      imports: [SecretariaDashboardComponent],
      providers: [
        {
          provide: DashboardFacade,
          useValue: {
            loading: signal(false),
            data: signal({
              hero: undefined,
              kpis: [],
              activities: Array.from({ length: 6 }, (_, i) => buildActivity(i + 1)),
              quickActions: [],
              liveClasses: [],
            }),
            initialize: vi.fn(),
            destroyRealtime: vi.fn(),
          },
        },
        {
          provide: DashboardAlertsFacade,
          useValue: {
            initialize: vi.fn(),
            activeAlerts: signal(Array.from({ length: 5 }, (_, i) => buildAlert(i + 1))),
            alertCount: signal(5),
            dismissAlert: vi.fn(),
          },
        },
        { provide: AuthFacade, useValue: { currentUser: signal(null) } },
        { provide: BranchFacade, useValue: { selectedBranchId: branchSig } },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        { provide: LayoutService, useValue: { tier: tierSig } },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
        { provide: AgendaFacade, useValue: { setSelectedSlot: vi.fn() } },
        { provide: AsistenciaClaseBFacade, useValue: { selectPractica: vi.fn() } },
        { provide: PagosFacade, useValue: pagosFacadeSpy },
        { provide: CuadraturaFacade, useValue: cuadraturaFacadeSpy },
      ],
    });

    // Plantilla vacía: los tests miran decisiones del componente, no su render (y Vitest no
    // compila los inputs de señal de los hijos — ver vitest.config.ts).
    TestBed.overrideComponent(SecretariaDashboardComponent, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(SecretariaDashboardComponent);
    component = fixture.componentInstance;
  });

  // ─── fix-403-m: sigue a la sede seleccionada y libera el canal Realtime ────
  describe('ciclo de vida (fix-403-m)', () => {
    const dashboard = () => TestBed.inject(DashboardFacade) as any;
    const alerts = () => TestBed.inject(DashboardAlertsFacade) as any;

    it('al entrar carga una sola vez el dashboard y las alertas', () => {
      fixture.detectChanges();

      expect(dashboard().initialize).toHaveBeenCalledTimes(1);
      expect(alerts().initialize).toHaveBeenCalledTimes(1);
    });

    it('recarga los dos cuando cambia la sede seleccionada', () => {
      fixture.detectChanges();

      branchSig.set(2);
      fixture.detectChanges();

      expect(dashboard().initialize).toHaveBeenCalledTimes(2);
      expect(alerts().initialize).toHaveBeenCalledTimes(2);
    });

    it('no recarga por cambios que no son de sede (p. ej. termina de cargar)', () => {
      fixture.detectChanges();

      dashboard().loading.set(true);
      fixture.detectChanges();
      dashboard().loading.set(false);
      fixture.detectChanges();

      expect(dashboard().initialize).toHaveBeenCalledTimes(1);
    });

    it('al salir de la pantalla cierra el canal Realtime del dashboard', () => {
      fixture.detectChanges();
      expect(dashboard().destroyRealtime).not.toHaveBeenCalled();

      fixture.destroy();

      expect(dashboard().destroyRealtime).toHaveBeenCalledTimes(1);
    });
  });

  // ─── fix-399-m: los KPIs del hero llevan separador de miles ────────────────
  describe('heroKpis (fix-399-m)', () => {
    it('formatea el valor con separador de miles: $1234567 se lee $1.234.567', () => {
      const facade = TestBed.inject(DashboardFacade) as any;
      facade.data.update((d: object) => ({
        ...d,
        kpis: [
          { id: 'revenue', label: 'Ingresos Mes', value: 1_234_567, prefix: '$' },
          { id: 'classes', label: 'Clases Hoy', value: 0 },
        ],
      }));

      const [revenue, classes] = component.heroKpis();
      expect(`${revenue.prefix}${revenue.value}${revenue.suffix ?? ''}`).toBe('$1.234.567');
      expect(classes.value).toBe('0');
    });
  });

  // ─── fix-080: Registrar Pago abre el drawer real (no navega a /pagos) ──────
  describe('handleQuickAction("qa3") (fix-080)', () => {
    it('llama pagosFacade.seleccionarParaPago(null) e initialize() de forma síncrona', () => {
      component.handleQuickAction('qa3');

      expect(pagosFacadeSpy.seleccionarParaPago).toHaveBeenCalledWith(null);
      expect(pagosFacadeSpy.initialize).toHaveBeenCalled();
    });
  });

  // ─── fix-124-b: "Registrar Egreso" (qa4) era un botón fantasma (sin rama) ──
  describe('handleQuickAction("qa4") (fix-124-b)', () => {
    it('fija cuadraturaFacade.egresoTipoPreset en "combustible" de forma síncrona', () => {
      component.handleQuickAction('qa4');

      expect(cuadraturaFacadeSpy.egresoTipoPreset()).toBe('combustible');
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

  // ─── fix-123-b (ASG-b-065): densidad adaptativa app-like ───────────────────
  describe('densidad adaptativa (fix-123-b)', () => {
    describe('desktop (tier=desktop)', () => {
      it('liveClassesBudget es null → sin límite', () => {
        expect(component.liveClassesBudget()).toBeNull();
      });

      it('visibleActivities muestra todas las actividades (6)', () => {
        expect(component.visibleActivities().length).toBe(6);
      });

      it('visibleAlerts muestra todas las alertas (5)', () => {
        expect(component.visibleAlerts().length).toBe(5);
      });
    });

    describe('mobile/tablet (tier=mobile)', () => {
      beforeEach(() => tierSig.set('mobile'));

      it('liveClassesBudget se recorta a 4', () => {
        expect(component.liveClassesBudget()).toBe(4);
      });

      it('visibleActivities se recorta a 3', () => {
        expect(component.visibleActivities().length).toBe(3);
      });

      it('visibleAlerts se recorta a 3', () => {
        expect(component.visibleAlerts().length).toBe(3);
      });
    });

    it('isDrawerOpen refleja LayoutDrawerFacadeService.isOpen()', () => {
      expect((component as any).isDrawerOpen()).toBe(false);

      (layoutDrawerSpy.isOpen as ReturnType<typeof signal>).set(true);

      expect((component as any).isDrawerOpen()).toBe(true);
    });
  });
});
