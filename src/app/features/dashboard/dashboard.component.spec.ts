import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  NO_ERRORS_SCHEMA,
  signal,
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { ExecutiveDashboardFacade } from '@core/facades/executive-dashboard.facade';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutService } from '@core/services/ui/layout.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { ExecKpiSummary } from '@core/models/ui/executive-dashboard.model';

/**
 * Tests de la lógica del Smart Component (no del template: TestBed no compila templates en
 * este proyecto — ver exclusiones de vitest.config.ts). Se instancia la clase en un contexto
 * de inyección y se verifican sus decisiones.
 */
function setup(opts: { branchId?: number | null; tier?: 'mobile' | 'tablet' | 'desktop' } = {}) {
  const kpis = signal<ExecKpiSummary | null>(null);
  const facade = {
    preset: signal('this_month'),
    range: signal({ from: '2026-09-01', to: '2026-09-27' }),
    isLoading: signal(false),
    isRefreshing: signal(false),
    dataPreset: signal('this_month'),
    kpis,
    receivables: signal(null),
    series: signal(null),
    applyRange: vi.fn().mockResolvedValue(undefined),
    // Como el Facade real: lee signals de forma síncrona antes de su primer await.
    reload: vi.fn(async () => {
      facade.range();
      facade.kpis();
    }),
    sectionError: vi.fn(() => null),
  };
  const branch = {
    selectedBranchId: signal(opts.branchId ?? null),
    selectedBranchLabel: signal('Autoescuela Chillán'),
  };
  const alerts = {
    activeAlerts: signal<any[]>([]),
    isLoading: signal(false),
    loadProblem: signal<string | null>(null),
    refreshFailed: signal(false),
    initialize: vi.fn().mockResolvedValue(undefined),
    reintentar: vi.fn().mockResolvedValue(undefined),
  };
  const drawer = { isOpen: signal(false), open: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      { provide: ExecutiveDashboardFacade, useValue: facade },
      { provide: DashboardAlertsFacade, useValue: alerts },
      { provide: BranchFacade, useValue: branch },
      { provide: LayoutService, useValue: { tier: signal(opts.tier ?? 'desktop') } },
      { provide: LayoutDrawerFacadeService, useValue: drawer },
      { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
    ],
  });

  const component = TestBed.runInInjectionContext(() => new DashboardComponent());
  return { component: component as any, facade, branch, kpis, drawer, alerts };
}

