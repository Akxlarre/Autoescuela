import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { Popover } from 'primeng/popover';
import { DatePicker } from 'primeng/datepicker';
import { IconComponent } from '@shared/components/icon/icon.component';
import { isoToDate } from '@core/utils/date.utils';
import {
  EXEC_PERIOD_OPTIONS,
  type ExecPeriodPreset,
  type ExecDateRange,
  type ExecRangeChange,
} from '@core/models/ui/executive-dashboard.model';
import {
  describeRange,
  isValidRange,
  pickerDatesToRange,
  resolvePresetRange,
} from '@core/utils/executive-dashboard.utils';

/**
 * Filtro de período del Dashboard Ejecutivo (spec 0044-b, AC1).
 *
 * Dumb: recibe el preset y el rango vigentes, y `today` (fecha local de Chile) para
 * resolver los presets. Solo emite rangos válidos (desde <= hasta).
 *
 * Forma fija (fix-176-b): selector de preset + botón con el rango vigente, siempre del mismo
 * alto. El rango personalizado se arma en un calendario flotante y solo se emite al "Aplicar",
 * así elegir "Personalizado" no empuja el layout ni recarga con rangos a medio armar.
 */
@Component({
  selector: 'app-exec-period-filter',
  standalone: true,
  imports: [FormsModule, Select, Popover, DatePicker, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // En contenedores angostos (móvil) el filtro se encoge y el rango se trunca, no desborda.
  host: { class: 'block min-w-0 max-w-full' },
  template: `
    <div class="flex items-center gap-2 min-w-0">
      <p-select
        [ngModel]="selected()"
        (ngModelChange)="onPresetChange($event)"
        [options]="options"
        optionLabel="label"
        optionValue="value"
        ariaLabel="Período del dashboard"
        styleClass="h-10 w-44"
        class="shrink-0"
        data-llm-action="change-executive-dashboard-period"
        data-llm-description="selector de período del dashboard ejecutivo: este mes, mes anterior, este año o personalizado"
      />
      <button
        #rangeAnchor
        type="button"
        class="h-10 px-3 min-w-0 inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface text-sm text-text-primary whitespace-nowrap cursor-pointer transition-colors hover:bg-elevated"
        [title]="rangeLabel()"
        [attr.aria-expanded]="pickerOpen()"
        aria-haspopup="dialog"
        [attr.aria-label]="'Elegir rango personalizado. Rango actual: ' + rangeLabel()"
        (click)="togglePicker($event)"
        data-llm-action="open-executive-dashboard-custom-range"
        data-llm-description="abre el calendario para elegir un rango de fechas personalizado del dashboard"
      >
        <app-icon name="calendar-days" [size]="16" class="shrink-0 text-text-muted" />
        <span class="truncate">{{ rangeLabel() }}</span>
      </button>
    </div>

    <p-popover #picker (onShow)="pickerOpen.set(true)" (onHide)="onPickerHide()">
      <div class="flex flex-col gap-3 p-3" role="dialog" aria-label="Rango personalizado">
        <p class="micro-label m-0">Rango personalizado</p>
        <p-datepicker
          [ngModel]="draft()"
          (ngModelChange)="onDraftChange($event)"
          selectionMode="range"
          [inline]="true"
          [maxDate]="maxDate()"
          data-llm-description="calendario de rango: primer clic fecha de inicio, segundo clic fecha de término"
        />
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm text-text-secondary">{{ draftLabel() }}</span>
          <div class="flex gap-2">
            <button type="button" class="btn-ghost btn-sm" (click)="hidePicker()">Cancelar</button>
            <button
              type="button"
              class="btn-primary btn-sm"
              [disabled]="!draftRange()"
              (click)="apply()"
              data-llm-action="apply-executive-dashboard-custom-range"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </p-popover>
  `,
})
export class ExecPeriodFilterComponent {
  readonly preset = input.required<ExecPeriodPreset>();
  readonly range = input.required<ExecDateRange>();
  /** Hoy en Chile (`YYYY-MM-DD`). */
  readonly today = input.required<string>();

  readonly rangeChange = output<ExecRangeChange>();

  protected readonly options = EXEC_PERIOD_OPTIONS;

  /** Valor mostrado en el selector: sigue al preset vigente, salvo mientras se arma un rango. */
  protected readonly selected = linkedSignal(() => this.preset());
  /** Borrador del calendario (`[inicio, fin]`); no se emite hasta "Aplicar". */
  protected readonly draft = signal<(Date | null)[] | null>(null);
  protected readonly pickerOpen = signal(false);
  private applied = false;

  private readonly picker = viewChild.required<Popover>('picker');
  private readonly rangeAnchor = viewChild.required<ElementRef<HTMLElement>>('rangeAnchor');

  protected readonly rangeLabel = computed(() => describeRange(this.range()));
  protected readonly maxDate = computed(() => isoToDate(this.today()));
  protected readonly draftRange = computed(() => {
    const r = pickerDatesToRange(this.draft());
    return r && isValidRange(r) ? r : null;
  });
  protected readonly draftLabel = computed(() => {
    const r = this.draftRange();
    return r ? describeRange(r) : 'Elige la fecha de inicio';
  });

  protected onPresetChange(preset: ExecPeriodPreset): void {
    if (preset === 'custom') {
      this.selected.set('custom');
      this.resetDraft();
      this.openPicker();
      return;
    }
    this.rangeChange.emit({ range: resolvePresetRange(preset, this.today()), preset });
  }

  protected togglePicker(event: Event): void {
    if (this.pickerOpen()) {
      this.hidePicker();
      return;
    }
    this.resetDraft();
    this.picker().show(event, this.rangeAnchor().nativeElement);
  }

  protected onDraftChange(dates: (Date | null)[] | null): void {
    this.draft.set(dates);
  }

  protected apply(): void {
    const range = this.draftRange();
    if (!range) return;
    this.applied = true;
    this.rangeChange.emit({ range, preset: 'custom' });
    this.hidePicker();
  }

  /** Al cerrarse sin aplicar, el selector vuelve al preset vigente. */
  protected onPickerHide(): void {
    this.pickerOpen.set(false);
    if (!this.applied) this.selected.set(this.preset());
  }

  protected openPicker(): void {
    // Diferido: el clic que cerró el dropdown del select cerraría el popover recién abierto.
    setTimeout(() => this.picker().show(null, this.rangeAnchor().nativeElement));
  }

  protected hidePicker(): void {
    this.picker().hide();
  }

  private resetDraft(): void {
    this.applied = false;
    const r = this.range();
    this.draft.set([isoToDate(r.from), isoToDate(r.to)]);
  }
}
