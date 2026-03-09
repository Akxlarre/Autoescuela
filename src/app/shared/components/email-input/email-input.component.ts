import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { validateEmail } from '@core/utils/email.utils';

/**
 * Reusable email input with real-time validation feedback.
 * Dumb component — no service injection.
 *
 * Usage:
 *   <app-email-input
 *     [value]="email()"
 *     (valueChange)="email.set($event)"
 *   />
 */
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
  valueChange = output<string>();

  readonly isValid = computed(() => validateEmail(this.value()));
  readonly isDirty = computed(() => this.value().length > 0);
}
