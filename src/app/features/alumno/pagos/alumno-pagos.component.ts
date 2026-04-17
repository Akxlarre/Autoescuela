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
  imports: [SectionHeroComponent, KpiCardVariantComponent, IconComponent, SkeletonBlockComponent],
  template: `
    <div class="px-6 py-6 pb-20 space-y-6">
      <!-- ── Cabecera ── -->
      <app-section-hero
        title="Pagos y Clases"
        subtitle="Paga tu saldo pendiente y agenda tus clases restantes"
        icon="wallet"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      @if (facade.error()) {
        <div
          class="flex items-start gap-3 p-4 rounded-lg"
          style="background: var(--color-error-muted)"
          role="alert"
        >
          <app-icon name="alert-circle" [size]="16" style="color: var(--color-error)" />
          <p class="text-sm" style="color: var(--color-error)">{{ facade.error() }}</p>
        </div>
      } @else {
        <!-- ── KPI Grid ── -->
        @if (facade.enrollment(); as enroll) {
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

          <!-- Info matrícula -->
          <div class="flex items-center gap-2 text-xs text-text-muted">
            <app-icon name="info" [size]="12" />
            <span>
              Matrícula N°&nbsp;{{ enroll.number }} · {{ enroll.courseName }} ·
              {{ enroll.branchName }}
            </span>
          </div>
        } @else if (facade.isLoading()) {
          <!-- Skeleton KPIs mientras carga -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            @for (i of [1, 2, 3]; track i) {
              <app-kpi-card-variant label="" [value]="0" [loading]="true" icon="wallet" />
            }
          </div>
        } @else if (!facade.status()?.hasPaymentPending && facade.status() !== null) {
          <!-- Sin deuda pendiente y sin enrollment (ya completado) -->
          <div class="card p-6 flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style="background: var(--color-success-muted)"
            >
              <app-icon name="check-circle" [size]="22" style="color: var(--color-success)" />
            </div>
            <div>
              <p class="text-sm font-semibold text-text-primary">Matrícula al día</p>
              <p class="text-xs text-text-muted mt-0.5">No tienes saldos pendientes de pago.</p>
            </div>
          </div>
        }

        <!-- ── Historial de pagos ── -->
        <div class="card p-5 flex flex-col gap-3">
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
            <div class="flex flex-col divide-y" style="border-color: var(--color-border)">
              @for (payment of facade.payments(); track payment.id) {
                <div class="flex items-center gap-3 py-3">
                  <div
                    class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style="background: var(--bg-surface)"
                  >
                    <app-icon
                      [name]="paymentIcon(payment)"
                      [size]="16"
                      style="color: var(--ds-brand)"
                    />
                  </div>

                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-text-primary">
                      {{ paymentTypeLabel(payment) }}
                    </p>
                    <p class="text-xs text-text-muted">{{ formatDate(payment.date) }}</p>
                  </div>

                  <div class="flex flex-col items-end gap-0.5 shrink-0">
                    <span class="text-sm font-semibold" style="color: var(--color-success)">
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

  protected readonly heroActions = computed<SectionHeroAction[]>(() => {
    const enroll = this.facade.enrollment();
    if (enroll && enroll.pendingBalance > 0 && this.facade.status()?.hasPaymentPending) {
      return [
        {
          id: 'pay',
          label: `Pagar ${this.clp(enroll.pendingBalance)} y agendar clases`,
          icon: 'credit-card',
          primary: true,
        },
      ];
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
