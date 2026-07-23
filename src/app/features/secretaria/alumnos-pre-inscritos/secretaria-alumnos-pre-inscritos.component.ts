import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { AdminPreInscritosFacade } from '@core/facades/admin-pre-inscritos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { PreInscritosContentComponent } from '@shared/components/pre-inscritos-content/pre-inscritos-content.component';
import { AdminPreInscritoDrawerComponent } from '../../admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type { PreInscritoTableRow } from '@core/models/ui/pre-inscrito-table.model';

@Component({
  selector: 'app-secretaria-alumnos-pre-inscritos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PreInscritosContentComponent],
  template: `
    <app-pre-inscritos-content
      [preInscritos]="facade.preInscritos()"
      [isLoading]="facade.isLoading()"
      [heroKpis]="heroKpis()"
      [maxVisible]="maxVisible()"
      [showSede]="false"
      backRoute="/app/secretaria/clase-profesional/alumnos"
      backLabel="Alumnos Profesional"
      [embedded]="embedded()"
      (closeRequested)="closeRequested.emit()"
      (rowSelected)="openDrawer($event)"
    />
  `,
})
export class SecretariaAlumnosPreInscritosComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(AdminPreInscritosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly layoutService = inject(LayoutService);

  // Densidad adaptativa (spec 0028/0032): sin limite en desktop, 6 filas +
  // "Cargar mas" en tablet/mobile o con el drawer lateral abierto (tier por contenedor).
  protected readonly maxVisible = computed(() =>
    this.layoutService.tier() === 'desktop' ? null : 6,
  );

  /** Vista embebida — ver AdminPreInscritosComponent.embedded para el detalle. */
  readonly embedded = input(false);
  readonly closeRequested = output<void>();

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    { id: 'total', label: 'Total Pre-inscritos', value: this.facade.total(), icon: 'users' },
    {
      id: 'pendientes',
      label: 'Sin Evaluar Test',
      value: this.facade.pendientesTest(),
      icon: 'clock',
      color: 'warning',
    },
    {
      id: 'aprobados',
      label: 'Aptos (Pendiente Matricula)',
      value: this.facade.aprobados(),
      icon: 'check-circle',
      color: 'success',
    },
  ]);

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
    void this.facade.initialize();
  }

  ngOnDestroy(): void {
    // Embebido: el padre (SecretariaAlumnosProfesionalComponent) sigue montado
    // y ya gestiona professionalOnly.
    if (!this.embedded()) {
      this.branchFacade.setProfessionalOnly(false);
    }
  }

  protected openDrawer(row: PreInscritoTableRow): void {
    this.facade.select(row);
    this.facade.resetPromocionesCache();
    this.layoutDrawer.open(AdminPreInscritoDrawerComponent, row.nombreCompleto, 'eye');
  }
}
