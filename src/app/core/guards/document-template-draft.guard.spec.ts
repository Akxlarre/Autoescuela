import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DocumentContentTemplatesFacade } from '@core/facades/document-content-templates.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { documentTemplateDraftGuard } from './document-template-draft.guard';

describe('documentTemplateDraftGuard (fix-469-m)', () => {
  const hasUnsavedChanges = signal(false);
  const facadeStub = { hasUnsavedChanges, discardChanges: vi.fn() };
  const confirmStub = { confirm: vi.fn() };

  function run(): boolean | Promise<boolean> {
    return TestBed.runInInjectionContext(() =>
      documentTemplateDraftGuard(null, null as never, null as never, null as never),
    ) as boolean | Promise<boolean>;
  }

  beforeEach(() => {
    hasUnsavedChanges.set(false);
    facadeStub.discardChanges.mockReset();
    confirmStub.confirm.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentContentTemplatesFacade, useValue: facadeStub },
        { provide: ConfirmModalService, useValue: confirmStub },
      ],
    });
  });

  it('sin cambios sin publicar, deja salir sin preguntar', () => {
    expect(run()).toBe(true);
    expect(confirmStub.confirm).not.toHaveBeenCalled();
  });

  it('con cambios, pregunta; si confirma, sale y descarta el borrador', async () => {
    hasUnsavedChanges.set(true);
    confirmStub.confirm.mockResolvedValue(true);

    await expect(run()).resolves.toBe(true);
    expect(confirmStub.confirm).toHaveBeenCalled();
    expect(facadeStub.discardChanges).toHaveBeenCalled();
  });

  it('con cambios, si se queda, no sale ni descarta', async () => {
    hasUnsavedChanges.set(true);
    confirmStub.confirm.mockResolvedValue(false);

    await expect(run()).resolves.toBe(false);
    expect(facadeStub.discardChanges).not.toHaveBeenCalled();
  });
});
