import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';

/**
 * LogoComponent — Abstrae la lógica del logo y nombre de la sede/marca.
 *
 * Muestra dinámicamente el nombre de la sede extraído del BranchFacade/AuthFacade.
 * - Admin sin sede filtrada -> "Autoescuela"
 * - Sede regular -> ej. "Autoescuela Chillán" (leído de la BD)
 * - Sede profesional -> ej. "Conductores Chillán" (leído de la BD)
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center text-center w-full">
      <span class="font-display text-xl font-bold text-brand leading-tight">
        {{ brandText() }}
      </span>
    </div>
  `,
  host: {
    class: 'block',
  },
})
export class LogoComponent {
  private readonly auth = inject(AuthFacade);
  private readonly branchFacade = inject(BranchFacade);

  protected readonly brandText = computed(() => {
    const role = this.auth.currentUser()?.role;
    let activeId: number | null | undefined = null;

    if (role === 'admin') {
      activeId = this.branchFacade.selectedBranchId();
    } else if (role === 'secretaria') {
      activeId = this.auth.currentUser()?.branchId;
    }

    if (!activeId) {
      return 'Autoescuela';
    }

    const branch = this.branchFacade.branches().find((b) => b.id === activeId);
    return branch?.name ?? 'Autoescuela';
  });
}
