import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { TarifaInstructoresDrawerComponent } from './tarifa-instructores-drawer.component';
import { PayrollConfigFacade } from '@core/facades/payroll-config.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

/** spec 0014-m — lógica de dirty/guardado del drawer de tarifa por hora. */
describe('TarifaInstructoresDrawerComponent', () => {
  function create(rates: Record<number, number> = { 1: 5000, 2: 6500 }) {
    const payrollSpy = {
      isLoading: () => false,
      isSaving: () => false,
      load: vi.fn().mockResolvedValue(undefined),
      rateForBranch: vi.fn((id: number) => rates[id] ?? 5000),
      updateRate: vi.fn().mockResolvedValue(true),
    };
    const branchSpy = {
      branches: () => [
        { id: 1, name: 'Sede A' },
        { id: 2, name: 'Sede B' },
      ],
    };
    const layoutSpy = { back: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: PayrollConfigFacade, useValue: payrollSpy },
        { provide: BranchFacade, useValue: branchSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutSpy },
      ],
    });
    const injector = TestBed.inject(Injector);
    const component = runInInjectionContext(
      injector,
      () => new TarifaInstructoresDrawerComponent(),
    );
    return { component: component as any, payrollSpy, layoutSpy };
  }

  it('carga la config al construirse', () => {
    const { payrollSpy } = create();
    expect(payrollSpy.load).toHaveBeenCalled();
  });

  it('draftRate sin edición devuelve la tarifa vigente de la sede', () => {
    const { component } = create();
    expect(component.draftRate(1)).toBe(5000);
    expect(component.draftRate(2)).toBe(6500);
  });

  it('isDirty: false si el draft es igual a la tarifa vigente', () => {
    const { component } = create();
    component.setDraft(1, 5000);
    expect(component.isDirty(1)).toBe(false);
  });

  it('isDirty: true si el draft difiere y es válido', () => {
    const { component } = create();
    component.setDraft(1, 7000);
    expect(component.isDirty(1)).toBe(true);
  });

  it('AC-E2: isDirty false con valor vacío (null) o negativo', () => {
    const { component } = create();
    component.setDraft(1, null);
    expect(component.isDirty(1)).toBe(false);
    component.setDraft(1, -100);
    expect(component.isDirty(1)).toBe(false);
  });

  it('save: llama updateRate con el valor y limpia el draft al tener éxito', async () => {
    const { component, payrollSpy } = create();
    component.setDraft(1, 7500);

    await component.save(1);

    expect(payrollSpy.updateRate).toHaveBeenCalledWith(1, 7500);
    // draft limpio → vuelve a reflejar la tarifa vigente
    expect(component.isDirty(1)).toBe(false);
  });

  it('save: no llama updateRate si no está dirty', async () => {
    const { component, payrollSpy } = create();
    await component.save(1);
    expect(payrollSpy.updateRate).not.toHaveBeenCalled();
  });

  it('save: si updateRate falla, el draft se mantiene (dirty sigue true)', async () => {
    const { component, payrollSpy } = create();
    payrollSpy.updateRate.mockResolvedValueOnce(false);
    component.setDraft(2, 9000);

    await component.save(2);

    expect(component.isDirty(2)).toBe(true);
  });

  it('close delega en layoutDrawer.back()', () => {
    const { component, layoutSpy } = create();
    component.close();
    expect(layoutSpy.back).toHaveBeenCalled();
  });
});
