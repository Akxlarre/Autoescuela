import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ExAlumnosProfesionalContentComponent } from '@shared/components/ex-alumnos-profesional-content/ex-alumnos-profesional-content.component';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';

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
    />
  `,
})
export class SecretariaExAlumnosProfesionalComponent implements OnInit {
  protected readonly facade = inject(ExAlumnosFacade);

  ngOnInit(): void {
    void this.facade.loadEgresados();
  }
}
