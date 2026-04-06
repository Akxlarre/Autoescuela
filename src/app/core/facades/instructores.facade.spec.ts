import { TestBed } from '@angular/core/testing';
import { InstructoresFacade } from './instructores.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('InstructoresFacade', () => {
  let facade: InstructoresFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    toastSpy = jasmine.createSpyObj('ToastService', ['error', 'success']);

    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          is: jasmine.createSpy('is').and.returnValue({
            order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          }),
          eq: jasmine.createSpy('eq').and.returnValue({
             order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          }),
          order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
        })
      }),
      functions: {
        invoke: jasmine.createSpy('invoke').and.resolveTo({ data: null, error: null })
      }
    };

    TestBed.configureTestingModule({
      providers: [
        InstructoresFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy }
      ]
    });

    facade = TestBed.inject(InstructoresFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.instructores()).toEqual([]);
    expect(facade.isLoading()).toBeFalse();
    expect(facade.totalInstructores()).toBe(0);
  });

  it('selectInstructor should update selectedInstructor signal', () => {
    const inst = { id: 1 } as any;
    facade.selectInstructor(inst);
    expect(facade.selectedInstructor()).toBe(inst);
  });
});
