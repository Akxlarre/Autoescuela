import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { StudentSummaryBanner, TimeSlot } from '@core/models/ui/enrollment-assignment.model';

export interface PublicPaymentSummary {
  studentSummary: StudentSummaryBanner;
  branchName: string;
  courseName: string;
  paymentModeLabel: string;
  scheduledSlots: TimeSlot[];
  totalAmount: number;
  totalLabel: string;
  isSubmitting: boolean;
}

@Component({
  selector: 'app-public-payment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="space-y-5">
      <div>
        <h2
          class="font-bold mb-1"
          style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
        >
          Revisa y confirma
        </h2>
        <p class="text-sm" style="color: var(--text-secondary);">
          Resumen de tu matrícula antes de pagar.
        </p>
      </div>

      <!-- Student + course summary card -->
      <div
        class="rounded-xl p-5 space-y-4"
        style="background: var(--bg-surface); border: 1px solid var(--border-default);"
      >
        <!-- Student header -->
        <div
          class="flex items-center gap-3 pb-4"
          style="border-bottom: 1px solid var(--border-subtle);"
        >
          <div
            class="flex h-11 w-11 items-center justify-center rounded-full shrink-0 font-bold text-white text-sm"
            style="background: var(--gradient-primary);"
            aria-hidden="true"
          >
            {{ summary().studentSummary.initials }}
          </div>
          <div>
            <p class="font-semibold text-sm" style="color: var(--text-primary);">
              {{ summary().studentSummary.fullName }}
            </p>
            <p class="text-xs" style="color: var(--text-secondary);">
              {{ summary().courseName }} · {{ summary().branchName }}
            </p>
          </div>
        </div>

        <!-- Summary rows -->
        <div class="space-y-2">
          <div class="flex justify-between items-center text-sm">
            <span style="color: var(--text-secondary);">Modalidad de pago</span>
            <span class="font-medium" style="color: var(--text-primary);">
              {{ summary().paymentModeLabel }}
            </span>
          </div>
          <div class="flex justify-between items-center text-sm">
            <span style="color: var(--text-secondary);">Clases prácticas</span>
            <span class="font-medium" style="color: var(--text-primary);">
              {{ summary().scheduledSlots.length }} clases agendadas
            </span>
          </div>
        </div>

        <!-- Scheduled classes breakdown (AC10) -->
        @if (summary().scheduledSlots.length > 0) {
          <div
            class="rounded-xl p-4 space-y-3"
            style="background: var(--bg-elevated); border: 1px solid var(--border-subtle);"
          >
            <p class="text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted);">
              Tus clases agendadas
            </p>
            <ul class="space-y-2">
              @for (slot of visibleSlots(); track slot.id; let i = $index) {
                <li class="flex items-center gap-2.5 text-sm" style="color: var(--text-secondary);">
                  <span
                    class="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-xs font-bold"
                    style="background: var(--color-primary-muted); color: var(--color-primary);"
                  >
                    {{ i + 1 }}
                  </span>
                  <span>{{ slot.date }} · {{ slot.startTime }} – {{ slot.endTime }}</span>
                </li>
              }
              @if (summary().scheduledSlots.length > 4) {
                <li class="text-xs pl-8" style="color: var(--text-muted);">
                  + {{ summary().scheduledSlots.length - 4 }} clases más…
                </li>
              }
            </ul>
          </div>
        }

        <!-- Total box -->
        <div
          class="flex items-center justify-between rounded-xl p-4"
          style="
            background: linear-gradient(135deg, var(--color-primary-muted) 0%, transparent 100%);
            border: 1px solid color-mix(in srgb, var(--ds-brand) 25%, transparent);
          "
        >
          <span class="font-semibold text-sm" style="color: var(--text-primary);">
            Total a pagar ahora
          </span>
          <span
            class="font-bold leading-none"
            style="
              font-family: var(--font-display);
              font-size: 1.75rem;
              font-weight: 900;
              background: var(--gradient-primary);
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
            "
            [attr.aria-label]="summary().totalLabel"
          >
            {{ summary().totalLabel }}
          </span>
        </div>
      </div>

      <!-- Trust note (AC9) -->
      <div
        class="flex items-start gap-3 rounded-xl p-4 text-sm"
        style="background: var(--bg-surface); border: 1px solid var(--border-subtle);"
      >
        <app-icon name="lock" [size]="16" color="var(--ds-brand)" class="mt-0.5 shrink-0" />
        <p style="color: var(--text-secondary);">
          <strong style="color: var(--text-primary);">Pago 100% seguro.</strong>
          Serás redirigido a Webpay para completar el pago. Sin cobros sorpresa — el monto mostrado
          es el total.
        </p>
      </div>

      <!-- Nav -->
      <div class="flex justify-between pt-2 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
          style="color: var(--text-secondary);"
          [disabled]="summary().isSubmitting"
          (click)="back.emit()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
        <button
          type="button"
          class="btn-primary flex items-center gap-2 px-7 py-2.5 rounded-xl font-semibold text-sm"
          [disabled]="summary().isSubmitting"
          [style.opacity]="summary().isSubmitting ? '0.7' : '1'"
          data-llm-action="proceed-to-payment"
          data-llm-description="Proceed to Webpay payment for driving school enrollment"
          (click)="proceed.emit()"
        >
          @if (summary().isSubmitting) {
            <app-icon name="loader-circle" [size]="16" color="white" class="animate-spin" />
            Procesando...
          } @else {
            <app-icon name="credit-card" [size]="16" color="white" />
            Pagar con Webpay
          }
        </button>
      </div>
    </div>
  `,
})
export class PublicPaymentComponent {
  readonly summary = input.required<PublicPaymentSummary>();
  readonly proceed = output<void>();
  readonly back = output<void>();

  protected visibleSlots() {
    return this.summary().scheduledSlots.slice(0, 4);
  }
}
