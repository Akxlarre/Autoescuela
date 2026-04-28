import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// Facades & Models
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

/**
 * VehicleDocumentsDrawerComponent — Contenido dinámico para el LayoutDrawer.
 * Muestra los documentos legales asociados a un vehículo.
 */
@Component({
  selector: 'app-vehicle-documents-drawer',
  standalone: true,
  imports: [CommonModule, IconComponent, SkeletonBlockComponent, DrawerContentLoaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-4 px-6 py-6">
          <app-skeleton-block variant="rect" width="100%" height="72px" />
          <app-skeleton-block variant="rect" width="100%" height="72px" />
          <app-skeleton-block variant="rect" width="100%" height="72px" />
        </div>
      </ng-template>
      <ng-template #content>
      <!-- Header Info -->
      <div
        class="shrink-0 px-6 py-4 border-b flex items-center justify-between"
        style="border-color: var(--border-subtle);"
      >
        <h3 class="text-sm font-bold text-text-primary">Documentación Obligatoria</h3>
      </div>

      <!-- Lista de Documentos -->
      <div class="flex-1 overflow-y-auto px-6 py-6">
        @if (isLoading()) {
          <div class="flex flex-col items-center justify-center py-20 gap-3 text-text-muted">
            <app-icon name="loader-2" [size]="32" class="animate-spin" />
            <p class="text-sm">Cargando documentos...</p>
          </div>
        } @else if (documents().length === 0) {
          <div class="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div
              class="w-16 h-16 rounded-full bg-subtle flex items-center justify-center text-text-muted"
            >
              <app-icon name="file-question" [size]="32" />
            </div>
            <p class="font-bold text-text-primary">Sin documentos registrados</p>
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-4">
            @for (doc of documents(); track doc.type) {
              <div
                class="p-5 rounded-2xl border bg-base flex items-center justify-between group hover:border-ds-brand hover:shadow-sm transition-all duration-300"
              >
                <div class="flex items-center gap-4">
                  <div
                    class="w-12 h-12 rounded-xl bg-ds-brand-muted flex items-center justify-center text-ds-brand"
                  >
                    <app-icon [name]="docIcon(doc.type)" [size]="24" />
                  </div>
                  <div>
                    <h4 class="font-bold text-text-primary text-sm leading-tight mb-0.5">
                      {{ docLabel(doc.type) }}
                    </h4>
                    <p class="text-[11px] font-medium text-text-muted uppercase tracking-wider">
                      Vence: {{ doc.expiryDate | date: 'dd MMM yyyy' }}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <span
                    class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm border"
                    [class.badge-success]="doc.status === 'valid'"
                    [class.badge-error]="doc.status !== 'valid'"
                  >
                    {{ doc.status === 'valid' ? 'Vigente' : 'Vencido' }}
                  </span>
                  <button
                    class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-subtle text-text-muted hover:text-ds-brand transition-colors"
                  >
                    <app-icon name="external-link" [size]="14" />
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Footer -->
      <div
        class="shrink-0 p-6 border-t bg-surface flex items-center justify-end"
        style="border-color: var(--border-subtle);"
      >
        <button type="button" class="btn-primary h-11 px-8" (click)="onClose()">
          Cerrar Panel
        </button>
      </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
  styles: `
    .badge-success {
      background: var(--state-success-bg, rgba(34, 197, 94, 0.1));
      color: var(--state-success, rgb(34, 197, 94));
      border-color: var(--state-success-border, rgba(34, 197, 94, 0.2));
    }
    .badge-error {
      background: var(--state-error-bg, rgba(239, 68, 68, 0.1));
      color: var(--state-error, rgb(239, 68, 68));
      border-color: var(--state-error-border, rgba(239, 68, 68, 0.2));
    }
  `,
})
export class VehicleDocumentsDrawerComponent {
  private readonly flotaFacade = inject(FlotaFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  readonly vehicleId = this.flotaFacade.selectedVehicleId;
  readonly documents = signal<any[]>([]); // Se cargará del Facade
  readonly isLoading = signal(false);

  constructor() {
    effect(() => {
      const id = this.vehicleId();
      if (id) {
        this.loadDocuments(id);
      }
    });
  }

  async loadDocuments(vehicleId: number) {
    this.isLoading.set(true);
    // Para simplificar, obtenemos los documentos del vehículo cargado en el Facade
    const vehicle = this.flotaFacade.vehicles().find((v) => v.id === vehicleId);
    if (vehicle?.documents) {
      this.documents.set(vehicle.documents);
    }
    this.isLoading.set(false);
  }

  docLabel(type: string): string {
    const map: Record<string, string> = {
      soap: 'SOAP',
      technical_inspection: 'Revisión Técnica',
      circulation_permit: 'Permiso de Circulación',
      insurance: 'Seguro',
    };
    return map[type] ?? type;
  }

  docIcon(type: string): string {
    const map: Record<string, string> = {
      soap: 'file-text',
      technical_inspection: 'wrench',
      circulation_permit: 'file-badge',
      insurance: 'shield-check',
    };
    return map[type] ?? 'file';
  }

  onClose() {
    this.layoutDrawer.close();
  }
}
