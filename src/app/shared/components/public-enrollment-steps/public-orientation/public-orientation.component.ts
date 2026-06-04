import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

export interface PublicOrientationLink {
  label: string;
  url: string;
  theme: 'azul' | 'roja';
}

@Component({
  selector: 'app-public-orientation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col items-center text-center gap-6 py-6">
      <!-- Icon -->
      <div
        class="flex h-16 w-16 items-center justify-center rounded-2xl"
        style="background: var(--gradient-subtle); border: 1px solid var(--border-default);"
        aria-hidden="true"
      >
        <app-icon name="map-pin" [size]="28" color="var(--ds-brand)" />
      </div>

      <!-- Message -->
      <div class="space-y-2 max-w-sm">
        <h2
          class="font-bold"
          style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
        >
          Accede desde el sitio de tu escuela
        </h2>
        <p class="text-sm" style="color: var(--text-secondary); line-height: 1.6;">
          Para inscribirte, ingresa al sitio web de tu autoescuela y haz clic en
          <strong style="color: var(--text-primary);">"Inscribirme"</strong>. La inscripción queda
          vinculada a tu sede desde el primer momento.
        </p>
      </div>

      <!-- School links -->
      @if (siteLinks().length > 0) {
        <nav
          class="flex flex-col sm:flex-row gap-3 w-full max-w-sm"
          aria-label="Sitios de las escuelas disponibles"
        >
          @for (link of siteLinks(); track link.url) {
            <a
              [href]="link.url"
              target="_self"
              class="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-semibold text-sm transition-all"
              style="
                background: var(--gradient-subtle);
                border: 1.5px solid var(--border-default);
                color: var(--text-primary);
                text-decoration: none;
              "
              [attr.data-llm-nav]="'enrollment-site-' + link.theme"
              [attr.aria-label]="'Ir al sitio de ' + link.label"
            >
              <app-icon name="external-link" [size]="15" color="var(--ds-brand)" />
              {{ link.label }}
            </a>
          }
        </nav>
      }

      <!-- Trust note -->
      <p class="text-xs" style="color: var(--text-muted); max-width: 22rem;">
        El proceso de inscripción está disponible únicamente a través del sitio oficial de cada
        autoescuela.
      </p>
    </div>
  `,
})
export class PublicOrientationComponent {
  readonly siteLinks = input<PublicOrientationLink[]>([]);
}
