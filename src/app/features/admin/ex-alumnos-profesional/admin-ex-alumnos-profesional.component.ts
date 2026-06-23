import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { ExAlumnosProfesionalContentComponent } from '@shared/components/ex-alumnos-profesional-content/ex-alumnos-profesional-content.component';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';

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
    />
  `,
})
export class AdminExAlumnosProfesionalComponent {
  protected readonly facade = inject(ExAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.loadEgresados();
    });
  }
}
