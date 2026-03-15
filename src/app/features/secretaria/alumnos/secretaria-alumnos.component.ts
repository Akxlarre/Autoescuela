import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';

@Component({
  selector: 'app-secretaria-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AlumnosListContentComponent],
  template: `
    <app-alumnos-list-content
      basePath="/app/secretaria"
      [alumnos]="facade.alumnos()"
      [isLoading]="facade.isLoading()"
      [alumnosPorVencer]="facade.alumnosPorVencer()"
      (refreshRequested)="facade.loadAlumnos()"
    />
  `,
})
export class SecretariaAlumnosComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosFacade);

  ngOnInit(): void {
    this.facade.loadAlumnos();
  }
}
