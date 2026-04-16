import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

export type StatBoxVariant = 'default' | 'success' | 'warning' | 'error' | 'brand' | 'surface';

@Component({
  selector: 'app-stat-box',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    <div 
      class="stat-box transition-all duration-300"
      [class.stat-box--compact]="compact()"
      [ngClass]="'stat-box--' + variant()"
    >
      <div class="flex flex-col gap-1 w-full">
        <div class="flex items-center justify-between gap-2">
          <span class="stat-box__label truncate">{{ label() }}</span>
          @if (icon()) {
            <app-icon [name]="icon()!" [size]="compact() ? 12 : 14" class="stat-box__icon" />
          }
        </div>
        
        <div class="flex items-baseline gap-1.5 overflow-hidden">
          <span class="stat-box__value truncate" [class.stat-box__value--mono]="useMono()">
            {{ value() }}
          </span>
          @if (suffix()) {
            <span class="stat-box__suffix">{{ suffix() }}</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .stat-box {
      border-radius: var(--radius-xl);
      padding: 1rem;
      border: 1px solid var(--border-default);
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .stat-box--compact {
      padding: 0.75rem 1rem;
    }

    .stat-box__label {
      font-size: var(--text-xs);
      font-weight: var(--font-bold);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .stat-box__value {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      color: var(--text-primary);
      line-height: 1.2;
    }

    .stat-box--compact .stat-box__value {
      font-size: var(--text-base);
    }

    .stat-box__value--mono {
      font-family: var(--font-mono);
      letter-spacing: -0.02em;
    }

    .stat-box__suffix {
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--text-muted);
    }

    /* ─── Variants ─── */

    .stat-box--surface {
      background: var(--bg-surface-elevated);
      border-color: var(--border-subtle);
    }

    .stat-box--brand {
      background: color-mix(in srgb, var(--ds-brand) 8%, var(--bg-surface));
      border-color: color-mix(in srgb, var(--ds-brand) 30%, var(--border-default));
      .stat-box__label, .stat-box__value, .stat-box__icon { color: var(--ds-brand); }
    }

    .stat-box--success {
      background: var(--state-success-bg);
      border-color: var(--state-success-border);
      .stat-box__label, .stat-box__value, .stat-box__icon { color: var(--state-success); }
    }

    .stat-box--warning {
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
      .stat-box__label, .stat-box__value, .stat-box__icon { color: var(--state-warning); }
    }

    .stat-box--error {
      background: var(--state-error-bg);
      border-color: var(--state-error-border);
      .stat-box__label, .stat-box__value, .stat-box__icon { color: var(--state-error); }
    }
  `
})
export class StatBoxComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  variant = input<StatBoxVariant>('default');
  icon = input<string | undefined>();
  suffix = input<string | undefined>();
  compact = input<boolean>(false);
  useMono = input<boolean>(false);
}
