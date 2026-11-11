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
  function setup(role: 'admin' | 'secretaria' | 'instructor' | 'alumno' = 'admin') {
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
          useValue: {
            consents: signal([]),
            isLoading: signal(false),
            isSaving: signal(false),
            loadByUser: vi.fn(),
          },
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
        { provide: ConfirmModalService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
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
});
