import { TestBed } from '@angular/core/testing';
import { MenuConfigService } from './menu-config.service';
import { RoleService } from './role.service';

describe('MenuConfigService', () => {
  let service: MenuConfigService;
  let roleService: RoleService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(MenuConfigService);
    roleService = TestBed.inject(RoleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return NavGroup[] (not a flat array)', () => {
    roleService.setRole('admin');
    const groups = service.menuItems();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].group).toBeTruthy();
    expect(Array.isArray(groups[0].items)).toBeTrue();
  });

  it('should return admin nav groups by default', () => {
    roleService.setRole('admin');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.some((r) => r.startsWith('/app/admin/'))).toBeTrue();
  });

  it('should return secretaria nav when role is secretaria', () => {
    roleService.setRole('secretaria');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/secretaria/'))).toBeTrue();
  });

  it('should return instructor nav when role is instructor', () => {
    roleService.setRole('instructor');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/instructor/'))).toBeTrue();
  });

  it('should return alumno nav when role is alumno', () => {
    roleService.setRole('alumno');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/alumno/'))).toBeTrue();
  });

  it('should return relator nav when role is relator', () => {
    roleService.setRole('relator');
    const allRoutes = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
    expect(allRoutes.every((r) => r.startsWith('/app/relator/'))).toBeTrue();
  });

  it('every group should have at least one item', () => {
    const roles = ['admin', 'secretaria', 'instructor', 'alumno', 'relator'] as const;
    for (const role of roles) {
      roleService.setRole(role);
      for (const group of service.menuItems()) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('every nav item should have label, icon and routerLink', () => {
    roleService.setRole('admin');
    const items = service.menuItems().flatMap((g) => g.items);
    for (const item of items) {
      expect(item.label).toBeTruthy();
      expect(item.icon).toBeTruthy();
      expect(item.routerLink).toBeTruthy();
    }
  });

  it('no icon should use pi pi- prefix — must be Lucide names', () => {
    roleService.setRole('admin');
    const items = service.menuItems().flatMap((g) => g.items);
    for (const item of items) {
      expect(item.icon.startsWith('pi ')).toBeFalse();
    }
  });

  it('every routerLink should start with /', () => {
    const roles = ['admin', 'secretaria', 'instructor', 'alumno', 'relator'] as const;
    for (const role of roles) {
      roleService.setRole(role);
      const links = service.menuItems().flatMap((g) => g.items.map((i) => i.routerLink));
      for (const link of links) {
        expect(link.startsWith('/')).toBeTrue();
      }
    }
  });
});
