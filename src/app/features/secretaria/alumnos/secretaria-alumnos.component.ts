import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';

@Component({
  selector: 'app-secretaria-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AlumnosListContentComponent, IconComponent],
  template: `
    <div class="p-6 max-w-[1600px] mx-auto">
      <!-- Breadcrumbs -->
      <div class="flex items-center gap-2 text-sm text-text-muted mb-6">
        <a href="/app/secretaria/dashboard" class="hover:text-text-primary transition-colors"
          >Inicio</a
        >
        <app-icon name="chevron-right" [size]="12" />
        <span class="text-text-primary font-medium">Alumnos</span>
      </div>

      <app-alumnos-list-content
        basePath="/app/secretaria"
        [alumnos]="facade.alumnos()"
        [isLoading]="facade.isLoading()"
        [alumnosPorVencer]="facade.alumnosPorVencer()"
        (refreshRequested)="facade.loadAlumnos()"
      />
    </div>
  `,
})
export class SecretariaAlumnosComponent implements OnInit {
  protected readonly facade = inject(AdminAlumnosFacade);

  ngOnInit(): void {
    this.facade.loadAlumnos();
  }
}
