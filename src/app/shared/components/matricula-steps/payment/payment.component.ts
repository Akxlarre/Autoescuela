import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import {
  EnrollmentPaymentData,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@core/models/ui/enrollment-payment.model';

@Component({
  selector: 'app-payment-step',
  imports: [FormsModule, CurrencyPipe, IconComponent, AsyncBtnComponent],
  templateUrl: './payment.component.html',
  styleUrl: './payment.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentComponent {
  readonly paymentMethodOptions = PAYMENT_METHODS;
  data = input.required<EnrollmentPaymentData>();
  loading = input<boolean>(false);
  dataChange = output<EnrollmentPaymentData>();
  next = output<void>();
  back = output<void>();

  discountAmountInput = signal('');
  discountReason = signal('');
  discountError = signal<string | null>(null);

  setPaymentMethod(method: PaymentMethod): void {
    this.dataChange.emit({ ...this.data(), paymentMethod: method });
  }

  /** Selecciona o deselecciona un descuento predefinido (toggle). */
  selectPredefinedDiscount(id: number): void {
    const current = this.data().selectedDiscountId;
    this.dataChange.emit({ ...this.data(), selectedDiscountId: current === id ? null : id });
  }

  applyManualDiscount(): void {
    const amount = parseFloat(this.discountAmountInput()) || 0;
    const maxDiscount = this.data().pricing.amountDue;
    if (amount <= 0) return;
    if (amount > maxDiscount) {
      this.discountError.set(
        `El descuento no puede superar el monto a pagar ($${maxDiscount.toLocaleString('es-CL')}).`,
      );
      return;
    }
    this.discountError.set(null);
    this.dataChange.emit({
      ...this.data(),
      selectedDiscountId: null,
      discount: {
        enabled: true,
        amount,
        reason: this.discountReason().trim() || 'Descuento Manual',
      },
    });
  }

  clearDiscount(): void {
    this.discountError.set(null);
    this.dataChange.emit({
      ...this.data(),
      selectedDiscountId: null,
      discount: { enabled: false, amount: null, reason: '' },
    });
    this.discountAmountInput.set('');
    this.discountReason.set('');
  }

  onNext(): void {
    this.next.emit();
  }

  onBack(): void {
    this.back.emit();
  }
}
