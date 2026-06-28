import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AlertsDrawerComponent } from './alerts-drawer.component';
import { DashboardAlertsFacade } from '@core/facades/dashboard-alerts.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
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

  const facadeMock = {
    isLoading: isLoading$.asReadonly(),
    alertCount: alertCount$.asReadonly(),
    activeAlerts: activeAlerts$.asReadonly(),
    dismissAlert: vi.fn(),
    clearScheduleForEnrollment: vi.fn().mockResolvedValue(true),
  };

  const routerMock = { navigate: vi.fn().mockResolvedValue(true) };

  beforeEach(() => {
    vi.clearAllMocks();
    activeAlerts$.set([]);
    isLoading$.set(false);
    alertCount$.set(0);

    TestBed.configureTestingModule({
      imports: [AlertsDrawerComponent],
      providers: [
        { provide: DashboardAlertsFacade, useValue: facadeMock },
        { provide: Router, useValue: routerMock },
        { provide: GsapAnimationsService, useValue: gsapMock },
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
    it('should call clearScheduleForEnrollment for each enrollmentId', async () => {
      const alert = makeAlert({
        id: 'b-3',
        action: { type: 'clear-schedule', label: 'Limpiar', enrollmentIds: [10, 20, 30] },
      });

      await component.handleAction(alert);

      expect(facadeMock.clearScheduleForEnrollment).toHaveBeenCalledTimes(3);
      expect(facadeMock.clearScheduleForEnrollment).toHaveBeenCalledWith(10);
      expect(facadeMock.clearScheduleForEnrollment).toHaveBeenCalledWith(20);
      expect(facadeMock.clearScheduleForEnrollment).toHaveBeenCalledWith(30);
    });

    it('should mark alert as processing during clear-schedule and clear after', async () => {
      let processingDuring = false;
      facadeMock.clearScheduleForEnrollment.mockImplementation(async () => {
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

    it('should clear processing state even if clearScheduleForEnrollment throws', async () => {
      facadeMock.clearScheduleForEnrollment.mockRejectedValue(new Error('network'));

      const alert = makeAlert({
        id: 'b-3',
        action: { type: 'clear-schedule', label: 'Limpiar', enrollmentIds: [1] },
      });

      await expect(component.handleAction(alert)).rejects.toThrow('network');
      expect(component.isProcessing('b-3')).toBe(false);
    });

    it('should skip a second call while the first is in flight', async () => {
      let resolveFirst!: () => void;
      facadeMock.clearScheduleForEnrollment.mockReturnValue(
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
      expect(facadeMock.clearScheduleForEnrollment).toHaveBeenCalledTimes(1);

      resolveFirst();
      await first;
    });

    it('should navigate for navigate type without calling clearSchedule', async () => {
      const alert = makeAlert({
        id: 'alert-cash-not-closed',
        action: { type: 'navigate', label: 'Ir', enrollmentIds: [] },
      });

      await component.handleAction(alert);
      expect(facadeMock.clearScheduleForEnrollment).not.toHaveBeenCalled();
      expect(routerMock.navigate).toHaveBeenCalledWith(['/app/admin/cuadratura']);
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
      expect(facadeMock.clearScheduleForEnrollment).not.toHaveBeenCalled();
      expect(routerMock.navigate).not.toHaveBeenCalled();
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
});
