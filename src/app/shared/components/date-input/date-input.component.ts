import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { isoToDate, toISODate } from '@core/utils/date.utils';

@Component({
  selector: 'app-date-input',
  imports: [FormsModule, DatePickerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label class="field-label" [attr.for]="id()">
        {{ label() }}{{ required() ? ' *' : '' }}
      </label>
    }
    <p-datepicker
      [inputId]="id()"
      [ngModel]="dateValue()"
      (ngModelChange)="onDateChange($event)"
      dateFormat="dd/mm/yy"
      [showIcon]="true"
      [style]="{ width: '100%' }"
      [placeholder]="placeholder()"
      [minDate]="minDate()"
      [maxDate]="maxDate()"
      [disabled]="disabled()"
      [attr.aria-required]="required() || null"
      data-llm-description="date picker input"
    />
  `,
})
export class DateInputComponent {
  value = input.required<string>();
  label = input<string>('');
  id = input<string>('date');
  required = input<boolean>(false);
  disabled = input<boolean>(false);
  min = input<string>('');
  max = input<string>('');
  placeholder = input<string>('dd/mm/aaaa');

  valueChange = output<string>();

  protected readonly minDate = computed(() => isoToDate(this.min()));
  protected readonly maxDate = computed(() => isoToDate(this.max()));
  // computed() memoiza el Date — misma referencia mientras value() no cambie,
  // evitando que NgModel llame writeValue en cada ciclo de CD (NG0103).
  protected readonly dateValue = computed(() => isoToDate(this.value()));

  protected onDateChange(date: Date | null): void {
    this.valueChange.emit(date ? toISODate(date) : '');
  }
}
