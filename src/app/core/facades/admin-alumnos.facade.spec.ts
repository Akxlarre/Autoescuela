import { TestBed } from '@angular/core/testing';
import { AdminAlumnosFacade } from './admin-alumnos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';

describe('AdminAlumnosFacade', () => {
  let facade: AdminAlumnosFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let branchFacadeSpy: jasmine.SpyObj<BranchFacade>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    branchFacadeSpy = jasmine.createSpyObj('BranchFacade', ['selectedBranchId']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy }
      ]
    });

    facade = TestBed.inject(AdminAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.alumnos()).toEqual([]);
    expect(facade.isLoading()).toBeFalse();
    expect(facade.error()).toBeNull();
  });

  it('clearError should reset error', () => {
    (facade as any)._error.set('error');
    facade.clearError();
    expect(facade.error()).toBeNull();
  });
});
