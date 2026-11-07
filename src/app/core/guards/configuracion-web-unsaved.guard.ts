import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

/** Lo que el guard necesita de la pantalla de Configuración web. */
export interface HasUnsavedWebConfig {
  hasUnsavedChanges(): boolean;
}

/**
 * fix-495-m: pide confirmación al salir de Configuración web con cambios sin publicar. Antes se
 * perdían sin aviso. Mismo patrón que `documentTemplateDraftGuard` (fix-469-m).
 */
export const configuracionWebUnsavedGuard: CanDeactivateFn<HasUnsavedWebConfig> = (component) => {
  if (!component?.hasUnsavedChanges()) return true;

  return inject(ConfirmModalService).confirm({
    title: '¿Salir sin publicar?',
    message: 'Hay cambios en la configuración web que no se han publicado. Si sales, se pierden.',
    severity: 'warn',
    confirmLabel: 'Salir sin publicar',
    cancelLabel: 'Quedarse',
  });
};
