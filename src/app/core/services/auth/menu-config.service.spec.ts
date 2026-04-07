import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MenuConfigService } from './menu-config.service';
import { AuthFacade } from '@core/facades/auth.facade';
import type { User } from '@core/models/dto/user.model';

type UserRole = User['role'];

function makeAuthMock(role: UserRole | null) {
  const currentUser = signal<User | null>(role ? ({ role } as User) : null);
  return { currentUser: currentUser.asReadonly() };
}

describe('MenuConfigService', () => {
  let service: MenuConfigService;
  let authMock: ReturnType<typeof makeAuthMock>;

  function setup(role: UserRole | null = 'admin') {
    authMock = makeAuthMock(role);
    TestBed.configureTestingModule({
      providers: [MenuConfigService, { provide: AuthFacade, useValue: authMock }],
    });
    service = TestBed.inject(MenuConfigService);
  }

  it('should be created', () => {
    setup();
    expect(service).toBeTruthy();
  });

  it('should return NavGroup[] (not a flat array)', () => {
    setup('admin');
    const groups = service.menuItems();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].group).toBeTruthy();
    expect(Array.isArray(groups[0].items)).toBe(true);
  });

  it('should return admin nav groups when role is admin', () => {
    setup('admin');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.some((r) => r.startsWith('/app/admin/'))).toBe(true);
  });

  it('should return secretaria nav when role is secretaria', () => {
    setup('secretaria');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/secretaria/'))).toBe(true);
  });

  it('should return instructor nav when role is instructor', () => {
    setup('instructor');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/instructor/'))).toBe(true);
  });

  it('should return alumno nav when role is alumno', () => {
    setup('alumno');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/alumno/'))).toBe(true);
  });

  it('should return relator nav when role is relator', () => {
    setup('relator');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/relator/'))).toBe(true);
  });

  it('should return empty array when no user is logged in', () => {
    setup(null);
    expect(service.menuItems()).toEqual([]);
  });

  it('every group should have at least one item', () => {
    const roles: UserRole[] = ['admin', 'secretaria', 'instructor', 'alumno', 'relator'];
    for (const role of roles) {
      TestBed.resetTestingModule();
      setup(role);
      for (const group of service.menuItems()) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('every nav item should have label, icon and routerLink', () => {
    setup('admin');
    const items = service.menuItems().flatMap((g) => g.items);
    for (const item of items) {
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.routerLink).toBeTruthy();
    }
  });

  it('no icon should use pi pi- prefix — must be Lucide names', () => {
    setup('admin');
    const items = service.menuItems().flatMap((g) => g.items);
    for (const item of items) {
      expect(item.icon.startsWith('pi ')).toBe(false);
    }
  });

  it('every routerLink should start with /', () => {
    const roles: UserRole[] = ['admin', 'secretaria', 'instructor', 'alumno', 'relator'];
    for (const role of roles) {
      TestBed.resetTestingModule();
      setup(role);
      const links = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
      for (const link of links) {
        expect(link.startsWith('/')).toBe(true);
      }
    }
  });
});
