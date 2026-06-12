import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { validateEmail, normalizeEmail } from '@core/utils/email.utils';

@Component({
  selector: 'app-email-input',
  imports: [FormsModule, IconComponent],
  templateUrl: './email-input.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailInputComponent {
  value = input.required<string>();
  id = input<string>('email');
  label = input<string>('Email');
  required = input<boolean>(false);
  placeholder = input<string>('usuario@ejemplo.cl');
  forceDirty = input<boolean>(false);
  valueChange = output<string>();

  protected _blurred = signal(false);

  readonly isValid = computed(() => validateEmail(this.value()));
  readonly showFeedback = computed(() => this._blurred() || this.forceDirty());

  onBlur(): void {
    this._blurred.set(true);
    this.valueChange.emit(normalizeEmail(this.value()));
  }
}
