import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertsDrawerComponent } from './alerts-drawer.component';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { AlertModel } from '@core/models/ui/dashboard.model';

const makeAlert = (overrides: Partial<AlertModel> = {}): AlertModel => ({
  id: 'test-id',
  title: 'Test alert',
  description: 'Description',
  severity: 'info',
  ...overrides,
});

const gsapMock = {
  createShimmer: vi.fn(),
  animateBentoGrid: vi.fn(),
  animateHero: vi.fn(),
  animateCounter: vi.fn(),
  addCardHover: vi.fn(),
  clearProps: vi.fn(),
};

describe('AlertsDrawerComponent', () => {
  let component: AlertsDrawerComponent;

  const activeAlerts$ = signal<AlertModel[]>([]);
  const isLoading$ = signal(false);
  const alertCount$ = signal(0);
  const loadProblem$ = signal<string | null>(null);
  const refreshFailed$ = signal(false);

  const facadeMock = {
    isLoading: isLoading$.asReadonly(),
    alertCount: alertCount$.asReadonly(),
    activeAlerts: activeAlerts$.asReadonly(),
    loadProblem: loadProblem$.asReadonly(),
    refreshFailed: refreshFailed$.asReadonly(),
    dismissAlert: vi.fn(),
    clearSchedules: vi.fn().mockResolvedValue(true),
    reintentar: vi.fn().mockResolvedValue(undefined),
  };

  const routerMock = {
    navigate: vi.fn().mockResolvedValue(true),
    navigateByUrl: vi.fn().mockResolvedValue(true),
  };
  const currentUser$ = signal<{ role: string } | null>({ role: 'admin' });
  const drawerMock = { close: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    activeAlerts$.set([]);
    isLoading$.set(false);
    alertCount$.set(0);
    loadProblem$.set(null);
    refreshFailed$.set(false);
    currentUser$.set({ role: 'admin' });

    TestBed.configureTestingModule({
      imports: [AlertsDrawerComponent],
      providers: [
        { provide: DashboardAlertsFacade, useValue: facadeMock },
        { provide: Router, useValue: routerMock },
        { provide: GsapAnimationsService, useValue: gsapMock },
        { provide: AuthFacade, useValue: { currentUser: currentUser$ } },
        { provide: LayoutDrawerFacadeService, useValue: drawerMock },
      ],
    });

    component = TestBed.createComponent(AlertsDrawerComponent).componentInstance;
  });

  // ── sortedAlerts ────────────────────────────────────────────────────────────

  describe('sortedAlerts', () => {
    it('should order error → warning → info → success', () => {
      activeAlerts$.set([
        makeAlert({ id: 's', severity: 'success' }),
        makeAlert({ id: 'w', severity: 'warning' }),
        makeAlert({ id: 'e', severity: 'error' }),
        makeAlert({ id: 'i', severity: 'info' }),
      ]);

      const order = component.sortedAlerts().map((a) => a.severity);
      expect(order).toEqual(['error', 'warning', 'info', 'success']);
    });

    it('should preserve insertion order for equal severity', () => {
      activeAlerts$.set([
        makeAlert({ id: 'first', severity: 'warning' }),
        makeAlert({ id: 'second', severity: 'warning' }),
      ]);

      const ids = component.sortedAlerts().map((a) => a.id);
      expect(ids).toEqual(['first', 'second']);
    });

    it('should return empty array when no alerts', () => {
      activeAlerts$.set([]);
      expect(component.sortedAlerts()).toEqual([]);
    });

    it('should not mutate the original facade signal array', () => {
      const original = [
        makeAlert({ id: 'a', severity: 'success' }),
        makeAlert({ id: 'b', severity: 'error' }),
      ];
      activeAlerts$.set(original);

      component.sortedAlerts();
      expect(component.sortedAlerts()[0].id).toBe('b'); // sorted copy
      expect(facadeMock.activeAlerts()[0].id).toBe('a'); // original unchanged
    });
  });

  // ── isProcessing ────────────────────────────────────────────────────────────

  describe('isProcessing', () => {
    it('should return false for any id initially', () => {
      expect(component.isProcessing('any-alert')).toBe(false);
    });
  });

  // ── dismiss ─────────────────────────────────────────────────────────────────

  describe('dismiss', () => {
    it('should delegate to facade.dismissAlert with correct id', () => {
      component.dismiss('alert-xyz');
      expect(facadeMock.dismissAlert).toHaveBeenCalledOnce();
      expect(facadeMock.dismissAlert).toHaveBeenCalledWith('alert-xyz');
    });
  });

  // ── handleAction ────────────────────────────────────────────────────────────

  describe('handleAction', () => {
    it('delega en una sola llamada a clearSchedules con todas las matrículas (fix-364-m)', async () => {
      const alert = makeAlert({
        id: 'b-3',
        action: { type: 'clear-schedule', label: 'Limpiar', enrollmentIds: [10, 20, 30] },
      });

      await component.handleAction(alert);

      expect(facadeMock.clearSchedules).toHaveBeenCalledTimes(1);
      expect(facadeMock.clearSchedules).toHaveBeenCalledWith([10, 20, 30]);
    });

    it('should mark alert as processing during clear-schedule and clear after', async () => {
      let processingDuring = false;
      facadeMock.clearSchedules.mockImplementation(async () => {
        processingDuring = component.isProcessing('b-3');
        return true;
      });

      const alert = makeAlert({
        id: 'b-3',
        action: { type: 'clear-schedule', label: 'Limpiar', enrollmentIds: [1] },
      });

      await component.handleAction(alert);

      expect(processingDuring).toBe(true);
      expect(component.isProcessing('b-3')).toBe(false);
    });

    it('should clear processing state even if clearSchedules throws', async () => {
      facadeMock.clearSchedules.mockRejectedValue(new Error('network'));

      const alert = makeAlert({
        id: 'b-3',
        action: { type: 'clear-schedule', label: 'Limpiar', enrollmentIds: [1] },
      });

      await expect(component.handleAction(alert)).rejects.toThrow('network');
      expect(component.isProcessing('b-3')).toBe(false);
    });

    it('should skip a second call while the first is in flight', async () => {
      let resolveFirst!: () => void;
      facadeMock.clearSchedules.mockReturnValue(
        new Promise<boolean>((res) => {
          resolveFirst = () => res(true);
        }),
      );

      const alert = makeAlert({
        id: 'b-3',
        action: { type: 'clear-schedule', label: 'Limpiar', enrollmentIds: [1] },
      });

      const first = component.handleAction(alert);
      await component.handleAction(alert); // second call while first is running
      expect(facadeMock.clearSchedules).toHaveBeenCalledTimes(1);

      resolveFirst();
      await first;
    });

    it('should navigate for navigate type without calling clearSchedule', async () => {
      const alert = makeAlert({
        id: 'alert-cash-not-closed',
        action: { type: 'navigate', label: 'Ir', enrollmentIds: [] },
      });

      await component.handleAction(alert);
      expect(facadeMock.clearSchedules).not.toHaveBeenCalled();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/app/admin/contabilidad/cuadratura']);
    });

    describe('"Ir a Cuadratura" según el rol (fix-401-m)', () => {
      const cajaSinCerrar = () =>
        makeAlert({
          id: 'alert-cash-not-closed',
          action: { type: 'navigate', label: 'Ir a Cuadratura' },
        });

      it('la secretaria va a su propia Cuadratura', async () => {
        currentUser$.set({ role: 'secretaria' });

        await component.handleAction(cajaSinCerrar());

        expect(routerMock.navigate).toHaveBeenCalledWith([
          '/app/secretaria/contabilidad/cuadratura',
        ]);
      });

      it('el admin va a la suya', async () => {
        await component.handleAction(cajaSinCerrar());

        expect(routerMock.navigate).toHaveBeenCalledWith(['/app/admin/contabilidad/cuadratura']);
      });

      it('cierra el drawer al navegar', async () => {
        await component.handleAction(cajaSinCerrar());

        expect(drawerMock.close).toHaveBeenCalledTimes(1);
      });
    });

    it('should not navigate for unknown alert IDs', async () => {
      const alert = makeAlert({
        id: 'unknown-alert',
        action: { type: 'navigate', label: 'Ir', enrollmentIds: [] },
      });

      await component.handleAction(alert);
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });

    it('should do nothing when alert has no action', async () => {
      await component.handleAction(makeAlert({ id: 'no-action' }));
      expect(facadeMock.clearSchedules).not.toHaveBeenCalled();
      expect(routerMock.navigate).not.toHaveBeenCalled();
    });
  });

  describe('casos de la alerta (spec 0056-b, AC6)', () => {
    it('"Ver clases" despliega y vuelve a plegar solo esa alerta', () => {
      expect(component.isExpanded('alert-class-b-holiday')).toBe(false);

      component.toggleDetails('alert-class-b-holiday');
      expect(component.isExpanded('alert-class-b-holiday')).toBe(true);
      expect(component.isExpanded('otra')).toBe(false);

      component.toggleDetails('alert-class-b-holiday');
      expect(component.isExpanded('alert-class-b-holiday')).toBe(false);
    });

    it('una fila cierra el drawer y va a la ficha del alumno', () => {
      component.openDetail('/app/secretaria/alumnos/55');

      expect(drawerMock.close).toHaveBeenCalledTimes(1);
      expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/app/secretaria/alumnos/55');
    });
  });

  // ── helper methods ──────────────────────────────────────────────────────────

  describe('getSeverityIcon', () => {
    it('should return the correct Lucide icon name per severity', () => {
      expect(component.getSeverityIcon('error')).toBe('circle-alert');
      expect(component.getSeverityIcon('warning')).toBe('triangle-alert');
      expect(component.getSeverityIcon('success')).toBe('check-circle');
      expect(component.getSeverityIcon('info')).toBe('info');
      expect(component.getSeverityIcon('unknown')).toBe('info');
    });
  });

  describe('getSeverityColor', () => {
    it('should return a CSS variable string per severity', () => {
      expect(component.getSeverityColor('error')).toBe('var(--state-error)');
      expect(component.getSeverityColor('warning')).toBe('var(--state-warning)');
      expect(component.getSeverityColor('success')).toBe('var(--state-success)');
      expect(component.getSeverityColor('info')).toBe('var(--state-info)');
      expect(component.getSeverityColor('unknown')).toBe('var(--state-info)');
    });
  });

  describe('getSeverityIconClass', () => {
    it('should return the correct Tailwind token class per severity', () => {
      expect(component.getSeverityIconClass('error')).toBe('bg-error-subtle text-error');
      expect(component.getSeverityIconClass('warning')).toBe('bg-warning-subtle text-warning');
      expect(component.getSeverityIconClass('success')).toBe('bg-success-subtle text-success');
      expect(component.getSeverityIconClass('info')).toBe('bg-info-subtle text-info');
      expect(component.getSeverityIconClass('unknown')).toBe('bg-info-subtle text-info');
    });
  });

  describe('getActionIcon', () => {
    it('should return the correct Lucide icon name per action type', () => {
      expect(component.getActionIcon('clear-schedule')).toBe('calendar-x');
      expect(component.getActionIcon('navigate')).toBe('arrow-right');
      expect(component.getActionIcon('close-cash')).toBe('lock');
      expect(component.getActionIcon('unknown')).toBe('arrow-right');
    });
  });

  describe('Lecturas fallidas — Caso A y Caso B (spec 0060-b T3.3)', () => {
    function mountDom() {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [AlertsDrawerComponent],
        providers: [
          { provide: DashboardAlertsFacade, useValue: facadeMock },
          { provide: Router, useValue: routerMock },
          { provide: GsapAnimationsService, useValue: gsapMock },
          { provide: AuthFacade, useValue: { currentUser: currentUser$ } },
          { provide: LayoutDrawerFacadeService, useValue: drawerMock },
        ],
      }).overrideComponent(AlertsDrawerComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      });
      const fixture = TestBed.createComponent(AlertsDrawerComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('Caso A: cuando falla la carga inicial, no muestra "0 alertas activas" ni "Todo en orden" y ofrece Reintentar', () => {
      loadProblem$.set('No se pudieron revisar las alertas.');
      activeAlerts$.set([]);
      alertCount$.set(0);

      const fixture = mountDom();
      const text = fixture.nativeElement.textContent as string;
      const retryBtn = fixture.nativeElement.querySelector(
        '[data-llm-action="reintentar-alertas-drawer"]',
      ) as HTMLButtonElement | null;

      expect(text).not.toContain('0 alertas activas');
      expect(text).not.toContain('Todo en orden');
      expect(text).toContain('No se pudieron revisar las alertas.');
      expect(retryBtn).not.toBeNull();
      retryBtn?.click();
      expect(facadeMock.reintentar).toHaveBeenCalledTimes(1);
    });

    it('Caso B: si falla el refresco con alertas ya visibles, conserva las alertas y muestra app-alert-card con Reintentar', () => {
      activeAlerts$.set([makeAlert({ id: 'a1', title: 'Documento por vencer' })]);
      alertCount$.set(1);
      refreshFailed$.set(true);
      loadProblem$.set(null);

      const fixture = mountDom();
      const text = fixture.nativeElement.textContent as string;
      const alertCard = fixture.nativeElement.querySelector('app-alert-card');
      const retryBtn = fixture.nativeElement.querySelector(
        '[data-llm-action="reintentar-alertas-drawer"]',
      ) as HTMLButtonElement | null;

      expect(text).toContain('Documento por vencer');
      expect(alertCard).not.toBeNull();
      expect(retryBtn).not.toBeNull();
      retryBtn?.click();
      expect(facadeMock.reintentar).toHaveBeenCalledTimes(1);
    });

    it('fix-405-m: con revisiones incompletas y alertas activas muestra las alertas y loadProblem()', () => {
      activeAlerts$.set([makeAlert({ id: 'a1', title: 'Documento por vencer' })]);
      alertCount$.set(1);
      refreshFailed$.set(false);
      loadProblem$.set('No se pudieron revisar todas las alertas.');

      const fixture = mountDom();
      const text = fixture.nativeElement.textContent as string;

      expect(text).toContain('Documento por vencer');
      expect(text).toContain('No se pudieron revisar todas las alertas.');
      expect(text).not.toContain('Todo al día');
    });
  });
});
