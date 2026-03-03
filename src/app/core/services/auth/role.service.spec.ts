import { TestBed } from '@angular/core/testing';
import { RoleService, UserRole } from './role.service';

describe('RoleService', () => {
  let service: RoleService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(RoleService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to admin when sessionStorage is empty', () => {
    expect(service.currentRole()).toBe('admin');
  });

  it('should read initial role from sessionStorage', () => {
    sessionStorage.setItem('devRole', 'instructor');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(RoleService);
    expect(freshService.currentRole()).toBe('instructor');
  });

  it('should update the role signal when setRole is called', () => {
    service.setRole('alumno');
    expect(service.currentRole()).toBe('alumno');
  });

  it('should persist the role to sessionStorage on setRole', () => {
    service.setRole('relator');
    expect(sessionStorage.getItem('devRole')).toBe('relator');
  });

  it('should support all valid roles', () => {
    const roles: UserRole[] = ['admin', 'secretaria', 'instructor', 'alumno', 'relator'];
    for (const role of roles) {
      service.setRole(role);
      expect(service.currentRole()).toBe(role);
    }
  });
});
