import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlumnosListContentComponent } from '@shared/components/alumnos-list-content/alumnos-list-content.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-secretaria-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AlumnosListContentComponent, IconComponent],
  template: `
    <div class="p-6 max-w-[1600px] mx-auto">
      <!-- Breadcrumbs -->
      <div class="flex items-center gap-2 text-sm text-text-muted mb-6">
        <a href="/app/secretaria/dashboard" class="hover:text-text-primary transition-colors">Inicio</a>
        <app-icon name="chevron-right" [size]="12" />
        <span class="text-text-primary font-medium">Alumnos</span>
      </div>

      <app-alumnos-list-content basePath="/app/secretaria" />
    </div>
  `,
})
export class SecretariaAlumnosComponent { }
