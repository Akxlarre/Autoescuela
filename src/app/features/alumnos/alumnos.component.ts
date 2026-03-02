import { Component, ChangeDetectionStrategy } from '@angular/core';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-alumnos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent],
  template: `
    <div class="page-centered">
      <header class="page-header">
        <div class="flex items-center gap-3">
          <app-icon name="users" [size]="22" />
          <div>
            <h1 class="font-display text-2xl font-bold text-text-primary">Alumnos</h1>
            <p class="m-0 text-sm text-text-muted">Gestión de alumnos matriculados</p>
          </div>
        </div>
      </header>
      <div class="page-content">
        <app-empty-state
          message="Módulo en construcción"
          subtitle="Los alumnos matriculados aparecerán aquí."
          icon="users"
          actionLabel="Nuevo alumno"
          actionIcon="plus"
        />
      </div>
    </div>
  `,
})
export class AlumnosComponent {}
