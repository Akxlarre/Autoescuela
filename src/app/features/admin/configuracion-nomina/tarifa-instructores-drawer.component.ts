import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { PayrollConfigFacade } from '@core/facades/payroll-config.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

/**
 * Drawer de edición de la tarifa por hora equivalente de instructores (spec 0014-m).
 * Global por sede — una fila por sede, no por instructor. Solo Admin (lo monta
 * `AjustesDrawerComponent` bajo `@if (isAdmin())`).
 *
 * Clon estructural de `PreciosCursosDrawerComponent`.
 */
@Component({
  selector: 'app-tarifa-instructores-drawer',
  standalone: true,
  imports: [FormsModule, IconComponent, SkeletonBlockComponent, DrawerFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .field-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
    .field-input--prefixed {
      padding-left: 28px;
    }
    .input-prefix-wrapper {
      position: relative;
    }
    .input-prefix {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-muted);
      pointer-events: none;
    }
    /* Botón compacto de fila: el DS no tiene variante de tamaño de btn-primary
       y ARCH-16 prohíbe mutilar su padding/font. */
    .btn-row-save {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      cursor: pointer;
      border: none;
      border-radius: var(--radius-md);
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
      padding: 6px 12px;
      font-size: var(--text-xs);
      font-weight: 600;
      transition: var(--transition-btn);
    }
    .btn-row-save:hover:not(:disabled) {
      background: var(--btn-primary-bg-hover);
    }
    .btn-row-save:disabled {
      cursor: not-allowed;
      background: var(--bg-subtle);
      color: var(--text-muted);
    }
  `,
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      <!-- Header -->
      <div class="shrink-0 border-b border-border-subtle p-5 mb-4">
        <h2 class="text-lg font-bold text-text-primary">Tarifa por Hora de Instructores</h2>
        <p class="mt-1 text-sm text-text-muted">
          Valor en CLP que se paga por cada hora equivalente. Es global por sede: aplica a todos los
          instructores de esa sede.
        </p>
      </div>

      <app-drawer-form>
        <div class="space-y-4">
          @if (payrollConfig.isLoading()) {
            <app-skeleton-block variant="rect" width="100%" height="56px" />
            <app-skeleton-block variant="rect" width="100%" height="56px" />
          } @else if (branchFacade.branches().length === 0) {
            <div
              class="text-center py-8 border border-dashed border-border-default rounded-xl bg-base"
            >
              <app-icon
                name="building-2"
                [size]="24"
                class="text-text-muted mx-auto mb-2 opacity-50"
              />
              <p class="text-sm text-text-muted">No hay sedes registradas.</p>
            </div>
          } @else {
            <div class="space-y-2">
              @for (branch of branchFacade.branches(); track branch.id) {
                <div
                  class="p-3.5 rounded-xl border border-border-default bg-base flex flex-wrap items-center justify-end gap-3"
                >
                  <div class="flex-1 min-w-35">
                    <p class="item-title truncate">{{ branch.name }}</p>
                    <p class="text-xs text-text-muted">
                      Actual: {{ formatCLP(payrollConfig.rateForBranch(branch.id)) }} / hora
                    </p>
                  </div>
                  <div class="input-prefix-wrapper w-36 shrink-0">
                    <span class="input-prefix">$</span>
                    <input
                      type="number"
                      class="field-input field-input--prefixed"
                      [ngModel]="draftRate(branch.id)"
                      (ngModelChange)="setDraft(branch.id, $event)"
                      min="0"
                      step="500"
                      data-llm-description="input for the instructor hourly rate (CLP) for this branch"
                      [attr.aria-label]="'Tarifa por hora de ' + branch.name"
                    />
                  </div>
                  <button
                    type="button"
                    class="btn-row-save"
                    [disabled]="!isDirty(branch.id) || payrollConfig.isSaving()"
                    (click)="save(branch.id)"
                    [attr.aria-label]="'Guardar tarifa de ' + branch.name"
                    data-llm-action="guardar-tarifa-instructor"
                  >
                    @if (savingBranchId() === branch.id) {
                      <app-icon name="loader-circle" [size]="12" class="animate-spin" />
                      <span>Guardando...</span>
                    } @else {
                      <app-icon name="save" [size]="12" />
                      <span>Guardar</span>
                    }
                  </button>
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <ng-container ngProjectAs="[drawer-form-footer]">
          <button type="button" class="btn-secondary" (click)="close()">Cerrar</button>
        </ng-container>
      </app-drawer-form>
    </div>
  `,
})
export class TarifaInstructoresDrawerComponent {
  protected readonly payrollConfig = inject(PayrollConfigFacade);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  /** `null` = el campo está vacío (usuario borrando para escribir un valor nuevo). */
  private readonly drafts = signal<Record<number, number | null>>({});
  protected readonly savingBranchId = signal<number | null>(null);

  constructor() {
    void this.payrollConfig.load();
  }

  protected draftRate(branchId: number): number | null {
    const drafts = this.drafts();
    return branchId in drafts ? drafts[branchId] : this.payrollConfig.rateForBranch(branchId);
  }

  protected setDraft(branchId: number, value: number | null): void {
    this.drafts.update((d) => ({ ...d, [branchId]: value }));
  }

  protected isDirty(branchId: number): boolean {
    const drafts = this.drafts();
    if (!(branchId in drafts)) return false;
    const value = drafts[branchId];
    if (value === null || value < 0) return false;
    return value !== this.payrollConfig.rateForBranch(branchId);
  }

  protected async save(branchId: number): Promise<void> {
    if (!this.isDirty(branchId)) return;
    const value = this.drafts()[branchId];
    if (value == null) return;

    this.savingBranchId.set(branchId);
    const ok = await this.payrollConfig.updateRate(branchId, value);
    this.savingBranchId.set(null);

    if (ok) {
      this.drafts.update((d) => {
        const next = { ...d };
        delete next[branchId];
        return next;
      });
    }
  }

  protected formatCLP(value: number): string {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected close(): void {
    this.layoutDrawer.back();
  }
}
