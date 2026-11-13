import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AjustesDrawerComponent } from './ajustes-drawer.component';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConsentsFacade } from '@core/facades/consents.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ThemeService } from '@core/services/ui/theme.service';
import { AgendaSettingsService } from '@core/services/ui/agenda-settings.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

describe('AjustesDrawerComponent (hotfix-188-b)', () => {
  let consentsMock: any;
  let confirmMock: any;

  function promo(id: number, branchId: number, branchName: string, status: string) {
    return {
      id,
      branchId,
      branchName,
      status,
      consentType: 'comunicaciones_promocionales',
      revokedAt: null,
    };
  }

  function setup(role: 'admin' | 'secretaria' | 'instructor' | 'alumno' = 'admin', promos: any[] = []) {
    consentsMock = {
      consents: signal(promos),
      promotionalByBranch: signal(promos),
      isLoading: signal(false),
      isSaving: signal(false),
      loadByUser: vi.fn(),
      revoke: vi.fn().mockResolvedValue(true),
    };
    confirmMock = { confirm: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthFacade,
          useValue: {
            currentUser: signal({
              id: 'u1',
              dbId: 1,
              name: 'Patricio Gómez',
              email: 'admin@test.com',
              role,
              initials: 'PG',
              branchId: null,
              isActive: true,
            }),
          },
        },
        {
          provide: BranchFacade,
          useValue: {
            branches: signal([]),
            selectedBranchId: signal(null),
            lockReason: signal(null),
            disabledBranchIds: signal([]),
            requiresSpecificBranch: signal(false),
            trySelectBranch: vi.fn(),
          },
        },
        {
          provide: ConsentsFacade,
          useValue: consentsMock,
        },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { close: vi.fn(), open: vi.fn(), push: vi.fn() },
        },
        { provide: ThemeService, useValue: { darkMode: signal(false), cycleColorMode: vi.fn() } },
        {
          provide: AgendaSettingsService,
          useValue: { visibilityMonths: signal(3), setVisibilityMonths: vi.fn() },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
        { provide: ConfirmModalService, useValue: confirmMock },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });

    return TestBed.runInInjectionContext(() => new AjustesDrawerComponent()) as any;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('expone las 3 pestañas con íconos para admin', () => {
    const component = setup('admin');
    expect(component.tabs()).toEqual([
      { id: 'perfil', label: 'Mi Perfil', icon: 'user' },
      { id: 'config', label: 'Ajustes', icon: 'settings' },
      { id: 'seguridad', label: 'Seguridad', icon: 'shield' },
    ]);
  });

  it('oculta la pestaña Seguridad para roles distintos de admin', () => {
    const component = setup('secretaria');
    expect(component.tabs()).toEqual([
      { id: 'perfil', label: 'Mi Perfil', icon: 'user' },
      { id: 'config', label: 'Ajustes', icon: 'settings' },
    ]);
  });

  it('setTab cambia la pestaña activa e impide activar seguridad sin rol admin', () => {
    const admin = setup('admin');
    admin.setTab('config');
    expect(admin.activeTab()).toBe('config');
    admin.setTab('seguridad');
    expect(admin.activeTab()).toBe('seguridad');

    TestBed.resetTestingModule();
    const secretaria = setup('secretaria');
    secretaria.setTab('seguridad');
    expect(secretaria.activeTab()).toBe('perfil');
  });

  // spec 0061-b (AC10): un consentimiento promocional por escuela, revocable por separado.
  describe('promociones por escuela (spec 0061-b)', () => {
    const AC = promo(1, 1, 'Autoescuela Chillán', 'otorgado');
    const CC = promo(2, 2, 'Conductores Chillán', 'otorgado');

    it('muestra un consentimiento por escuela', () => {
      const alumno = setup('alumno', [AC, CC]);
      expect(alumno.promotionalConsents().map((c: any) => c.branchName)).toEqual([
        'Autoescuela Chillán',
        'Conductores Chillán',
      ]);
    });

    it('revoca solo el de la escuela elegida', async () => {
      const alumno = setup('alumno', [AC, CC]);
      await alumno.onRevokePromotionalConsent(CC);
      expect(consentsMock.revoke).toHaveBeenCalledTimes(1);
      expect(consentsMock.revoke).toHaveBeenCalledWith(2);
      expect(confirmMock.confirm.mock.calls[0][0].message).toContain('Conductores Chillán');
    });

    it('no revoca uno que no está otorgado', async () => {
      const alumno = setup('alumno', [promo(3, 1, 'Autoescuela Chillán', 'revocado')]);
      await alumno.onRevokePromotionalConsent(alumno.promotionalConsents()[0]);
      expect(consentsMock.revoke).not.toHaveBeenCalled();
    });
  });
});
