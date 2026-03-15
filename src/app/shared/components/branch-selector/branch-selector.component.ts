import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { BranchOption } from '@core/models/ui/branch.model';

/**
 * BranchSelectorComponent — Selector de sede para el wizard de matrícula.
 *
 * Solo visible para el rol Admin (que puede matricular en cualquier sede).
 * Las secretarias están ancladas a su sede y nunca ven este componente.
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
      <div class="flex gap-2">
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
            [class.hover:border-brand]="selectedBranchId() !== branch.id"
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
  branchChange = output<number>();
}
