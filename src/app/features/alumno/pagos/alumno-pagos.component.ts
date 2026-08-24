import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { StudentPaymentFacade } from '@core/facades/student-payment.facade';
import { StudentEnrollmentContextFacade } from '@core/facades/student-enrollment-context.facade';
import type { StudentPaymentHistoryItem } from '@core/models/ui/student-payment.model';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { formatCLP } from '@core/utils/date.utils';
import { formatKpiEsCl } from '@core/utils/kpi-es-cl-format.util';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { TabsComponent } from '@shared/components/tabs/tabs.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { BentoRevealDirective } from '@core/directives/bento-reveal.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

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
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    TabsComponent,
    BentoGridLayoutDirective,
    BentoRevealDirective,
    CardHoverDirective,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen-kpi bento-grid--rows-fit"
      appBentoReveal
      appBentoGridLayout
    >
      <!-- ── Cabecera ── -->
      <app-section-hero
        title="Pagos"
        [subtitle]="heroSubtitle()"
        [contextLine]="heroContextLine()"
        icon="wallet"
        [actions]="heroActions()"
        density="slim"
        [kpis]="heroKpis()"
        [loading]="facade.isLoading()"
        [loadingKpiCount]="3"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── Selector de matrícula + banner de estado (1 sola fila auto) ────────
           Selector y banner-de-estado son condicionales independientes y PUEDEN
           COEXISTIR (= 2 filas auto antes del fill). Agrupados en un wrapper SIEMPRE
           presente para que --fill-screen-kpi, que fija 3 filas de grid (hero/auto/fill),
           siga colocando el historial en la fila fill — si el @if envolvente ocultara el
           wrapper, el auto-placement correría el historial a la fila "auto" y contain:size
           lo colapsaría a 0 (mismo mecanismo que fix-127-b). -->
      <div class="bento-banner flex flex-col gap-3">
        @if (context.enrollments().length > 1) {
          <div class="p-2">
            <app-tabs
              [tabs]="enrollmentTabs()"
              [activeId]="activeEnrollmentStr()"
              variant="pill"
              (activeIdChange)="selectEnrollment(+$event)"
            />
          </div>
        }

        @if (facade.error()) {
          <div class="flex items-start gap-3 p-4 rounded-lg bg-error-subtle" role="alert">
            <app-icon name="alert-circle" [size]="16" class="text-error" />
            <p class="text-sm text-error">{{ facade.error() }}</p>
          </div>
          <!-- Aviso pago presencial para alumnos Profesional -->
        } @else if (facade.enrollment(); as enroll) {
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
                  El pago de matrículas de Clase Profesional se realiza directamente en secretaría.
                  Acércate a la sucursal <strong>{{ enroll.branchName }}</strong> para regularizar
                  tu saldo.
                </p>
              </div>
            </div>
          }
        } @else if (
          !facade.isLoading() && !facade.status()?.hasPaymentPending && facade.status() !== null
        ) {
          <!-- Sin deuda pendiente y sin enrollment (ya completado) -->
          <div class="card p-6 flex items-center gap-4" appCardHover>
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-success-subtle"
            >
              <app-icon name="check-circle" [size]="22" class="text-success" />
            </div>
            <div>
              <p class="item-title">Matrícula al día</p>
              <p class="text-xs text-text-muted mt-0.5">No tienes saldos pendientes de pago.</p>
            </div>
          </div>
        }
      </div>

      <!-- ── Historial de pagos — celda protagonista (fila fill, scroll interno) ──
           Sigue oculto ante error, igual que antes de este fix: la fila fill queda vacía
           y no hay nada que colapsar, porque no se renderiza celda .bento-fill alguna. -->
      @if (!facade.error()) {
        <div class="bento-banner bento-fill card p-5 flex flex-col gap-3" appCardHover>
          <h2 class="text-sm font-semibold text-text-primary uppercase tracking-wide shrink-0">
            Historial de pagos
          </h2>

          <!-- Único scroller de la celda: en desktop su alto lo dicta la fila fill. -->
          <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
            @if (facade.isLoading()) {
              <!-- Skeleton alineado arriba a propósito: representa una lista que también
                   empieza arriba; centrarlo mentiría sobre dónde aparecerá el contenido. -->
              <div class="flex flex-col gap-3">
                @for (i of [1, 2, 3]; track i) {
                  <app-skeleton-block variant="text" width="100%" height="52px" />
                }
              </div>
            } @else if (facade.payments().length === 0) {
              <!-- Centrado en el alto disponible: dentro de un .bento-fill la celda mide
                   el resto del viewport, y arriba quedaría con un hueco enorme debajo. -->
              <div class="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center">
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
                      <app-badge [variant]="payment.status === 'paid' ? 'success' : 'warning'">
                        {{ payment.status === 'paid' ? 'Pagado' : 'Pendiente' }}
                      </app-badge>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AlumnoPagosComponent implements OnInit {
  protected readonly facade = inject(StudentPaymentFacade);
  protected readonly context = inject(StudentEnrollmentContextFacade);
  private readonly router = inject(Router);

  protected readonly toCompact = toCompact;
  protected readonly clp = (amount: number) => formatCLP(amount);

  protected readonly enrollmentTabs = computed(() =>
    this.context.enrollments().map((enr) => ({ id: String(enr.id), label: enr.label })),
  );

  protected readonly activeEnrollmentStr = computed(() =>
    String(this.context.activeEnrollmentId()),
  );

  protected readonly heroSubtitle = computed(() => {
    const enroll = this.facade.enrollment();
    if (!enroll) {
      return 'Cargando información de tu matrícula…';
    }
    if (!this.facade.isClassB()) {
      return enroll.pendingBalance
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

  /**
   * KPIs del strip del hero slim (antes: grid `sm:grid-cols-3` dentro de un
   * `bento-banner`). Vacío mientras no hay `enrollment` (loading o matrícula
   * al día) — esos estados se siguen resolviendo fuera del hero.
   * Valores pre-formateados: el strip renderiza `{{ kpi.value }}` crudo y no
   * pasa por `animateCounter`.
   */
  protected readonly heroKpis = computed<SectionHeroKpi[]>(() => {
    const enroll = this.facade.enrollment();
    if (!enroll) return [];

    const total = toCompact(enroll.basePrice);
    const paid = toCompact(enroll.totalPaid);
    const pending = toCompact(enroll.pendingBalance);

    return [
      {
        id: 'total-curso',
        label: 'Total Curso',
        value: formatKpiEsCl(total.value),
        prefix: '$',
        suffix: total.suffix,
        subValue: this.clp(enroll.basePrice),
        icon: 'graduation-cap',
      },
      {
        id: 'ya-pagado',
        label: 'Ya Pagado',
        value: formatKpiEsCl(paid.value),
        prefix: '$',
        suffix: paid.suffix,
        subValue: this.clp(enroll.totalPaid),
        icon: 'circle-check',
        color: 'success',
      },
      {
        id: 'saldo-pendiente',
        label: 'Saldo Pendiente',
        value: formatKpiEsCl(pending.value),
        prefix: '$',
        suffix: pending.suffix,
        subValue: this.clp(enroll.pendingBalance),
        icon: 'clock',
        color: enroll.pendingBalance > 0 ? 'warning' : 'success',
      },
    ];
  });

  ngOnInit(): void {
    void this.facade.initialize();
  }

  protected onHeroAction(actionId: string): void {
    if (actionId === 'pay') {
      void this.router.navigate(['/app/alumno/pagar']);
    }
  }

  protected selectEnrollment(id: number): void {
    this.context.setActive(id);
    void this.facade.initialize();
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
