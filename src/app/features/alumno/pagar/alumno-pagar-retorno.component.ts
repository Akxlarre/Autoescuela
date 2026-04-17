import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { StudentPaymentFacade } from '@core/facades/student-payment.facade';
import type { StudentPaymentResult } from '@core/models/ui/student-payment.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';

/**
 * AlumnoPagarRetornoComponent — Página de retorno desde Webpay Plus.
 *
 * Webpay redirige al alumno a /app/alumno/pagar/retorno con el query param
 * `token_ws` (pago aprobado/rechazado) o `TBK_TOKEN` (timeout/abandono).
 * Este componente confirma el pago con la Edge Function y muestra el resultado.
 *
 * Smart Component: inyecta StudentPaymentFacade y Router.
 */
@Component({
  selector: 'app-alumno-pagar-retorno',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SkeletonBlockComponent],
  template: `
    <div class="p-6 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <!-- ── Cargando ── -->
      @if (isConfirming()) {
        <div class="card p-8 w-full flex flex-col items-center gap-4 text-center">
          <app-skeleton-block variant="circle" width="64px" height="64px" />
          <app-skeleton-block variant="text" width="70%" height="24px" />
          <app-skeleton-block variant="text" width="90%" height="16px" />
          <app-skeleton-block variant="text" width="60%" height="16px" />
          <p class="text-xs text-text-muted mt-2">Confirmando pago con Transbank…</p>
        </div>
      }

      <!-- ── Abandono / timeout ── -->
      @if (!isConfirming() && wasAbandoned()) {
        <div class="card p-8 w-full flex flex-col items-center gap-4 text-center">
          <div
            class="w-16 h-16 rounded-full flex items-center justify-center"
            style="background: var(--color-warning-muted)"
          >
            <app-icon name="clock" [size]="32" style="color: var(--color-warning)" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-text-primary">Pago cancelado</h1>
            <p class="text-sm text-text-muted mt-1">
              Saliste del proceso de pago o el tiempo de sesión venció. Tus horarios seleccionados
              fueron liberados.
            </p>
          </div>
          <button
            class="btn-secondary w-full flex items-center justify-center gap-2"
            (click)="goToWizard()"
            data-llm-action="retry-payment"
          >
            <app-icon name="refresh-cw" [size]="14" />
            Intentar nuevamente
          </button>
          <button class="text-xs text-text-muted underline" (click)="goToPagos()">
            Ver mis pagos
          </button>
        </div>
      }

      <!-- ── Rechazado ── -->
      @if (!isConfirming() && result()?.rejected) {
        <div class="card p-8 w-full flex flex-col items-center gap-4 text-center">
          <div
            class="w-16 h-16 rounded-full flex items-center justify-center"
            style="background: var(--color-error-muted)"
          >
            <app-icon name="x-circle" [size]="32" style="color: var(--color-error)" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-text-primary">Pago rechazado</h1>
            <p class="text-sm text-text-muted mt-1">
              {{
                result()?.message ??
                  'Tu banco rechazó el pago. Verifica los datos de tu tarjeta e intenta nuevamente.'
              }}
            </p>
          </div>
          <button
            class="btn-primary w-full flex items-center justify-center gap-2"
            (click)="goToWizard()"
            data-llm-action="retry-payment"
          >
            <app-icon name="refresh-cw" [size]="14" />
            Intentar nuevamente
          </button>
          <button class="text-xs text-text-muted underline" (click)="goToPagos()">
            Volver a Mis Pagos
          </button>
        </div>
      }

      <!-- ── Error técnico ── -->
      @if (!isConfirming() && !wasAbandoned() && !result()?.rejected && result()?.error) {
        <div class="card p-8 w-full flex flex-col items-center gap-4 text-center">
          <div
            class="w-16 h-16 rounded-full flex items-center justify-center"
            style="background: var(--color-error-muted)"
          >
            <app-icon name="alert-circle" [size]="32" style="color: var(--color-error)" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-text-primary">Error al confirmar</h1>
            <p class="text-sm text-text-muted mt-1">
              Ocurrió un problema al verificar tu pago. Si el dinero fue descontado, contáctanos con
              tu comprobante de Webpay.
            </p>
            <p class="text-xs text-text-muted mt-2 font-mono">
              {{ result()?.error }}
            </p>
          </div>
          <button class="btn-secondary w-full" (click)="goToPagos()">Volver a Mis Pagos</button>
        </div>
      }

      <!-- ── Éxito ── -->
      @if (!isConfirming() && result()?.success && !result()?.error) {
        <div class="card p-8 w-full flex flex-col items-center gap-4 text-center">
          <div
            class="w-16 h-16 rounded-full flex items-center justify-center"
            style="background: var(--color-success-muted)"
          >
            <app-icon name="check-circle" [size]="32" style="color: var(--color-success)" />
          </div>
          <div>
            <h1 class="text-xl font-semibold text-text-primary">¡Pago exitoso!</h1>
            @if (result(); as r) {
              <p class="text-sm text-text-muted mt-1">
                Se registró tu pago de
                <strong style="color: var(--ds-brand)">{{ formatClp(r.amountPaid ?? 0) }}</strong>
                para
                <strong>{{ r.courseName }}</strong>
                (Matrícula N°&nbsp;{{ r.enrollmentNumber }}).
              </p>
              @if ((r.sessionCount ?? 0) > 0) {
                <p class="text-sm text-text-muted mt-1">
                  Se agendaron
                  <strong>{{ r.sessionCount }} clases prácticas</strong>
                  con tu instructor.
                </p>
              }
              @if ((r.pendingBalance ?? 0) === 0) {
                <p class="text-xs mt-2" style="color: var(--color-success)">
                  Tu matrícula está completamente pagada.
                </p>
              }
            }
          </div>

          <button
            class="btn-primary w-full flex items-center justify-center gap-2"
            (click)="goToClases()"
            data-llm-action="go-to-clases"
          >
            <app-icon name="calendar" [size]="14" />
            Ver mis clases agendadas
          </button>
          <button class="text-xs text-text-muted underline cursor-pointer" (click)="goToPagos()">
            Ver comprobante en Mis Pagos
          </button>
        </div>
      }
    </div>
  `,
})
export class AlumnoPagarRetornoComponent implements OnInit {
  private readonly facade = inject(StudentPaymentFacade);
  private readonly router = inject(Router);

