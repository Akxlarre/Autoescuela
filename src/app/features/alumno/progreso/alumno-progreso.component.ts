import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { BadgeComponent } from '@shared/components/badge/badge.component';

@Component({
  selector: 'app-alumno-progreso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, CardHoverDirective],
  template: `
    <div class="p-6">
      <div class="flex items-center gap-3 mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-text-primary">Mi Progreso</h1>
          <p class="text-sm text-text-muted mt-0.5">Mockup: /alumno/progreso</p>
        </div>
        <app-badge variant="warning"> PLANO </app-badge>
      </div>
      <div
        class="card p-8 flex flex-col items-center justify-center gap-2 text-center border-dashed"
        appCardHover
      >
        <p class="text-text-muted text-sm">Pendiente calcar desde mockup</p>
        <code class="text-xs text-text-muted"> mockop/web/src/pages/alumno/progreso.astro </code>
      </div>
    </div>
  `,
})
export class AlumnoProgresoComponent {}
