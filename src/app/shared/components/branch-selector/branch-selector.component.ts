import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { BranchOption } from '@core/models/ui/branch.model';

/**
 * BranchSelectorComponent — Selector de sede.
 *
 * Dos modos de uso:
 * - Wizard de matrícula (showAllOption=false): emite siempre un número de sede.
 * - Topbar admin (showAllOption=true): añade la opción "Todas las escuelas" que emite null.
 *
 * Dumb: solo inputs/outputs, sin inyección de servicios.
 */
@Component({
  selector: 'app-branch-selector',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      <p class="text-xs font-medium text-text-muted uppercase tracking-wide">Sede</p>
      <div class="flex gap-2 flex-wrap">
        @if (showAllOption()) {
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
            [class.border-brand]="selectedBranchId() === null"
            [class.bg-brand-muted]="selectedBranchId() === null"
            [class.text-brand]="selectedBranchId() === null"
            [class.border-border-default]="selectedBranchId() !== null"
            [class.bg-surface]="selectedBranchId() !== null"
            [class.text-text-secondary]="selectedBranchId() !== null"
            (click)="branchChange.emit(null)"
            data-llm-action="select-branch-all"
          >
            <app-icon name="globe" [size]="14" />
            Todas las escuelas
          </button>
        }
        @for (branch of branches(); track branch.id) {
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all"
            [class.border-brand]="selectedBranchId() === branch.id"
            [class.bg-brand-muted]="selectedBranchId() === branch.id"
            [class.text-brand]="selectedBranchId() === branch.id"
            [class.border-border-default]="selectedBranchId() !== branch.id"
            [class.bg-surface]="selectedBranchId() !== branch.id"
            [class.text-text-secondary]="selectedBranchId() !== branch.id"
            (click)="branchChange.emit(branch.id)"
            [attr.data-llm-action]="'select-branch-' + branch.slug"
          >
            <app-icon name="building-2" [size]="14" />
            {{ branch.name }}
          </button>
        }
      </div>
    </div>
  `,
})
export class BranchSelectorComponent {
  branches = input.required<BranchOption[]>();
  selectedBranchId = input<number | null>(null);
  /** Muestra la opción "Todas las escuelas" (emite null). Usar en Topbar para admin. */
  showAllOption = input(false);
  branchChange = output<number | null>();
}
