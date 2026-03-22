import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface ChartDataGroup {
  label: string;
  value: number;
  /** Categoría semántica que mapea a un token CSS del design system. */
  color:
    | 'brand'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'practica'
    | 'teorico'
    | 'ensayo'
    | 'administrativo';
  percent: number;
}

const COLOR_MAP: Record<string, string> = {
  brand: 'var(--color-primary)',
  practica: 'var(--color-primary)',
  success: 'var(--state-success)',
  ensayo: 'var(--state-success)',
  warning: 'var(--state-warning)',
  administrativo: 'var(--state-warning)',
  error: 'var(--state-error)',
  info: 'var(--state-info, var(--color-primary))',
  teorico: 'var(--state-info, var(--color-primary))',
};

@Component({
  selector: 'app-horizontal-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  template: `
    <div class="space-y-4">
      @if (title()) {
        <div class="flex justify-between items-end mb-2">
          <h4 class="text-sm font-semibold text-text-primary">{{ title() }}</h4>
          <span class="text-xs text-text-muted">{{ subtitle() }}</span>
        </div>
      }

      <!-- Stacked Bar -->
      <div class="w-full bg-divider rounded-full h-4 overflow-hidden flex">
        @for (item of data(); track item.label) {
          <div
            [style.width.%]="item.percent"
            [style.backgroundColor]="resolveColor(item.color)"
            class="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
            [title]="item.label + ': ' + item.value"
          ></div>
        }
      </div>

      <!-- Legend -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
        @for (item of data(); track item.label) {
          <div class="flex items-center gap-2">
            <span
              class="w-3 h-3 rounded-full shrink-0"
              [style.backgroundColor]="resolveColor(item.color)"
            ></span>
            <div class="flex-1 flex justify-between items-center text-xs">
              <span class="text-text-muted truncate mr-2">{{ item.label }}</span>
              <span class="font-semibold text-text-primary"
                >{{ item.value }}h ({{ item.percent | number: '1.0-0' }}%)</span
              >
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class HorizontalBarChartComponent {
  readonly title = input('');
  readonly subtitle = input('');
  readonly data = input<ChartDataGroup[]>([]);

  resolveColor(color: string): string {
    return COLOR_MAP[color] ?? 'var(--color-primary)';
  }
}
