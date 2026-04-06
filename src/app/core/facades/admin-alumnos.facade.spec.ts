import { TestBed } from '@angular/core/testing';
import { AdminAlumnosFacade } from './admin-alumnos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';

describe('AdminAlumnosFacade', () => {
  let facade: AdminAlumnosFacade;
  let supabaseSpy: any;
  let branchFacadeSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    branchFacadeSpy = { selectedBranchId: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null })
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
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('clearError should reset error', () => {
    (facade as any)._error.set('error');
    facade.clearError();
    expect(facade.error()).toBeNull();
  });
});
