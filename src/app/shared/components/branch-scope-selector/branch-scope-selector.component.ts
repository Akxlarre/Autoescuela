import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  isSedeDisabled,
  isBothBranchesVisible,
  isBothBranchesDisabled,
} from '@core/utils/branch-scope-ui.utils';

export interface BranchScopeOption {
  id: number;
  name: string;
}

export interface BranchScopeValue {
  branchId: number | null;
  bothBranches: boolean;
}

/**
 * BranchScopeSelectorComponent — "Sede principal" + checkbox "Trabaja en ambas sedes".
 *
 * Reglas de negocio (spec 0004-m):
 * - Secretaria nunca crea/edita un registro "Ambas" — solo admin puede tocar el scope de sede.
 * - Crear: secretaria no ve el toggle "Ambas" (siempre su propia sede, sin ambigüedad).
 * - Editar: secretaria ve el scope actual (sede + si es "Ambas") pero no puede modificarlo.
 *
 * Dumb: solo input()/output(), sin Facades inyectados.
 */
@Component({
  selector: 'app-branch-scope-selector',
  standalone: true,
  imports: [FormsModule, SelectModule, ToggleSwitchModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <label class="field-label" for="branch-scope-sede">Sede principal *</label>
        <p-select
          inputId="branch-scope-sede"
          [options]="branches()"
          optionLabel="name"
          optionValue="id"
          [ngModel]="branchId()"
          (ngModelChange)="onBranchIdChange($event)"
          [disabled]="sedeDisabled()"
          styleClass="w-full"
          appendTo="body"
          placeholder="Seleccione sede"
          data-llm-description="input for the instructor or vehicle's main branch"
        />
        @if (disabledReason()) {
          <p class="text-xs text-text-muted">{{ disabledReason() }}</p>
        }
      </div>

      @if (bothBranchesVisible()) {
        <div class="flex items-center gap-3">
          <p-toggleswitch
            inputId="branch-scope-both"
            [ngModel]="bothBranches()"
            (ngModelChange)="onBothBranchesChange($event)"
            [disabled]="bothBranchesDisabled()"
            data-llm-description="toggle whether this instructor or vehicle operates in both branches"
          />
          <label class="text-sm text-text-secondary" for="branch-scope-both">
            Trabaja/opera en ambas sedes
          </label>
        </div>
      }
    </div>
  `,
})
export class BranchScopeSelectorComponent {
  readonly branches = input.required<BranchScopeOption[]>();
  readonly branchId = input<number | null>(null);
  readonly bothBranches = input(false);
  readonly role = input.required<string>();
  readonly mode = input.required<'crear' | 'editar'>();
  /** Fuerza el bloqueo del selector de sede más allá de la regla por rol (ej: vehículo con instructor activo asignado). */
  readonly disabledReason = input<string | null>(null);

  readonly valueChange = output<BranchScopeValue>();

  protected readonly sedeDisabled = computed(
    () => isSedeDisabled(this.role()) || this.disabledReason() !== null,
  );
  protected readonly bothBranchesVisible = computed(() =>
    isBothBranchesVisible(this.role(), this.mode()),
  );
  protected readonly bothBranchesDisabled = computed(() => isBothBranchesDisabled(this.role()));

  protected onBranchIdChange(branchId: number): void {
    this.valueChange.emit({ branchId, bothBranches: this.bothBranches() });
  }

  protected onBothBranchesChange(bothBranches: boolean): void {
    this.valueChange.emit({ branchId: this.branchId(), bothBranches });
  }
}
