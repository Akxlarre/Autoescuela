import { TestBed } from '@angular/core/testing';
import { SecretariasFacade } from './secretarias.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';

describe('SecretariasFacade', () => {
  let facade: SecretariasFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let branchFacadeSpy: jasmine.SpyObj<BranchFacade>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);
    branchFacadeSpy = jasmine.createSpyObj('BranchFacade', ['selectedBranchId']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          eq: jasmine.createSpy('eq').and.returnValue({
             order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          }),
          order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
        }),
        functions: {
          invoke: jasmine.createSpy('invoke').and.resolveTo({ data: null, error: null })
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
    expect(facade.isLoading()).toBeFalse();
    expect(facade.totalSecretarias()).toBe(0);
  });

  it('selectSecretaria should update signal', () => {
    const sec = { id: 1 } as any;
    facade.selectSecretaria(sec);
    expect(facade.selectedSecretaria()).toBe(sec);
  });
});
