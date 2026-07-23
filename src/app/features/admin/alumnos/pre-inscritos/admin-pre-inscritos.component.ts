import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  OnInit,
  OnDestroy,
  computed,
  effect,
} from '@angular/core';
import { AdminPreInscritosFacade } from '@core/facades/admin-pre-inscritos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { LayoutService } from '@core/services/ui/layout.service';
import { PreInscritosContentComponent } from '@shared/components/pre-inscritos-content/pre-inscritos-content.component';
import { AdminPreInscritoDrawerComponent } from './admin-pre-inscrito-drawer.component';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type { PreInscritoTableRow } from '@core/models/ui/pre-inscrito-table.model';

@Component({
  selector: 'app-admin-pre-inscritos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PreInscritosContentComponent],
  template: `
    <app-pre-inscritos-content
      [preInscritos]="facade.preInscritos()"
      [isLoading]="facade.isLoading()"
      [heroKpis]="heroKpis()"
      [maxVisible]="maxVisible()"
      [showSede]="true"
      backRoute="/app/admin/clase-profesional/alumnos"
      backLabel="Alumnos Profesional"
      [embedded]="embedded()"
      (closeRequested)="closeRequested.emit()"
      (rowSelected)="openDrawer($event)"
    />
  `,
})
export class AdminPreInscritosComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(AdminPreInscritosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly layoutService = inject(LayoutService);

  // Densidad adaptativa (spec 0028/0032): sin limite en desktop, 6 filas +
  // "Cargar mas" en tablet/mobile o con el drawer lateral abierto (tier por contenedor).
  protected readonly maxVisible = computed(() =>
    this.layoutService.tier() === 'desktop' ? null : 6,
  );

  /**
   * Vista embebida (spec: unificar apertura con "Papelera"): cuando es `true`,
   * el padre (AdminAlumnosProfesionalComponent) renderiza este componente
   * como vista condicional en lugar de navegar — la URL nunca cambia de
   * /clase-profesional/alumnos. El botón "volver" pasa de routerLink a
   * `closeRequested` y el padre NO resetea `professionalOnly` al destruirse
   * (el padre sigue montado y ya lo gestiona él mismo).
   */
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

  constructor() {
    // Re-carga al cambiar sede
    effect(() => {
      const _ = this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  ngOnInit(): void {
    // fix-028: fuerza una sede con Clase Profesional (deshabilita "Todas"/sedes sin profesional).
    this.branchFacade.setProfessionalOnly(true);
    void this.facade.initialize();
  }

  ngOnDestroy(): void {
    // Embebido: el padre (AdminAlumnosProfesionalComponent) sigue montado y
    // ya gestiona professionalOnly — resetearlo aquí se lo quitaría de abajo.
    if (!this.embedded()) {
      this.branchFacade.setProfessionalOnly(false);
    }
    // Ya no limpiamos el facade aquí, porque el drawer puede seguir abierto
    // mientras navegamos. El componente del drawer (AdminPreInscritoDrawerComponent)
    // se encarga de limpiarlo en su propio ngOnDestroy().
  }

  protected openDrawer(row: PreInscritoTableRow): void {
    this.facade.select(row);
    this.facade.resetPromocionesCache();
    this.layoutDrawer.open(AdminPreInscritoDrawerComponent, row.nombreCompleto, 'eye');
  }
}
