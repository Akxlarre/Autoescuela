import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { SecretariaMatriculaComponent } from '@features/secretaria/matricula/secretaria-matricula.component';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { ExAlumnosContentComponent } from '@shared/components/ex-alumnos-content/ex-alumnos-content.component';
// fix visual (spec 0007-i, AC-E2): alias @features/ en vez de ruta relativa cruzada
// (../../admin/alumnos/ex-alumnos/components/...) hacia la carpeta de otro portal.
import { AdminExAlumnosTasasDrawerComponent } from '@features/admin/alumnos/ex-alumnos/components/stats/admin-ex-alumnos-tasas-drawer.component';
import { AdminExAlumnosComentariosDrawerComponent } from '@features/admin/alumnos/ex-alumnos/components/comments/admin-ex-alumnos-comentarios-drawer.component';

/**
 * Smart Component — Ex-Alumnos Clase B (Secretaria) (spec 0007-i).
 *
 * Reducido a cablear ExAlumnosFacade + LayoutDrawerFacadeService + ConfirmModalService +
 * Router/ActivatedRoute (sin BranchFacade — la Secretaria está anclada a su propia sede).
 * Toda la tabla/búsqueda/período/paginación mobile vive en <app-ex-alumnos-content>
 * (shared/, 93% del código que antes estaba duplicado con AdminExAlumnosComponent — ver
 * plan.md de 0007-i).
 */
@Component({
  selector: 'app-secretaria-ex-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExAlumnosContentComponent],
  template: `
    <app-ex-alumnos-content
      [egresados]="facade.egresadosClaseBList()"
      [isLoading]="facade.isLoading()"
      basePath="/app/secretaria"
      (reEnrollRequested)="reEnroll($event)"
      (requestVerTasas)="openTasasDrawer()"
      (requestComentario)="openComentariosDrawer()"
    />
  `,
})
export class SecretariaExAlumnosComponent implements OnInit {
  protected readonly facade = inject(ExAlumnosFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  ngOnInit(): void {
    void this.facade.loadEgresados();
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
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { rut: egresado.rut },
      queryParamsHandling: 'merge',
    });
    this.layoutDrawer.open(SecretariaMatriculaComponent, 'Nueva Matrícula', 'plus');
  }
}
