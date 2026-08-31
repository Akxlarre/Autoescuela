import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { SecretariaMatriculaComponent } from '@features/secretaria/matricula/secretaria-matricula.component';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { ExAlumnosContentComponent } from '@shared/components/ex-alumnos-content/ex-alumnos-content.component';
import { AdminExAlumnosTasasDrawerComponent } from './components/stats/admin-ex-alumnos-tasas-drawer.component';
import { AdminExAlumnosComentariosDrawerComponent } from './components/comments/admin-ex-alumnos-comentarios-drawer.component';

/**
 * Smart Component — Ex-Alumnos Clase B (Admin) (spec 0007-i).
 *
 * Reducido a cablear ExAlumnosFacade + BranchFacade + LayoutDrawerFacadeService +
 * ConfirmModalService + Router/ActivatedRoute. Toda la tabla/búsqueda/período/paginación
 * mobile vive en <app-ex-alumnos-content> (shared/, 93% del código que antes estaba
 * duplicado con SecretariaExAlumnosComponent — ver plan.md de 0007-i).
 */
@Component({
  selector: 'app-admin-ex-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExAlumnosContentComponent],
  template: `
    <app-ex-alumnos-content
      [egresados]="facade.egresadosClaseBList()"
      [isLoading]="facade.isLoading()"
      basePath="/app/admin"
      (reEnrollRequested)="reEnroll($event)"
      (requestVerTasas)="openTasasDrawer()"
      (requestComentario)="openComentariosDrawer()"
    />
  `,
})
export class AdminExAlumnosComponent {
  protected readonly facade = inject(ExAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.loadEgresados();
    });
  }

  protected openTasasDrawer(): void {
    this.layoutDrawer.open(
      AdminExAlumnosTasasDrawerComponent,
      'Tasas de Aprobación',
      'trending-up',
    );
  }

  protected openComentariosDrawer(): void {
    this.layoutDrawer.open(
      AdminExAlumnosComentariosDrawerComponent,
      'Opiniones de Egresados',
      'message-square',
    );
  }

  /** Re-matricula a un egresado: muestra confirmación y luego abre el wizard con datos precargados. */
  protected async reEnroll(egresado: EgresadoTableRow): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Re-matricular alumno',
      message: `Se abrirá el formulario de nueva matrícula con los datos personales de <strong>${egresado.nombre}</strong> precargados. Podrás seleccionar un curso nuevo antes de continuar.`,
      severity: 'info',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    if (egresado.branchId !== null) {
      this.branchFacade.selectBranch(egresado.branchId);
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { rut: egresado.rut },
      queryParamsHandling: 'merge',
    });
    this.layoutDrawer.open(SecretariaMatriculaComponent, 'Nueva Matrícula', 'plus');
  }
}
