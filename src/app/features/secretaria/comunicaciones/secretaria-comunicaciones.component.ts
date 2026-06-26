import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';

@Component({
  selector: 'app-secretaria-comunicaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BentoGridLayoutDirective, IconComponent, SectionHeroComponent],
  template: `
    <div class="bento-grid" appBentoGridLayout>
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="false"
        title="Comunicaciones"
        subtitle="Mensajería y avisos para alumnos e instructores"
        [actions]="[]"
      />

      <div
        class="bento-banner card flex flex-col items-center justify-center gap-4 py-16 text-center"
      >
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-subtle">
          <app-icon name="message-square" [size]="28" color="var(--text-muted)" />
        </div>
        <div class="space-y-1">
          <p class="font-semibold text-primary">Próximamente</p>
          <p class="text-sm text-secondary max-w-xs">
            El módulo de comunicaciones está en desarrollo y estará disponible en una próxima
            actualización.
          </p>
        </div>
      </div>
    </div>
  `,
})
export class SecretariaComunicacionesComponent {}
