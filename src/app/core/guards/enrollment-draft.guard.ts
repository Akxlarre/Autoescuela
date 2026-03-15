import { inject } from '@angular/core';
import type { CanDeactivateFn } from '@angular/router';
import { EnrollmentFacade } from '@core/facades/enrollment.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

/**
 * Guard funcional que previene la navegación accidental fuera del wizard
 * de matrícula cuando hay un borrador en progreso.
 *
 * Si el enrollment ya fue confirmado (status active/completed) o no hay
 * draft activo, permite la navegación sin interrupciones.
 * Usa `ConfirmModalService` para mostrar un modal propio del design system
 * en lugar del `window.confirm` nativo del navegador.
 */
export const enrollmentDraftGuard: CanDeactivateFn<unknown> = () => {
  const facade = inject(EnrollmentFacade);
  const confirmModal = inject(ConfirmModalService);
  const draft = facade.draft();

  // No bloquear si no hay draft activo
  if (!draft.enrollmentId) return true;

  // No bloquear si ya se confirmó la matrícula
  const status = facade.enrollmentStatus();
  if (status === 'active' || status === 'completed') return true;

  // Wizard en progreso → modal custom del design system
  return confirmModal.confirm({
    title: '¿Deseas salir?',
    message:
      'Hay una matrícula en progreso. Podrás retomarla más tarde desde la lista de borradores.',
    severity: 'warn',
    confirmLabel: 'Sí, salir',
    cancelLabel: 'Quedarse',
  });
};
