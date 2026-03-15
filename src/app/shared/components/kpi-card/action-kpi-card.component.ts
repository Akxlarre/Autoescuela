import {
  Component,
  ChangeDetectionStrategy,
  computed,
  ElementRef,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '../icon/icon.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';

/**
 * ActionKpiCardComponent — Variante interactiva de app-kpi-card.
 *
 * Diseñado para métricas que disparan acciones (ej: abrir un drawer) o que
 * requieren un contenido personalizado en el valor o footer.
 *
 * Alineado con KpiCardVariantComponent (Dashboard): bento-card, skeleton integrado,
 * appCardHover y [loading] para evitar CLS.
 *
 * @example
 * <app-action-kpi-card
 *   label="Por Vencer"
 *   [value]="8"
 *   icon="alert-triangle"
 *   color="error"
 *   [loading]="loading()"
 *   (click)="openDrawer()"
 * >
 *   <div footer class="flex items-center gap-1 text-xs text-text-muted ...">
 *     <span>Ver detalles</span>
 *     <app-icon name="arrow-right" [size]="12" />
 *   </div>
 * </app-action-kpi-card>
 */
@Component({
  selector: 'app-action-kpi-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, CardHoverDirective, SkeletonBlockComponent],
  styleUrl: './kpi-card.component.scss',
  template: `
    <div
      appCardHover
      class="bento-card flex flex-col gap-2 h-full cursor-pointer group"
      [class.card-accent]="accent()"
      [attr.data-color-variant]="color()"
      [attr.aria-busy]="loading()"
    >
      @if (loading()) {
        <!-- Skeleton: misma estructura que app-kpi-card-variant (Dashboard) -->
        <div class="flex items-start justify-between gap-3 mb-2">
          <app-skeleton-block variant="text" width="60%" height="12px" />
          <app-skeleton-block variant="rect" width="28px" height="28px" />
        </div>
        <app-skeleton-block variant="rect" width="80%" height="40px" />
        <div class="flex items-center gap-2 mt-auto pt-2">
          <app-skeleton-block variant="rect" width="48px" height="18px" />
          <app-skeleton-block variant="text" width="40%" height="12px" />
        </div>
      } @else {
        <!-- Header: label (izquierda) + chip de ícono (derecha) -->
        <div class="flex items-start justify-between gap-3">
          <span class="text-xs font-semibold" [style.color]="labelColor()">{{ label() }}</span>
          @if (icon(); as iconName) {
            <div
              class="flex items-center justify-center rounded-md w-7 h-7"
              [style.background]="iconBg()"
              [style.color]="iconColorStyle()"
              [class.badge-pulse]="pulse()"
              aria-hidden="true"
            >
              <app-icon [name]="iconName" [size]="14" />
            </div>
          }
        </div>

        <!-- Valor principal — animado por GSAP al montar -->
        <p class="flex items-baseline gap-1 m-0 truncate">
          @if (prefix()) {
            <span class="text-2xl md:text-3xl font-bold" style="color: var(--text-primary)">
              {{ prefix() }}
            </span>
          }
          <span
            #valueEl
            class="text-3xl md:text-4xl font-bold"
            [class.text-error]="color() === 'error'"
            [style.color]="color() === 'error' ? 'var(--state-error)' : 'var(--text-primary)'"
            >{{ value() }}</span
          >
          @if (suffix()) {
            <span class="text-2xl md:text-3xl font-bold" style="color: var(--text-primary)">
              {{ suffix() }}
            </span>
          }
        </p>

        <!-- Slot para footer o contenido adicional (ej: "Ver detalles") -->
        <div class="mt-auto pointer-events-none">
          <ng-content select="[footer]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
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
  readonly loading = input<boolean>(false);

  protected readonly labelColor = computed(() => {
    switch (this.color()) {
      case 'success':
        return 'var(--state-success)';
      case 'warning':
        return 'var(--state-warning)';
      case 'error':
        return 'var(--state-error)';
      default:
        return 'var(--color-primary)';
    }
  });
  protected readonly iconBg = computed(() => {
    switch (this.color()) {
      case 'success':
        return 'var(--state-success-bg, rgba(34, 197, 94, 0.1))';
      case 'warning':
        return 'var(--state-warning-bg, rgba(245, 158, 11, 0.1))';
      case 'error':
        return 'var(--state-error-bg, rgba(239, 68, 68, 0.1))';
      default:
        return 'var(--color-primary-muted, rgba(59, 130, 246, 0.1))';
    }
  });
  protected readonly iconColorStyle = computed(() => {
    switch (this.color()) {
      case 'success':
        return 'var(--state-success)';
      case 'warning':
        return 'var(--state-warning)';
      case 'error':
        return 'var(--state-error)';
      default:
        return 'var(--color-primary)';
    }
  });

  private readonly valueEl = viewChild<ElementRef<HTMLElement>>('valueEl');
  private readonly gsap = inject(GsapAnimationsService);

  constructor() {
    effect(() => {
      if (this.loading() || !this.valueEl()) return;
      this.gsap.animateCounter(this.valueEl()!.nativeElement, this.value(), '');
    });
  }
}
