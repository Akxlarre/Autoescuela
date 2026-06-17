import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

// Facades & Models
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

/**
 * VehicleAgendaDrawerComponent — Contenido dinámico para el LayoutDrawer.
 * Muestra la agenda de clases asociadas a un vehículo específico.
 */
@Component({
  selector: 'app-vehicle-agenda-drawer',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonBlockComponent, DrawerContentLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <!-- Skeleton Header -->
        <div class="shrink-0 px-6 py-4 border-b flex items-center justify-between border-border-subtle">
          <app-skeleton-block variant="text" width="120px" height="20px" />
          <app-skeleton-block variant="text" width="80px" height="16px" />
        </div>
        <!-- Skeleton Body -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <div class="group p-4 rounded-xl border bg-base">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <app-skeleton-block variant="rect" width="48px" height="40px" borderRadius="0.5rem" />
                  <div class="flex flex-col gap-1.5">
                    <app-skeleton-block variant="text" width="120px" height="14px" />
                    <app-skeleton-block variant="text" width="80px" height="10px" />
                  </div>
                </div>
                <app-skeleton-block variant="rect" width="32px" height="32px" borderRadius="0.5rem" />
              </div>
            </div>
          }
        </div>
        <!-- Skeleton Footer -->
        <div class="shrink-0 p-6 border-t bg-surface flex items-center justify-end border-border-subtle">
          <app-skeleton-block variant="rect" width="140px" height="44px" borderRadius="0.5rem" />
        </div>
      </ng-template>
      <ng-template #content>
        <!-- Filtro de Fecha (Simple por ahora) -->
        <div
          class="shrink-0 px-6 py-4 border-b flex items-center justify-between border-border-subtle"
        >
          <h3 class="text-sm font-bold text-text-primary">Agenda del Día</h3>
          <span class="text-xs text-text-muted">{{ today | date: 'dd/MM/yyyy' }}</span>
        </div>

        <!-- Lista de Sesiones -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          @if (flotaFacade.isLoadingAgenda()) {
            <div class="space-y-3">
              @for (_ of [1, 2, 3, 4]; track $index) {
                <div class="group p-4 rounded-xl border bg-base">
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <!-- Hora Box -->
                      <app-skeleton-block variant="rect" width="48px" height="40px" borderRadius="0.5rem" />
                      <!-- Info -->
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="120px" height="14px" />
                        <app-skeleton-block variant="text" width="80px" height="10px" />
                      </div>
                    </div>
                    <!-- Icon right -->
                    <app-skeleton-block variant="rect" width="32px" height="32px" borderRadius="0.5rem" />
                  </div>
                </div>
              }
            </div>
          } @else if (flotaFacade.vehicleAgenda().length === 0) {
            <div class="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div
                class="w-16 h-16 rounded-full bg-subtle flex items-center justify-center text-text-muted"
              >
                <app-icon name="calendar-x" [size]="32" />
              </div>
              <div class="space-y-1">
                <p class="font-bold text-text-primary">Sin datos</p>
              </div>
            </div>
          } @else {
            <div class="space-y-3">
              @for (slot of flotaFacade.vehicleAgenda(); track slot.hour) {
                <div
                  class="group p-4 rounded-xl border bg-base hover:border-ds-brand hover:shadow-sm transition-all cursor-default"
                  [class.opacity-50]="slot.type === 'empty'"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-12 h-10 rounded-lg bg-ds-brand-muted flex items-center justify-center text-ds-brand"
                      >
                        <span class="text-xs font-bold">{{ slot.hour }}</span>
                      </div>
                      <div>
                        @if (slot.type === 'class') {
                          <p class="text-sm font-bold text-text-primary">{{ slot.studentName }}</p>
                          <p class="text-[11px] text-text-muted">Clase B #{{ slot.classNumber }}</p>
                        } @else if (slot.type === 'maintenance') {
                          <p class="text-sm font-bold text-warning">{{ slot.description }}</p>
                          <p class="text-[11px] text-text-muted uppercase tracking-wider">
                            Mantenimiento
                          </p>
                        } @else {
                          <p class="text-sm font-medium text-text-muted">Disponible</p>
                        }
                      </div>
                    </div>

                    @if (slot.type !== 'empty') {
                      <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center bg-subtle text-text-muted"
                      >
                        <app-icon [name]="slot.type === 'class' ? 'user' : 'wrench'" [size]="14" />
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Footer -->
        <div
          class="shrink-0 p-6 border-t bg-surface flex items-center justify-end border-border-subtle"
        >
          <button type="button" class="btn-primary h-11 px-8" (click)="onClose()">
            Cerrar Agenda
          </button>
        </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class VehicleAgendaDrawerComponent {
  protected readonly flotaFacade = inject(FlotaFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  readonly today = new Date();
  readonly vehicleId = this.flotaFacade.selectedVehicleId;

  constructor() {
    effect(() => {
      const id = this.vehicleId();
      if (id) {
        this.flotaFacade.loadVehicleAgenda(id, this.today);
      }
    });
  }

  onClose() {
    this.layoutDrawer.close();
  }
}
