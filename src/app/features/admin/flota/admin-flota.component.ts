import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

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
      [basePath]="basePath"
      [vehicles]="facade.filteredVehicles()"
      [kpis]="facade.kpis()"
      [isLoading]="facade.isLoading()"
      [showSedeColumn]="showSedeColumn()"
      [branches]="branchFacade.branches()"
      (refreshRequested)="facade.init()"
      (newVehicle)="openVehicleForm()"
      (editVehicle)="openVehicleForm($event)"
      (viewAgenda)="openAgenda($event)"
      (manageDocuments)="openDocuments($event)"
      (statusFilterChange)="facade.setStatusFilter($event)"
      (searchChange)="facade.setSearchTerm($event)"
    />
  `,
})
export class AdminFlotaComponent {
  protected readonly facade = inject(FlotaFacade);
  protected readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly destroyRef = inject(DestroyRef);
  /** La misma pantalla sirve al admin y a la secretaria (spec 0051-b): la base sale de la ruta. */
  protected readonly basePath: string =
    inject(ActivatedRoute).snapshot.data['basePath'] ?? '/app/admin';

  /** Columna "Sede" solo tiene sentido cuando se ven vehículos de varias sedes a la vez. */
  protected readonly showSedeColumn = computed(() => this.branchFacade.selectedBranchId() === null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.facade.destroyRealtime();
      // El facade vive más que la página: sin esto, al volver la lista seguiría filtrada con el
      // buscador vacío (hotfix-073-b).
      this.facade.setSearchTerm('');
    });

    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
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
