import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { StudentPaymentFacade } from '@core/facades/student-payment.facade';
import type { StudentPaymentHistoryItem } from '@core/models/ui/student-payment.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { formatCLP } from '@core/utils/date.utils';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';

function toCompact(amount: number): { value: number; suffix: string } {
  if (amount >= 1_000_000) {
    return { value: parseFloat((amount / 1_000_000).toFixed(1)), suffix: 'M' };
  }
  if (amount >= 10_000) {
    return { value: parseFloat((amount / 1_000).toFixed(1)), suffix: 'K' };
  }
  return { value: amount, suffix: '' };
}

/**
 * AlumnoPagosComponent — Historial de pagos y resumen financiero del alumno.
 *
 * Muestra:
 * - Hero con título y CTA condicional "Pagar saldo"
 * - KPIs: Total curso / Ya pagado / Saldo pendiente
 * - Lista cronológica de pagos registrados
 *
 * Smart Component: inyecta StudentPaymentFacade.
 */
@Component({
  selector: 'app-alumno-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
  ],
  template: `
    <div class="bento-grid" appBentoReveal appBentoGridLayout style="padding-bottom: 5rem;">
      <!-- ── Cabecera ── -->
      <app-section-hero
        class="bento-hero"
        title="Pagos"
        [subtitle]="heroSubtitle()"
        [contextLine]="heroContextLine()"
        icon="wallet"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      @if (facade.error()) {
        <div class="flex items-start gap-3 p-4 rounded-lg bg-error-subtle" role="alert">
          <app-icon name="alert-circle" [size]="16" class="text-error" />
          <p class="text-sm text-error">{{ facade.error() }}</p>
        </div>
      } @else {
        <!-- ── KPI Grid ── -->
        @if (facade.enrollment(); as enroll) {
          <div class="bento-banner flex flex-col gap-4">
            <!-- Aviso pago presencial para alumnos Profesional -->
            @if (!facade.isClassB() && enroll.pendingBalance > 0) {
              <div class="flex items-start gap-3 p-4 rounded-lg bg-warning-subtle">
                <app-icon
                  name="info"
                  [size]="18"
                  class="text-warning shrink-0"
                  style="margin-top: 1px"
                />
                <div>
                  <p class="text-sm font-semibold text-warning">
                    Saldo pendiente: {{ clp(enroll.pendingBalance) }}
                  </p>
                  <p class="text-xs mt-0.5 text-warning">
                    El pago de matrículas de Clase Profesional se realiza directamente en
                    secretaría. Acércate a la sucursal <strong>{{ enroll.branchName }}</strong> para
                    regularizar tu saldo.
                  </p>
                </div>
              </div>
            }
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <app-kpi-card-variant
                label="Total Curso"
                [value]="toCompact(enroll.basePrice).value"
                [loading]="facade.isLoading()"
                icon="graduation-cap"
                prefix="$"
                [suffix]="toCompact(enroll.basePrice).suffix"
                [subValue]="clp(enroll.basePrice)"
              />
              <app-kpi-card-variant
                label="Ya Pagado"
                [value]="toCompact(enroll.totalPaid).value"
                [loading]="facade.isLoading()"
                icon="circle-check"
                color="success"
                prefix="$"
                [suffix]="toCompact(enroll.totalPaid).suffix"
                [subValue]="clp(enroll.totalPaid)"
              />
              <app-kpi-card-variant
                label="Saldo Pendiente"
                [value]="toCompact(enroll.pendingBalance).value"
                [loading]="facade.isLoading()"
                icon="clock"
                [color]="enroll.pendingBalance > 0 ? 'warning' : 'success'"
                [accent]="enroll.pendingBalance > 0"
                prefix="$"
                [suffix]="toCompact(enroll.pendingBalance).suffix"
                [subValue]="clp(enroll.pendingBalance)"
              />
            </div>
          </div>
        } @else if (facade.isLoading()) {
          <!-- Skeleton KPIs mientras carga -->
          <div class="bento-banner grid grid-cols-1 sm:grid-cols-3 gap-4">
            @for (i of [1, 2, 3]; track i) {
              <app-kpi-card-variant label="" [value]="0" [loading]="true" icon="wallet" />
            }
          </div>
        } @else if (!facade.status()?.hasPaymentPending && facade.status() !== null) {
          <!-- Sin deuda pendiente y sin enrollment (ya completado) -->
          <div class="bento-banner card p-6 flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-success-subtle"
            >
              <app-icon name="check-circle" [size]="22" class="text-success" />
            </div>
            <div>
              <p class="text-sm font-semibold text-text-primary">Matrícula al día</p>
              <p class="text-xs text-text-muted mt-0.5">No tienes saldos pendientes de pago.</p>
            </div>
          </div>
        }

        <!-- ── Historial de pagos ── -->
        <div class="bento-banner card p-5 flex flex-col gap-3">
          <h2 class="text-sm font-semibold text-text-primary uppercase tracking-wide">
            Historial de pagos
          </h2>

          @if (facade.isLoading()) {
            @for (i of [1, 2, 3]; track i) {
              <app-skeleton-block variant="text" width="100%" height="52px" />
            }
          } @else if (facade.payments().length === 0) {
            <div class="flex flex-col items-center gap-2 py-8 text-center">
              <app-icon name="receipt" [size]="28" class="text-text-muted" />
              <p class="text-sm text-text-muted">Aún no se han registrado pagos.</p>
            </div>
          } @else {
            <div class="flex flex-col divide-y divide-border-default">
              @for (payment of facade.payments(); track payment.id) {
                <div class="flex items-center gap-3 py-3">
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-surface"
                  >
                    <app-icon [name]="paymentIcon(payment)" [size]="16" class="text-brand" />
                  </div>

                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">
                      {{ paymentTypeLabel(payment) }}
                    </p>
                    <p class="text-xs text-text-muted">{{ formatDate(payment.date) }}</p>
                  </div>

                  <div class="flex flex-col items-end gap-0.5 shrink-0">
                    <span class="text-sm font-semibold text-success">
                      {{ clp(payment.amount) }}
                    </span>
                    <span
                      class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      [style.background]="
                        payment.status === 'paid'
                          ? 'var(--color-success-muted)'
                          : 'var(--color-warning-muted)'
                      "
                      [style.color]="
                        payment.status === 'paid' ? 'var(--color-success)' : 'var(--color-warning)'
                      "
                    >
                      {{ payment.status === 'paid' ? 'Pagado' : 'Pendiente' }}
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AlumnoPagosComponent implements OnInit {
  protected readonly facade = inject(StudentPaymentFacade);
  private readonly router = inject(Router);

  protected readonly toCompact = toCompact;
  protected readonly clp = (amount: number) => formatCLP(amount);

  protected readonly heroSubtitle = computed(() => {
    if (!this.facade.isClassB()) {
      return this.facade.enrollment()?.pendingBalance
        ? 'Regulariza tu pago directamente en la secretaría'
        : 'Resumen de pagos de tu matrícula profesional';
    }
    return 'Paga tu saldo pendiente para completar tu matrícula';
  });

  protected readonly heroContextLine = computed(() => {
    const enroll = this.facade.enrollment();
    if (!enroll) return '';
    return `Matrícula N° ${enroll.number} · ${enroll.courseName} · ${enroll.branchName}`;
  });

  protected readonly heroActions = computed<SectionHeroAction[]>(() => {
    const enroll = this.facade.enrollment();
    if (
      enroll &&
      enroll.pendingBalance > 0 &&
      this.facade.status()?.hasPaymentPending &&
      this.facade.isClassB()
    ) {
      const label = `Pagar ${this.clp(enroll.pendingBalance)}`;
      return [{ id: 'pay', label, icon: 'credit-card', primary: true }];
    }
    return [];
  });

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'pay') {
      void this.router.navigate(['/app/alumno/pagar']);
    }
  }

  protected formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Santiago',
    });
  }

  protected paymentIcon(payment: StudentPaymentHistoryItem): string {
    switch (payment.type) {
      case 'online':
        return 'credit-card';
      case 'transfer':
        return 'building-2';
      case 'cash':
        return 'banknote';
      default:
        return 'receipt';
    }
  }

  protected paymentTypeLabel(payment: StudentPaymentHistoryItem): string {
    switch (payment.type) {
      case 'online':
        return 'Pago online (Webpay)';
      case 'transfer':
        return 'Transferencia bancaria';
      case 'cash':
        return 'Pago en efectivo';
      case 'card':
        return 'Pago con tarjeta';
      default:
        return 'Pago';
    }
  }
}