  protected readonly isConfirming = signal(true);
  protected readonly wasAbandoned = signal(false);
  protected readonly result = signal<StudentPaymentResult | null>(null);

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const tokenWs = params.get('token_ws');
    const tbkToken = params.get('TBK_TOKEN');

    if (!tokenWs && !tbkToken) {
      // Llegó sin token — acceso directo a la URL, redirigir
      void this.router.navigate(['/app/alumno/pagos']);
      return;
    }

    if (tbkToken || !tokenWs) {
      // Abandono o timeout: Webpay envía TBK_TOKEN y no token_ws
      this.isConfirming.set(false);
      this.wasAbandoned.set(true);
      return;
    }

    // Confirmar el pago
    void this.confirm(tokenWs);
  }

  private async confirm(tokenWs: string): Promise<void> {
    const res = await this.facade.confirmPayment(tokenWs);
    this.result.set(res);
    this.isConfirming.set(false);
  }

  protected goToWizard(): void {
    void this.router.navigate(['/app/alumno/pagar']);
  }

  protected goToPagos(): void {
    void this.router.navigate(['/app/alumno/pagos']);
  }

  protected goToClases(): void {
    void this.router.navigate(['/app/alumno/clases']);
  }

  protected formatClp(amount: number): string {
    return '$' + amount.toLocaleString('es-CL');
  }
}
