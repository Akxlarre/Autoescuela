import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { SecretariaMatriculaComponent } from '@features/secretaria/matricula/secretaria-matricula.component';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { escapeHtml } from '@core/utils/html.utils';
import { ExAlumnosContentComponent } from '@shared/components/ex-alumnos-content/ex-alumnos-content.component';
// fix visual (spec 0007-i, AC-E2): alias @features/ en vez de ruta relativa cruzada
// (../../admin/alumnos/ex-alumnos/components/...) hacia la carpeta de otro portal.
import { AdminExAlumnosTasasDrawerComponent } from '@features/admin/alumnos/ex-alumnos/components/stats/admin-ex-alumnos-tasas-drawer.component';
import { AdminExAlumnosComentariosDrawerComponent } from '@features/admin/alumnos/ex-alumnos/components/comments/admin-ex-alumnos-comentarios-drawer.component';

/**
 * Smart Component — Ex-Alumnos Clase B (Secretaria) (spec 0007-i).
 *
 * Reducido a cablear ExAlumnosFacade + LayoutDrawerFacadeService + ConfirmModalService +
 * Router/ActivatedRoute, y BranchFacade solo para recargar cuando una secretaria multi-sede
 * cambia de sede (fix-288-m); la de una sola sede sigue anclada a la suya.
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
      [isExporting]="facade.isExporting()"
      [error]="facade.error()"
      (refreshRequested)="facade.loadEgresados()"
      basePath="/app/secretaria"
      (reEnrollRequested)="reEnroll($event)"
      (requestVerTasas)="openTasasDrawer()"
      (requestComentario)="openComentariosDrawer()"
      (exportRequested)="facade.exportEgresados($event.format, $event.rows)"
    />
  `,
})
export class SecretariaExAlumnosComponent {
  protected readonly facade = inject(ExAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  constructor() {
    // fix-288-m: una secretaria con grant multi-sede tiene selector de sede; la lista se recarga
    // cada vez que lo cambia. La carga inicial también sale de acá (el effect corre una vez al
    // crear el componente), igual que en AdminExAlumnosComponent.
    effect(() => {
      this.branchFacade.selectedBranchId();
      // untracked: loadEgresados() lee otros signals (usuario, error). Si el effect los siguiera,
      // cualquier cambio en ellos dispararía una segunda carga solapada con la primera.
      untracked(() => void this.facade.loadEgresados());
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
      message: `Se abrirá el formulario de nueva matrícula con los datos personales de <strong>${escapeHtml(egresado.nombre)}</strong> precargados. Podrás seleccionar un curso nuevo antes de continuar.`,
      allowHtml: true, // hotfix-062-b: el <strong> es intencional y el nombre va por escapeHtml()
      severity: 'info',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { rut: egresado.rut },
      queryParamsHandling: 'merge',
    });
    this.layoutDrawer.open(SecretariaMatriculaComponent, 'Nueva Matrícula', 'plus');
  }
}
