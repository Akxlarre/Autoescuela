import { TestBed } from '@angular/core/testing';
import { SecretariasFacade } from './secretarias.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';

describe('SecretariasFacade', () => {
  let facade: SecretariasFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let branchFacadeSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn() };
    branchFacadeSpy = { selectedBranchId: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
             order: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null })
        }),
        functions: {
          invoke: vi.fn().mockResolvedValue({ data: null, error: null })
        }
      })
    };

    TestBed.configureTestingModule({
      providers: [
        SecretariasFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy }
      ]
    });

    facade = TestBed.inject(SecretariasFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.secretarias()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalSecretarias()).toBe(0);
  });

  it('selectSecretaria should update signal', () => {
    const sec = { id: 1 } as any;
    facade.selectSecretaria(sec);
    expect(facade.selectedSecretaria()).toBe(sec);
  });
});
