import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  inject,
  ElementRef,
  afterNextRender,
} from '@angular/core';
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
      [readonlyInput]="readonlyInput()"
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
  private readonly el = inject(ElementRef);

  value = input.required<string>();
  label = input<string>('');
  id = input<string>('date');
  required = input<boolean>(false);
  disabled = input<boolean>(false);
  /** Impide tipeo libre — fuerza uso exclusivo del calendar picker. */
  readonlyInput = input<boolean>(false);
  min = input<string>('');
  max = input<string>('');
  placeholder = input<string>('dd/mm/aaaa');

  valueChange = output<string>();

  protected readonly minDate = computed(() => isoToDate(this.min()));
  protected readonly maxDate = computed(() => isoToDate(this.max()));
  protected readonly dateValue = computed(() => isoToDate(this.value()));

  constructor() {
    afterNextRender(() => this.attachMask());
  }

  protected onDateChange(date: Date | null): void {
    this.valueChange.emit(date ? toISODate(date) : '');
  }

  /**
   * Adjunta un listener de teclado al <input> interno de p-datepicker que:
   * - Bloquea caracteres no numéricos
   * - Auto-inserta '/' tras el día (pos 2) y el mes (pos 5)
   * - Limita a 8 dígitos raw (dd mm yy)
   * Solo activo cuando readonlyInput() === false.
   */
  private attachMask(): void {
    const nativeInput: HTMLInputElement | null = this.el.nativeElement.querySelector('input');
    if (!nativeInput) return;

    nativeInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.readonlyInput()) return;

      const key = e.key;
      const inp = e.target as HTMLInputElement;
      const pos = inp.selectionStart ?? inp.value.length;
      const selEnd = inp.selectionEnd ?? pos;

      // Dejar pasar teclas de control y navegación
      if (
        e.ctrlKey ||
        e.metaKey ||
        ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)
      )
        return;

      // Permitir '/' manual en las posiciones correctas (2 y 5)
      if (key === '/') {
        if (pos === 2 || pos === 5) return;
        e.preventDefault();
        return;
      }

      // Bloquear todo lo que no sea dígito
      if (!/^\d$/.test(key)) {
        e.preventDefault();
        return;
      }

      // Límite: máximo 8 dígitos raw (dd + mm + yy)
      const currentDigits = inp.value.replace(/\D/g, '').length;
      const selectedDigits = inp.value.slice(pos, selEnd).replace(/\D/g, '').length;
      if (currentDigits - selectedDigits >= 8) {
        e.preventDefault();
        return;
      }

      // Posición del cursor tras insertar este carácter
      const nextPos = pos - (selEnd - pos) + 1;

      // Auto-insertar '/' después del día (nextPos=2) y del mes (nextPos=5)
      if (nextPos === 2 || nextPos === 5) {
        e.preventDefault();
        const before = inp.value.slice(0, pos);
        const after = inp.value.slice(selEnd);
        inp.value = before + key + '/' + after;
        inp.setSelectionRange(nextPos + 1, nextPos + 1);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }
}
