import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { DocumentContentTemplatesFacade } from '@core/facades/document-content-templates.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

/**
 * fix-469-m: pide confirmación al salir de Documentos con cambios sin publicar en el editor de
 * plantillas. Si el admin sale igual, el borrador se descarta: al volver, el editor muestra lo
 * publicado (el facade es singleton y el borrador seguiría en memoria).
 */
export const documentTemplateDraftGuard: CanDeactivateFn<unknown> = () => {
  const facade = inject(DocumentContentTemplatesFacade);
  const confirmModal = inject(ConfirmModalService);

  if (!facade.hasUnsavedChanges()) return true;

  return confirmModal
    .confirm({
      title: '¿Salir sin publicar?',
      message: 'Hay cambios en la plantilla que no se han publicado. Si sales, se pierden.',
      severity: 'warn',
      confirmLabel: 'Salir sin publicar',
      cancelLabel: 'Quedarse',
    })
    .then((leave) => {
      if (leave) facade.discardChanges();
      return leave;
    });
};
