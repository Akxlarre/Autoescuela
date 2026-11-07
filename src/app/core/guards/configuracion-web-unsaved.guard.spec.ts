import { TestBed } from '@angular/core/testing';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { configuracionWebUnsavedGuard } from './configuracion-web-unsaved.guard';

describe('configuracionWebUnsavedGuard (fix-495-m)', () => {
  const confirmStub = { confirm: vi.fn() };

  function run(dirty: boolean): boolean | Promise<boolean> {
    const component = { hasUnsavedChanges: () => dirty };
    return TestBed.runInInjectionContext(() =>
      configuracionWebUnsavedGuard(component, null as never, null as never, null as never),
    ) as boolean | Promise<boolean>;
  }

  beforeEach(() => {
    confirmStub.confirm.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: ConfirmModalService, useValue: confirmStub }],
    });
  });

  it('sin cambios sin publicar, deja salir sin preguntar', () => {
    expect(run(false)).toBe(true);
    expect(confirmStub.confirm).not.toHaveBeenCalled();
  });

  it('con cambios, pregunta y respeta la respuesta', async () => {
    confirmStub.confirm.mockResolvedValue(true);
    await expect(run(true)).resolves.toBe(true);
    confirmStub.confirm.mockResolvedValue(false);
    await expect(run(true)).resolves.toBe(false);
    expect(confirmStub.confirm).toHaveBeenCalledTimes(2);
  });
});