describe('DashboardComponent (dashboard ejecutivo)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('AC2: la línea de contexto dice "Todas las escuelas" sin sede seleccionada', () => {
    const { component } = setup({ branchId: null });
    expect(component.contextLine()).toBe('Clase B · Todas las escuelas · 1 sep – 27 sep 2026');
  });

  it('AC2: con sede seleccionada usa su nombre', () => {
    const { component } = setup({ branchId: 1 });
    expect(component.contextLine()).toContain('Autoescuela Chillán');
  });

  it('AC1: cambiar el período delega en el Facade', () => {
    const { component, facade } = setup();
    const range = { from: '2026-08-01', to: '2026-08-31' };
    component.onRangeChange({ range, preset: 'last_month' });
    expect(facade.applyRange).toHaveBeenCalledWith(range, 'last_month');
  });

  it('sin KPIs cargados no arma tarjetas (se muestran placeholders)', () => {
    const { component } = setup();
    expect(component.kpiCards()).toEqual([]);
  });

  it('con KPIs arma las 8 tarjetas', () => {
    const { component, kpis } = setup();
    const k = {
      value: 1,
      deltaPrev: { pct: null, kind: 'none' },
      deltaYoy: { pct: null, kind: 'none' },
    } as const;
    kpis.set({
      ingresos: k,
      gastos: k,
      gastosDesglose: { variables: 0, fijos: 0, instructores: 0 },
      resultado: k,
      margenPct: null,
      nuevasMatriculas: k,
      alumnosActivos: 0,
      clasesRealizadas: 0,
      clasesEnAgenda: 0,
      tasaCancelacionPct: null,
      aprobacionEnsayosPct: null,
    });
    expect(component.kpiCards()).toHaveLength(8);
    // 4 financieros como tarjetas grandes, 4 operativos en la tira del hero
    expect(component.financeCards().map((c: { id: string }) => c.id)).toEqual([
      'ingresos',
      'gastos',
      'resultado',
      'saldo',
    ]);
    expect(component.heroKpis().map((k: { id: string }) => k.id)).toEqual([
      'matriculas',
      'activos',
      'clases',
      'cancelacion',
    ]);
  });

  it('switch de layout por contenedor: desktop → paneles lado a lado', () => {
    expect(setup({ tier: 'desktop' }).component.isDesktopLayout()).toBe(true);
    TestBed.resetTestingModule();
    expect(setup({ tier: 'tablet' }).component.isDesktopLayout()).toBe(false);
  });

  it('fix-173-b: cambiar el período no re-dispara el effect de sede', () => {
    const { facade, branch } = setup();
    TestBed.tick();
    expect(facade.reload).toHaveBeenCalledTimes(1);

    // applyRange() del Facade real escribe _range: el effect NO debe reaccionar a eso.
    facade.range.set({ from: '2026-08-01', to: '2026-08-31' });
    TestBed.tick();
    expect(facade.reload).toHaveBeenCalledTimes(1);

    // Cambiar de sede sí recarga.
    branch.selectedBranchId.set(2);
    TestBed.tick();
    expect(facade.reload).toHaveBeenCalledTimes(2);
  });

  it('reintentar recarga el Facade', () => {
    const { component, facade } = setup();
    component.retry();
    expect(facade.reload).toHaveBeenCalled();
  });

  it('cambiar de tab', () => {
    const { component } = setup();
    component.setTab('instructores');
    expect(component.activeTab()).toBe('instructores');
  });

  describe('fix-418-m: "hoy" sigue al día de Chile con la pantalla abierta', () => {
    afterEach(() => vi.useRealTimers());

    it('al tocar el filtro después de medianoche, hoy pasa al día nuevo', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-15T02:30:00.000Z')); // 23:30 del 14 en Chile
      const { component } = setup();
      expect(component.today()).toBe('2026-10-14');

      vi.setSystemTime(new Date('2026-10-15T03:30:00.000Z')); // 00:30 del 15 en Chile
      component.refreshToday();
      expect(component.today()).toBe('2026-10-15');
    });

    it('sin cambio de día conserva el valor', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-14T15:00:00.000Z'));
      const { component } = setup();
      vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z'));
      component.refreshToday();
      expect(component.today()).toBe('2026-10-14');
    });
  });

  describe('alertas: Caso A, Caso B y skeleton (spec 0060-b T3.3)', () => {
    async function mountDom(
      overrides: {
        alerts?: any[];
        isLoading?: boolean;
        loadProblem?: string | null;
        refreshFailed?: boolean;
      } = {},
    ) {
      await resolveComponentResources(() => Promise.resolve(''));
      TestBed.resetTestingModule();
      const facade = {
        preset: signal('this_month'),
        range: signal({ from: '2026-09-01', to: '2026-09-27' }),
        isLoading: signal(false),
        isRefreshing: signal(false),
        dataPreset: signal('this_month'),
        kpis: signal(null),
        receivables: signal(null),
        series: signal(null),
        todayOps: signal(null),
        applyRange: vi.fn().mockResolvedValue(undefined),
        reload: vi.fn().mockResolvedValue(undefined),
        sectionError: vi.fn(() => null),
      };
      const alerts = {
        activeAlerts: signal<any[]>(overrides.alerts ?? []),
        isLoading: signal(overrides.isLoading ?? false),
        loadProblem: signal<string | null>(overrides.loadProblem ?? null),
        refreshFailed: signal(overrides.refreshFailed ?? false),
        initialize: vi.fn().mockResolvedValue(undefined),
        reintentar: vi.fn().mockResolvedValue(undefined),
      };
      TestBed.configureTestingModule({
        imports: [DashboardComponent],
        providers: [
          { provide: ExecutiveDashboardFacade, useValue: facade },
          { provide: DashboardAlertsFacade, useValue: alerts },
          {
            provide: BranchFacade,
            useValue: {
              selectedBranchId: signal(null),
              selectedBranchLabel: signal('Chillán'),
            },
          },
          { provide: LayoutService, useValue: { tier: signal('desktop') } },
          {
            provide: LayoutDrawerFacadeService,
            useValue: { isOpen: signal(false), open: vi.fn() },
          },
          { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
        ],
      }).overrideComponent(DashboardComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
          styleUrl: undefined,
          styleUrls: [],
          styles: [],
        },
      });
      const fixture = TestBed.createComponent(DashboardComponent);
      fixture.componentInstance.setTab('hoy');
      fixture.detectChanges();
      return { fixture, component: fixture.componentInstance as any, alerts };
    }

    it('retryAlerts() delega en alertsFacade.reintentar()', () => {
      const { component, alerts } = setup();
      component.retryAlerts();
      expect(alerts.reintentar).toHaveBeenCalledTimes(1);
    });

    it('Caso A: con loadProblem sin alertas no muestra "Todo en orden"', async () => {
      const { fixture, alerts } = await mountDom({
        loadProblem: 'No se pudieron revisar las alertas.',
      });
      const text = fixture.nativeElement.textContent as string;
      const emptyEl = fixture.nativeElement.querySelector('app-empty-state') as any;

      expect(emptyEl).not.toBeNull();
      expect(emptyEl.message).toBe('No se pudieron revisar las alertas.');
      expect(emptyEl.getAttribute('actionLabel')).toBe('Reintentar');
      expect(text).not.toContain('Todo en orden');
      expect(text).not.toContain('0 alertas');

      emptyEl.dispatchEvent(new CustomEvent('action'));
      expect(alerts.reintentar).toHaveBeenCalledTimes(1);
    });

    it('mientras alertsLoading está activo sin alertas no muestra "Todo en orden"', async () => {
      const { fixture } = await mountDom({ isLoading: true });
      const text = fixture.nativeElement.textContent as string;
      const skeletonList = fixture.nativeElement.querySelector('[aria-label="Cargando alertas"]');

      expect(skeletonList).not.toBeNull();
      expect(text).not.toContain('Todo en orden');
    });

    it('Caso B: con refreshFailed y alertas visibles muestra app-alert-card con Reintentar', async () => {
      const { fixture, alerts } = await mountDom({
        alerts: [{ id: 'a1', title: 'Pago vencido', description: 'Detalle', severity: 'warning' }],
        refreshFailed: true,
      });
      const text = fixture.nativeElement.textContent as string;
      const alertCard = fixture.nativeElement.querySelector('app-alert-card');
      const retryBtn = fixture.nativeElement.querySelector(
        '[data-llm-action="reintentar-alertas-dashboard"]',
      ) as HTMLButtonElement | null;

      expect(text).toContain('Pago vencido');
      expect(alertCard).not.toBeNull();
      expect(retryBtn).not.toBeNull();
      retryBtn?.click();
      expect(alerts.reintentar).toHaveBeenCalledTimes(1);
    });
  });
});
