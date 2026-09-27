import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
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
  const alerts = { activeAlerts: signal([]), initialize: vi.fn().mockResolvedValue(undefined) };
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
  return { component: component as any, facade, branch, kpis, drawer };
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
});
