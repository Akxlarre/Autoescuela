import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import {
  EXEC_PERIOD_OPTIONS,
  type ExecDateRange,
  type ExecPeriodPreset,
  type ExecRangeChange,
} from '@core/models/ui/executive-dashboard.model';
import { isValidRange, resolvePresetRange } from '@core/utils/executive-dashboard.utils';

/**
 * Filtro de período del Dashboard Ejecutivo (spec 0044-b, AC1).
 *
 * Dumb: recibe el preset y el rango vigentes, y `today` (fecha local de Chile) para
 * resolver los presets. Solo emite rangos válidos (desde <= hasta).
 */
@Component({
  selector: 'app-exec-period-filter',
  standalone: true,
  imports: [FormsModule, Select, DateInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end gap-2">
      <p-select
        [ngModel]="preset()"
        (ngModelChange)="onPresetChange($event)"
        [options]="options"
        optionLabel="label"
        optionValue="value"
        ariaLabel="Período del dashboard"
        styleClass="h-10 min-w-40"
        data-llm-action="change-executive-dashboard-period"
        data-llm-description="selector de período del dashboard ejecutivo: este mes, mes anterior, este año o personalizado"
      />
      @if (preset() === 'custom') {
        <app-date-input
          id="exec-range-from"
          label="Desde"
          [value]="range().from"
          [max]="range().to"
          (valueChange)="onCustomChange({ from: $event, to: range().to })"
          data-llm-description="fecha de inicio del período personalizado del dashboard"
        />
        <app-date-input
          id="exec-range-to"
          label="Hasta"
          [value]="range().to"
          [min]="range().from"
          [max]="today()"
          (valueChange)="onCustomChange({ from: range().from, to: $event })"
          data-llm-description="fecha de término del período personalizado del dashboard"
        />
      }
    </div>
  `,
})
export class ExecPeriodFilterComponent {
  readonly preset = input.required<ExecPeriodPreset>();
  readonly range = input.required<ExecDateRange>();
  /** Hoy en Chile (`YYYY-MM-DD`). */
  readonly today = input.required<string>();

  readonly rangeChange = output<ExecRangeChange>();

  protected readonly options = EXEC_PERIOD_OPTIONS;

  protected onPresetChange(preset: ExecPeriodPreset): void {
    if (preset === 'custom') {
      // Arranca el personalizado desde el rango vigente; el usuario ajusta las fechas.
      this.rangeChange.emit({ range: this.range(), preset });
      return;
    }
    this.rangeChange.emit({ range: resolvePresetRange(preset, this.today()), preset });
  }

  protected onCustomChange(range: ExecDateRange): void {
    if (!isValidRange(range)) return;
    this.rangeChange.emit({ range, preset: 'custom' });
  }
}
