import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';

// Facades
import { FlotaFacade } from '@core/facades/flota.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// Shared Components
import { FlotaListContentComponent } from '@shared/components/flota-list-content/flota-list-content.component';

// Drawer Contents
import { VehicleFormDrawerComponent } from './vehicle-form-drawer/vehicle-form-drawer.component';
import { VehicleAgendaDrawerComponent } from './vehicle-agenda-drawer/vehicle-agenda-drawer.component';
import { VehicleDocumentsDrawerComponent } from './vehicle-documents-drawer/vehicle-documents-drawer.component';

/**
 * AdminFlotaComponent — Smart Page (Admin)
 *
 * Wrapper delgado que inyecta FlotaFacade y delega el renderizado
 * al componente reutilizable FlotaListContentComponent.
 */
@Component({
  selector: 'app-admin-flota',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FlotaListContentComponent],
  template: `
    <app-flota-list-content
      basePath="/app/admin"
      [vehicles]="facade.filteredVehicles()"
      [kpis]="facade.kpis()"
      [isLoading]="facade.isLoading()"
      (refreshRequested)="facade.init()"
      (newVehicle)="openVehicleForm()"
      (editVehicle)="openVehicleForm($event)"
      (viewAgenda)="openAgenda($event)"
      (manageDocuments)="openDocuments($event)"
      (typeFilterChange)="facade.setTypeFilter($event)"
      (statusFilterChange)="facade.setStatusFilter($event)"
      (searchChange)="onLocalSearch($event)"
    />
  `,
})
export class AdminFlotaComponent {
  protected readonly facade = inject(FlotaFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly localSearchTerm = signal('');

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  protected onLocalSearch(term: string): void {
    // Aquí podrías implementar búsqueda client-side si el facade no lo hace,
    // pero FlotaFacade ya suele filtrar por señales.
    console.log('Buscando:', term);
  }

  protected openVehicleForm(id?: number): void {
    this.facade.selectVehicle(id ?? null);
    this.layoutDrawer.open(
      VehicleFormDrawerComponent,
      id ? 'Editar Vehículo' : 'Nuevo Vehículo',
      'car',
    );
  }

  protected openAgenda(id: number): void {
    this.facade.selectVehicle(id);
    this.layoutDrawer.open(VehicleAgendaDrawerComponent, 'Agenda del Vehículo', 'calendar');
  }

  protected openDocuments(id: number): void {
    this.facade.selectVehicle(id);
    this.layoutDrawer.open(
      VehicleDocumentsDrawerComponent,
      'Documentación del Vehículo',
      'file-text',
    );
  }
}
