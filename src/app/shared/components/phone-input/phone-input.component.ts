import { Component, ChangeDetectionStrategy, input, output, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ClickOutsideDirective } from '@core/directives/click-outside.directive';
import { DIAL_CODES, validatePhone, normalizePhone, type DialCode } from '@core/utils/phone.utils';

@Component({
  selector: 'app-phone-input',
  standalone: true,
  imports: [FormsModule, IconComponent, ClickOutsideDirective],
  templateUrl: './phone-input.component.html',
  styles: [
    `
      .dial-option:hover {
        background: var(--bg-base);
      }
      .dial-option.selected {
        background: color-mix(in srgb, var(--ds-brand) 8%, transparent);
      }
      .dial-option.selected:hover {
        background: color-mix(in srgb, var(--ds-brand) 12%, transparent);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhoneInputComponent {
  value = input<string>('');
  id = input<string>('phone');
  label = input<string>('Teléfono / WhatsApp');
  required = input<boolean>(false);
  forceDirty = input<boolean>(false);
  valueChange = output<string>();

  protected readonly dialCodes: DialCode[] = DIAL_CODES;

  protected _dialCode = signal('+56');
  protected _digits = signal('');
  protected _blurred = signal(false);
  protected _dropdownOpen = signal(false);

  readonly isValid = computed(() => validatePhone(this._digits(), this._dialCode()));
  readonly e164Value = computed(() => normalizePhone(this._digits(), this._dialCode()));
  readonly showFeedback = computed(() => this._blurred() || this.forceDirty());

  readonly selectedDialCode = computed(
    () => this.dialCodes.find((d) => d.dialCode === this._dialCode()) ?? this.dialCodes[0],
  );

  readonly placeholder = computed(() => {
    const found = this.dialCodes.find((d) => d.dialCode === this._dialCode());
    return found?.placeholder ?? '0000 0000';
  });

  readonly errorId = computed(() => `${this.id()}-phone-error`);

  constructor() {
    effect(() => {
      const incoming = this.value();
      if (incoming && incoming !== this.e164Value()) {
        const code = this.dialCodes.find(d => incoming.startsWith(d.dialCode));
        if (code) {
          this._dialCode.set(code.dialCode);
          this._digits.set(incoming.slice(code.dialCode.length));
        } else {
          this._dialCode.set('+56');
          const digitsOnly = incoming.replace(/\D/g, '');
          // Keep at most 15 digits (or 9 for Chile)
          this._digits.set(digitsOnly.slice(0, 15));
        }
      } else if (!incoming && this._digits()) {
        this._digits.set('');
      }
    }, { allowSignalWrites: true });
  }

  selectDialCode(dialCode: string): void {
    this._dialCode.set(dialCode);
    this._dropdownOpen.set(false);
    if (this.isValid()) {
      this.valueChange.emit(this.e164Value());
    } else {
      this.valueChange.emit(this._digits() ? this.e164Value() : '');
    }
  }

  onDigitsInput(raw: string): void {
    const digitsOnly = raw.replace(/\D/g, '');
    this._digits.set(digitsOnly);
    if (this.isValid()) {
      this.valueChange.emit(this.e164Value());
    } else {
      this.valueChange.emit(this._digits() ? this.e164Value() : '');
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowed.includes(event.key)) return;
    if (/^\d$/.test(event.key)) return;
    event.preventDefault();
  }

  onBlur(nativeValue?: string): void {
    this._blurred.set(true);
    if (nativeValue && nativeValue.replace(/\D/g, '') !== this._digits()) {
      this.onDigitsInput(nativeValue);
    }
    if (this.isValid()) {
      this.valueChange.emit(this.e164Value());
    } else {
      this.valueChange.emit(this._digits() ? this.e164Value() : '');
    }
  }
}
