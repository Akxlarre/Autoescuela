import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BreadcrumbService } from './breadcrumb.service';
import { MenuConfigService } from '@core/services/auth/menu-config.service';

@Component({ standalone: true, template: '' })
class StubPage {}

const MOCK_MENU = [
  {
    group: 'Configuración',
    items: [{ label: 'Configuración', icon: 'settings', routerLink: '/settings' }],
  },
  {
    group: 'Dashboard',
    items: [{ label: 'Inicio', icon: 'layout-dashboard', routerLink: '/dashboard' }],
  },
];

describe('BreadcrumbService', () => {
  let service: BreadcrumbService;
  let router: Router;

  beforeEach(() => {
    const menuConfigMock = { menuItems: vi.fn().mockReturnValue(MOCK_MENU) };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: StubPage },
          { path: '**', component: StubPage },
        ]),
        { provide: MenuConfigService, useValue: menuConfigMock },
      ],
    });
    service = TestBed.inject(BreadcrumbService);
    router = TestBed.inject(Router);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it("home should always have routerLink '/'", () => {
    expect(service.breadcrumb().home.routerLink).toBe('/');
  });

  it('home should have a label and an icon', () => {
    expect(service.breadcrumb().home.label).toBeTruthy();
    expect(service.breadcrumb().home.icon).toBeTruthy();
  });

  it("breadcrumb items should be empty on the root route '/'", async () => {
    await router.navigateByUrl('/');
    expect(service.breadcrumb().items.length).toBe(0);
  });

  it("breadcrumb items should contain the matched menu label for '/settings'", async () => {
    await router.navigateByUrl('/settings');
    const items = service.breadcrumb().items;
    // buildFromGroups returns [group-link, active-page] → 2 items
    expect(items.length).toBe(2);
    expect(items.at(-1)?.label).toBe('Configuración');
  });

  it('the active breadcrumb item should have no routerLink (current page)', async () => {
    await router.navigateByUrl('/settings');
    const last = service.breadcrumb().items.at(-1);
    expect(last?.routerLink).toBeUndefined();
  });

  it('breadcrumb items should be empty for an unknown URL', async () => {
    await router.navigateByUrl('/unknown-route-xyz');
    expect(service.breadcrumb().items.length).toBe(0);
  });
});
