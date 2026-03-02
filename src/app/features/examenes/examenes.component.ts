import { Component, ChangeDetectionStrategy } from '@angular/core';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-examenes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, IconComponent],
  template: `
    <div class="page-centered">
      <header class="page-header">
        <div class="flex items-center gap-3">
          <app-icon name="graduation-cap" [size]="22" />
          <div>
            <h1 class="font-display text-2xl font-bold text-text-primary">Exámenes</h1>
            <p class="m-0 text-sm text-text-muted">Control de exámenes teóricos y prácticos</p>
          </div>
        </div>
      </header>
      <div class="page-content">
        <app-empty-state
          message="Módulo en construcción"
          subtitle="Los exámenes registrados aparecerán aquí."
          icon="graduation-cap"
          actionLabel="Nuevo examen"
          actionIcon="plus"
        />
      </div>
    </div>
  `,
})
export class ExamenesComponent {}
