import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { AbsencePenaltyConfigFacade } from '@core/facades/absence-penalty-config.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';

/**
 * Drawer de la cancelación automática por inasistencias (spec 0048-b).
 * Un interruptor por sede. El admin los cambia; la secretaria ve el estado de su sede en solo
 * lectura (el facade ya filtra las filas por rol y expone `canEdit`).
 *
 * Se abre desde `AjustesDrawerComponent` vía `LayoutDrawerFacadeService`, como
 * `TarifaInstructoresDrawerComponent`.
 */
@Component({
  selector: 'app-penalizacion-inasistencias-drawer',
  standalone: true,
  imports: [
    FormsModule,
    ToggleSwitchModule,
    IconComponent,
    SkeletonBlockComponent,
    DrawerFormComponent,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      <div class="shrink-0 border-b border-border-subtle p-5 mb-4">
        <h2 class="text-lg font-bold text-text-primary">
          Cancelación automática por inasistencias
        </h2>
        <p class="mt-1 text-sm text-text-muted">
          Con 2 inasistencias seguidas, el sistema cancela todas las clases que le quedan agendadas
          al alumno. Cada noche, las clases que nadie inició quedan como inasistencia.
        </p>
      </div>

      <app-drawer-form>
        <div class="space-y-4">
          @if (config.isLoading()) {
            <app-skeleton-block variant="rect" width="100%" height="64px" />
            <app-skeleton-block variant="rect" width="100%" height="64px" />
          } @else if (config.rows().length === 0) {
            <app-empty-state icon="building-2" message="No hay configuración disponible." />
          } @else {
            <div class="space-y-2">
              <!-- track con renderVersion: si guardar falla, recrea la fila para que el switch
                   vuelva al valor real (ngModel no se re-escribe si el valor no cambió). -->
              @for (row of config.rows(); track row.branchId + '-' + renderVersion()) {
                <div class="card p-3.5 flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="item-title truncate">{{ row.branchName }}</p>
                    <p class="text-xs text-text-muted">
                      @if (row.enabled) {
                        Activa desde el {{ formatDate(row.enabledSince) }}. Solo cuentan las
                        inasistencias desde esa fecha.
                      } @else {
                        Desactivada: las inasistencias se registran, pero no se cancela la agenda.
                      }
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    @if (config.savingBranchId() === row.branchId) {
                      <app-icon
                        name="loader-circle"
                        [size]="14"
                        class="animate-spin text-text-muted"
                      />
                    }
                    <p-toggleswitch
                      [inputId]="'auto-cancel-' + row.branchId"
                      [ngModel]="row.enabled"
                      (ngModelChange)="onToggle(row.branchId, $event)"
                      [disabled]="!config.canEdit() || config.savingBranchId() !== null"
                      [ariaLabel]="'Cancelación automática en ' + row.branchName"
                      data-llm-action="toggle-auto-cancel-absences"
                      data-llm-description="toggle the automatic schedule cancellation after 2 consecutive absences for this branch"
                    />
                  </div>
                </div>
              }
            </div>

            @if (!config.canEdit()) {
              <p class="text-xs text-text-muted">Solo el administrador puede cambiar esta regla.</p>
            }
          }
        </div>

        <ng-container ngProjectAs="[drawer-form-footer]">
          <button type="button" class="btn-secondary" (click)="close()">Cerrar</button>
        </ng-container>
      </app-drawer-form>
    </div>
  `,
})
export class PenalizacionInasistenciasDrawerComponent {
  protected readonly config = inject(AbsencePenaltyConfigFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    void this.config.load();
  }

  protected readonly renderVersion = signal(0);

  protected async onToggle(branchId: number, enabled: boolean): Promise<void> {
    const ok = await this.config.setEnabled(branchId, enabled);
    if (!ok) this.renderVersion.update((v) => v + 1);
  }

  protected formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('es-CL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Santiago',
    }).format(new Date(iso));
  }

  protected close(): void {
    this.layoutDrawer.back();
  }
}
