import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '../icon/icon.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

/**
 * ActionKpiCardComponent — Variante interactiva de app-kpi-card.
 *
 * Diseñado para métricas que disparan acciones (ej: abrir un drawer) o que
 * requieren un contenido personalizado en el valor o footer.
 *
 * Mantiene la consistencia visual total con app-kpi-card:
 * - Aplica .kpi-card .card .card-tinted
 * - Soporta .card-accent
 * - Integra appCardHover (GSAP)
 *
 * @example
 * <app-action-kpi-card
 *   label="Por Vencer"
 *   [value]="8"
 *   icon="alert-triangle"
 *   color="error"
 *   (click)="openDrawer()"
 * >
 *   <div footer class="flex items-center gap-1 text-xs text-text-muted group-hover:text-text-primary transition-colors">
 *     <span>Ver detalles</span>
 *     <app-icon name="arrow-right" [size]="12" />
 *   </div>
 * </app-action-kpi-card>
 */
@Component({
  selector: 'app-action-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, CardHoverDirective],
  styleUrl: './kpi-card.component.scss',
  template: `
    <div
      appCardHover
      class="kpi-card card card-tinted flex flex-col gap-2 h-full cursor-pointer group"
      [class.card-accent]="accent()"
      [class.kpi-card--md]="size() === 'md'"
      [class.kpi-card--sm]="size() === 'sm'"
      [class.kpi-card--success]="color() === 'success'"
      [class.kpi-card--warning]="color() === 'warning'"
      [class.kpi-card--error]="color() === 'error'"
    >
      <!-- Header: label (izquierda) + chip de ícono (derecha) -->
      <div class="flex items-start justify-between gap-3">
        <span class="kpi-label">{{ label() }}</span>
        @if (icon(); as iconName) {
          <div
            class="kpi-card__icon-chip"
            [class.badge-pulse]="pulse()"
            aria-hidden="true"
          >
            <app-icon [name]="iconName" [size]="16" />
          </div>
        }
      </div>

      <!-- Valor principal — animado por GSAP al montar -->
      <p class="kpi-value flex items-baseline gap-0.5" [class.text-error]="color() === 'error'">
        @if (prefix()) {
          <span class="text-2xl font-semibold" style="color: var(--text-secondary)">
            {{ prefix() }}
          </span>
        }
        <span #valueEl>{{ value() }}</span>
        @if (suffix()) {
          <span class="text-2xl font-semibold" style="color: var(--text-secondary)">
            {{ suffix() }}
          </span>
        }
      </p>

      <!-- Slot para footer o contenido adicional (ej: "Ver detalles") -->
      <div class="mt-auto">
        <ng-content select="[footer]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class ActionKpiCardComponent {
  readonly value = input.required<number>();
  readonly label = input.required<string>();
  readonly suffix = input<string>('');
  readonly prefix = input<string>('');
  readonly accent = input<boolean>(false);
  readonly icon = input<string | undefined>(undefined);
  readonly size = input<'lg' | 'md' | 'sm'>('lg');
  readonly color = input<'default' | 'success' | 'warning' | 'error'>('default');
  readonly pulse = input<boolean>(false);

  private readonly valueEl = viewChild.required<ElementRef<HTMLElement>>('valueEl');
  private readonly gsap = inject(GsapAnimationsService);

  constructor() {
    afterNextRender(() => {
      this.gsap.animateCounter(
        this.valueEl().nativeElement,
        this.value(),
        ''
      );
    });
  }
}
