import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';

import { StudentPaymentFacade } from '@core/facades/student-payment.facade';
import { formatCLP } from '@core/utils/date.utils';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

/**
 * AlumnoPagarComponent — Pago del saldo pendiente de matrícula Clase B.
 *
 * Desde fix-017, la matrícula de Clase B agenda SIEMPRE las 12 clases (aunque el
 * alumno abone solo la primera mitad), por lo que este flujo es exclusivamente de
 * pago: el alumno NO selecciona horarios, sus clases ya están agendadas.
 *
 * Step 1: Resumen del saldo pendiente.
 * Step 3 (Pago): Confirmación y botón "Pagar con Webpay".
 *
 * Smart Component: inyecta StudentPaymentFacade.
 */
@Component({
  selector: 'app-alumno-pagar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    IconComponent,
    AsyncBtnComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoReveal appBentoGridLayout style="padding-bottom: 5rem;">
      <!-- ── Cabecera ── -->
      <app-section-hero
        class="bento-hero"
        title="Pagar"
        subtitle="Completa el pago de tu matrícula"
        icon="credit-card"
        [actions]="[]"
      />

      <!-- ── Stepper ── -->
      <div class="bento-banner card px-6 py-4" appCardHover>
        <div class="flex items-center">
          @for (s of steps(); track s.n; let last = $last) {
            <!-- Nodo del paso -->
            <div class="flex flex-col items-center gap-1.5 shrink-0">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                [style.background]="
                  facade.step() > s.facadeStep
                    ? 'var(--color-success)'
                    : facade.step() === s.facadeStep
                      ? 'var(--ds-brand)'
                      : 'var(--bg-surface)'
                "
                [style.color]="facade.step() >= s.facadeStep ? 'white' : 'var(--text-muted)'"
                [style.border]="
                  facade.step() < s.facadeStep ? '2px solid var(--color-border)' : 'none'
                "
              >
                @if (facade.step() > s.facadeStep) {
                  <app-icon name="check" [size]="14" />
                } @else {
                  {{ s.n }}
                }
              </div>
              <span
                class="text-xs font-semibold tracking-wide uppercase"
                [style.color]="
                  facade.step() === s.facadeStep ? 'var(--ds-brand)' : 'var(--text-muted)'
                "
              >
                {{ s.label }}
              </span>
            </div>
            <!-- Conector entre pasos -->
            @if (!last) {
              <div
                class="flex-1 h-0.5 mx-3 mb-5 transition-all"
                [style.background]="
                  facade.step() > s.facadeStep ? 'var(--color-success)' : 'var(--color-border)'
                "
              ></div>
            }
          }
        </div>
      </div>

      <!-- ── Error global ── -->
      @if (facade.error()) {
        <div
          class="bento-banner flex items-start gap-3 p-4 rounded-lg bg-error-subtle"
          role="alert"
        >
          <app-icon name="alert-circle" [size]="16" class="shrink-0 mt-0.5 text-error" />
          <p class="text-sm flex-1 text-error">{{ facade.error() }}</p>
          <button
            class="shrink-0 cursor-pointer"
            (click)="facade.resetError()"
            aria-label="Cerrar error"
          >
            <app-icon name="x" [size]="14" class="text-error" />
          </button>
        </div>
      }

      <!-- ════════════════════════════════════
           STEP 1 — Resumen
           ════════════════════════════════════ -->
      @if (facade.step() === 1) {
        @if (facade.isLoading()) {
          <div class="bento-banner card p-6 flex flex-col gap-4">
            <app-skeleton-block variant="text" width="60%" height="24px" />
            <app-skeleton-block variant="text" width="100%" height="16px" />
            <app-skeleton-block variant="text" width="100%" height="16px" />
            <app-skeleton-block variant="rect" width="100%" height="80px" />
          </div>
        } @else if (facade.status()?.hasPaymentPending === false) {
          <div
            class="bento-banner card p-8 flex flex-col items-center gap-4 text-center"
            appCardHover
          >
            <div class="w-14 h-14 rounded-full flex items-center justify-center bg-success-subtle">
              <app-icon name="check-circle" [size]="28" class="text-success" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-text-primary">Tu matrícula está al día</h2>
              <p class="text-sm text-text-muted mt-1">
                No tienes saldo pendiente. Todas tus clases están agendadas.
              </p>
            </div>
          </div>
        } @else if (facade.enrollment(); as enroll) {
          <div class="bento-banner grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <!-- Columna izquierda: monto + detalles -->
            <div class="flex flex-col gap-4">
              <div class="card-tinted rounded-xl p-6 flex flex-col gap-1 text-center">
                <span class="kpi-label">Saldo pendiente de pago</span>
                <span
                  class="kpi-value"
                  data-llm-description="pending balance amount to pay in Chilean pesos"
                >
                  {{ clp(enroll.pendingBalance) }}
                </span>
                <span class="text-xs text-text-muted mt-1">
                  Total del curso: {{ clp(enroll.basePrice) }} · Ya pagado:
                  {{ clp(enroll.totalPaid) }}
                </span>
              </div>

              <div class="card p-5 flex flex-col gap-3" appCardHover>
                <div class="flex items-center gap-3">
                  <app-icon name="graduation-cap" [size]="16" class="text-text-muted shrink-0" />
                  <div class="flex-1 flex justify-between items-center gap-2">
                    <span class="text-xs text-text-muted uppercase tracking-wide">Curso</span>
                    <span class="text-sm font-medium text-text-primary">{{
                      enroll.courseName
                    }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <app-icon name="building-2" [size]="16" class="text-text-muted shrink-0" />
                  <div class="flex-1 flex justify-between items-center gap-2">
                    <span class="text-xs text-text-muted uppercase tracking-wide">Sede</span>
                    <span class="text-sm font-medium text-text-primary">{{
                      enroll.branchName
                    }}</span>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <app-icon name="hash" [size]="16" class="text-text-muted shrink-0" />
                  <div class="flex-1 flex justify-between items-center gap-2">
                    <span class="text-xs text-text-muted uppercase tracking-wide">Matrícula</span>
                    <span class="text-sm font-medium text-text-primary"
                      >N° {{ enroll.number }}</span
                    >
                  </div>
                </div>
              </div>
            </div>

            <!-- Columna derecha: clases ya agendadas + CTA -->
            <div class="flex flex-col gap-4">
              <div class="card p-5 flex flex-col gap-3" appCardHover>
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-success-subtle"
                  >
                    <app-icon name="calendar-check" [size]="18" class="text-success" />
                  </div>
                  <div>
                    <p class="text-xs text-text-muted uppercase tracking-wide">Clases agendadas</p>
                    <p class="text-sm font-semibold text-text-primary">
                      Todas tus clases ya están reservadas
                    </p>
                  </div>
                </div>
                <p class="text-xs text-text-muted">
                  Tu horario quedó fijado durante el proceso de matrícula. Solo debes completar el
                  pago.
                </p>
              </div>
              <button
                class="btn-primary w-full flex items-center justify-center gap-2 cursor-pointer"
                [disabled]="facade.isLoading()"
                (click)="facade.goDirectToConfirm()"
                data-llm-action="go-to-payment-direct"
              >
                <app-icon name="credit-card" [size]="16" />
                {{ payLabel() }}
              </button>
            </div>
          </div>
        }
      }

      <!-- ════════════════════════════════════
           STEP 3 — Confirmación y pago
           ════════════════════════════════════ -->
      @if (facade.step() === 3) {
        <div class="bento-banner flex flex-col gap-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <!-- Clases ya agendadas -->
            <div class="card p-5 flex flex-col gap-4" appCardHover>
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center bg-success-subtle"
              >
                <app-icon name="calendar-check" [size]="20" class="text-success" />
              </div>
              <div>
                <p class="text-sm font-semibold text-text-primary">Tus clases ya están agendadas</p>
                <p class="text-xs text-text-muted mt-1">
                  Solo necesitas completar el pago para confirmar tu matrícula.
                </p>
              </div>
            </div>

            <!-- Resumen de pago + CTA -->
            <div class="flex flex-col gap-4">
              <div class="card-tinted rounded-xl p-5 flex flex-col gap-3">
                @if (facade.enrollment(); as enroll) {
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-text-muted">Clases prácticas</span>
                    <span class="text-sm font-medium text-text-primary">Ya agendadas</span>
                  </div>
                  <div class="border-t pt-3 border-border-default">
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-text-primary">Total a pagar</span>
                      <span
                        class="text-lg font-bold text-brand"
                        data-llm-description="total amount to pay via Webpay"
                      >
                        {{ clp(enroll.pendingBalance) }}
                      </span>
                    </div>
                  </div>
                }
              </div>

              <div class="flex items-start gap-3 p-3 rounded-lg text-xs text-text-muted bg-surface">
                <app-icon name="credit-card" [size]="14" class="shrink-0 mt-0.5" />
                <span
                  >Serás redirigido al portal seguro de Transbank (Webpay Plus) para completar el
                  pago con tarjeta de débito o crédito.</span
                >
              </div>

              <div class="flex gap-3">
                <button
                  class="btn-secondary flex items-center gap-2 cursor-pointer"
                  [disabled]="facade.isSubmitting()"
                  (click)="facade.backToSummary()"
                >
                  <app-icon name="arrow-left" [size]="14" />
                  Volver
                </button>
                <app-async-btn
                  class="flex-1"
                  [label]="payLabel()"
                  icon="credit-card"
                  [loading]="facade.isSubmitting()"
                  (click)="facade.initiatePayment()"
                  data-llm-action="initiate-webpay-payment"
                />
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AlumnoPagarComponent implements OnInit {
  protected readonly facade = inject(StudentPaymentFacade);
  protected readonly clp = formatCLP;

  /** Stepper de 2 nodos: Resumen → Pago. `facadeStep` mapea al valor real de `facade.step()`. */
  protected readonly steps = computed(() => [
    { n: 1, label: 'Resumen', facadeStep: 1 },
    { n: 2, label: 'Pago', facadeStep: 3 },
  ]);

  protected readonly payLabel = computed(() => {
    const balance = this.facade.enrollment()?.pendingBalance;
    return balance != null ? `Pagar ${formatCLP(balance)} con Webpay` : 'Pagar con Webpay';
  });

  ngOnInit(): void {
    void this.facade.initialize();
  }
}
