import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { ExAlumnosProfesionalContentComponent } from '@shared/components/ex-alumnos-profesional-content/ex-alumnos-profesional-content.component';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';

@Component({
  selector: 'app-admin-ex-alumnos-profesional',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExAlumnosProfesionalContentComponent],
  template: `
    <app-ex-alumnos-profesional-content
      [egresados]="facade.egresadosProfesionalList()"
      [isLoading]="facade.isLoading()"
      backRoute="/app/admin/clase-profesional/alumnos"
      (reEnroll)="reEnroll($event)"
    />
  `,
})
export class AdminExAlumnosProfesionalComponent implements OnInit, OnDestroy {
  protected readonly facade = inject(ExAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly router = inject(Router);
  private readonly confirmModal = inject(ConfirmModalService);

  /** Re-matricula a un egresado profesional: muestra confirmación y abre el wizard con datos precargados. */
  protected async reEnroll(egresado: EgresadoTableRow): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Re-matricular alumno',
      message: `Se abrirá el formulario de nueva matrícula con los datos personales de <strong>${egresado.nombre}</strong> precargados. Podrás seleccionar un curso nuevo antes de continuar.`,
      severity: 'info',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    void this.router.navigate(['/app/admin/matricula'], { queryParams: { rut: egresado.rut } });
  }

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.loadEgresados();
    });
  }

  ngOnInit(): void {
    // fix-028: fuerza una sede con Clase Profesional (deshabilita "Todas"/sedes sin profesional).
    this.branchFacade.setProfessionalOnly(true);
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }
}
