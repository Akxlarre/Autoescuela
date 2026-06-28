import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ExAlumnosProfesionalContentComponent } from '@shared/components/ex-alumnos-profesional-content/ex-alumnos-profesional-content.component';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';

@Component({
  selector: 'app-secretaria-ex-alumnos-profesional',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ExAlumnosProfesionalContentComponent],
  template: `
    <app-ex-alumnos-profesional-content
      [egresados]="facade.egresadosProfesionalList()"
      [isLoading]="facade.isLoading()"
      backRoute="/app/secretaria/profesional/alumnos"
      (reEnroll)="reEnroll($event)"
    />
  `,
})
export class SecretariaExAlumnosProfesionalComponent implements OnInit, OnDestroy {
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
    void this.router.navigate(['/app/secretaria/matricula'], {
      queryParams: { rut: egresado.rut },
    });
  }

  ngOnInit(): void {
    // fix-028: con grant, la secretaria se comporta como admin → fuerza sede con profesional.
    this.branchFacade.setProfessionalOnly(true);
    void this.facade.loadEgresados();
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }
}
