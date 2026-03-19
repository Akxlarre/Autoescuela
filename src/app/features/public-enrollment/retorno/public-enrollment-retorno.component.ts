import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicEnrollmentFacade } from '@core/facades/public-enrollment.facade';
import { IconComponent } from '@shared/components/icon/icon.component';

type RetornoStatus = 'loading' | 'success' | 'rejected' | 'error';

@Component({
  selector: 'app-public-enrollment-retorno',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  template: `
    <div class="min-h-screen bg-base flex items-center justify-center p-6">
      <!-- Orb decorativo -->
      <div
        class="fixed top-0 left-1/2 -translate-x-1/2 w-150 h-100 rounded-full opacity-10 blur-3xl pointer-events-none"
        style="background: var(--ds-brand)"
        aria-hidden="true"
      ></div>

      <div class="surface-glass rounded-2xl p-8 w-full max-w-lg text-center relative">
        @switch (status()) {
          @case ('loading') {
            <div class="flex flex-col items-center gap-4 py-4">
              <div
                class="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                style="border-color: var(--ds-brand); border-top-color: transparent"
                role="status"
                aria-label="Verificando pago..."
              ></div>
              <p class="text-secondary">Verificando el resultado del pago...</p>
            </div>
          }

          @case ('success') {
            <div class="flex flex-col items-center gap-5">
              <!-- Ícono de éxito -->
              <div
                class="w-16 h-16 rounded-full flex items-center justify-center"
                style="background: var(--color-success-muted)"
              >
                <app-icon name="check-circle" [size]="32" style="color: var(--color-success)" />
              </div>

              <!-- Título -->
              <div class="flex flex-col gap-1">
                <h1 class="text-xl font-semibold text-primary">¡Pago confirmado!</h1>
                @if (studentName()) {
                  <p class="text-secondary text-sm">Bienvenido/a, {{ studentName() }}.</p>
                } @else {
                  <p class="text-secondary text-sm">Tu matrícula ha sido procesada exitosamente.</p>
                }
              </div>

              <!-- N° Matrícula destacado -->
              @if (enrollmentNumber()) {
                <div class="card-tinted p-4 w-full text-center">
                  <p class="text-muted text-xs uppercase tracking-wide mb-1">N° Matrícula</p>
                  <p
                    class="kpi-value"
                    data-llm-description="enrollment number assigned after payment"
                  >
                    {{ enrollmentNumber() }}
                  </p>
                </div>
              }

              <!-- Detalle de la matrícula -->
              <div class="card p-4 w-full text-left flex flex-col gap-3">
                @if (branchName()) {
                  <div class="flex items-start gap-3">
                    <app-icon name="building-2" [size]="16" class="text-muted shrink-0 mt-0.5" />
                    <div class="flex-1 flex justify-between items-start gap-2">
                      <span class="text-muted text-xs uppercase tracking-wide">Sede</span>
                      <div class="text-right">
                        <p class="text-primary text-sm font-medium">{{ branchName() }}</p>
                        @if (branchAddress()) {
                          <p class="text-muted text-xs">{{ branchAddress() }}</p>
                        }
                      </div>
                    </div>
                  </div>
                }
                @if (courseName()) {
                  <div class="flex items-center gap-3">
                    <app-icon name="graduation-cap" [size]="16" class="text-muted shrink-0" />
                    <div class="flex-1 flex justify-between items-center">
                      <span class="text-muted text-xs uppercase tracking-wide">Curso</span>
                      <span class="text-primary text-sm font-medium">{{ courseName() }}</span>
                    </div>
                  </div>
                }
                @if (sessionCount()) {
                  <div class="flex items-center gap-3">
                    <app-icon name="calendar-days" [size]="16" class="text-muted shrink-0" />
                    <div class="flex-1 flex justify-between items-center">
                      <span class="text-muted text-xs uppercase tracking-wide"
                        >Clases prácticas agendadas</span
                      >
                      <span class="text-primary text-sm font-medium"
                        >{{ sessionCount() }} clases</span
                      >
                    </div>
                  </div>
                }
                <div class="border-t" style="border-color: var(--color-border)"></div>
                @if (amountPaid() !== null) {
                  <div class="flex items-center gap-3">
                    <app-icon name="credit-card" [size]="16" class="text-muted shrink-0" />
                    <div class="flex-1 flex justify-between items-center">
                      <span class="text-muted text-xs uppercase tracking-wide">
                        {{ paymentMode() === 'partial' ? 'Abono pagado' : 'Total pagado' }}
                      </span>
                      <span class="text-primary text-sm font-semibold">{{
                        formatClp(amountPaid()!)
                      }}</span>
                    </div>
                  </div>
                }
                @if (pendingBalance() && pendingBalance()! > 0) {
                  <div class="flex items-center gap-3">
                    <app-icon name="clock" [size]="16" class="text-muted shrink-0" />
                    <div class="flex-1 flex justify-between items-center">
                      <span class="text-muted text-xs uppercase tracking-wide"
                        >Saldo pendiente</span
                      >
                      <span class="text-sm font-medium" style="color: var(--color-warning)">
                        {{ formatClp(pendingBalance()!) }}
                      </span>
                    </div>
                  </div>
                }
              </div>

              <p class="text-secondary text-sm">
                Recibirás un correo con los detalles y el horario de tus clases.
              </p>

              <a
                routerLink="/inscripcion"
                class="btn-secondary mt-1 w-full"
                data-llm-nav="public-enrollment-start"
              >
                Volver al inicio
              </a>
            </div>
          }

          @case ('rejected') {
            <div class="flex flex-col items-center gap-4">
              <div
                class="w-16 h-16 rounded-full flex items-center justify-center"
                style="background: var(--color-error-muted)"
              >
                <app-icon name="x-circle" [size]="32" style="color: var(--color-error)" />
              </div>
              <div class="flex flex-col gap-1">
                <h1 class="text-xl font-semibold text-primary">Pago rechazado</h1>
                <p class="text-secondary text-sm">
                  Tu pago no pudo ser procesado. No se realizó ningún cargo.
                </p>
              </div>
              <p class="text-secondary text-sm">
                {{ errorMessage() ?? 'Por favor intenta nuevamente o elige otro método de pago.' }}
              </p>
              <a
                routerLink="/inscripcion"
                class="btn-primary mt-2"
                data-llm-nav="public-enrollment-retry"
                data-llm-action="retry-enrollment"
              >
                Intentar nuevamente
              </a>
            </div>
          }

          @case ('error') {
            <div class="flex flex-col items-center gap-4">
              <div
                class="w-16 h-16 rounded-full flex items-center justify-center"
                style="background: var(--color-warning-muted)"
              >
                <app-icon name="alert-triangle" [size]="32" style="color: var(--color-warning)" />
              </div>
              <div class="flex flex-col gap-1">
                <h1 class="text-xl font-semibold text-primary">Error al verificar el pago</h1>
                <p class="text-secondary text-sm">
                  {{ errorMessage() ?? 'Ocurrió un error inesperado.' }}
                </p>
              </div>
              <p class="text-secondary text-sm">
                Si realizaste el pago y el problema persiste, contáctanos con tu número de
                referencia de Transbank.
              </p>
              <a
                routerLink="/inscripcion"
                class="btn-secondary mt-2"
                data-llm-nav="public-enrollment-start"
              >
                Volver al inicio
              </a>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class PublicEnrollmentRetornoComponent implements OnInit {
  private readonly facade = inject(PublicEnrollmentFacade);
  private readonly route = inject(ActivatedRoute);

  readonly status = signal<RetornoStatus>('loading');
  readonly enrollmentNumber = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Datos enriquecidos del resultado del pago
  readonly studentName = signal<string | null>(null);
  readonly branchName = signal<string | null>(null);
  readonly courseName = signal<string | null>(null);
  readonly amountPaid = signal<number | null>(null);
  readonly pendingBalance = signal<number | null>(null);
  readonly sessionCount = signal<number | null>(null);
  readonly paymentMode = signal<string | null>(null);
  readonly branchAddress = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const tokenWs = params.get('token_ws');
    const tbkToken = params.get('TBK_TOKEN'); // presente cuando el usuario cancela en Webpay

    // Usuario canceló el pago en Webpay (Transbank envía TBK_TOKEN sin token_ws)
    if (!tokenWs && tbkToken) {
      this.status.set('rejected');
      this.errorMessage.set('Cancelaste el pago en Webpay. Puedes intentarlo nuevamente.');
      return;
    }

    // Timeout o error de Transbank (no llega ningún token)
    if (!tokenWs) {
      this.status.set('error');
      this.errorMessage.set(
        'No se recibió confirmación de Transbank. Si el problema persiste, contáctanos.',
      );
      return;
    }

    void this.confirmPayment(tokenWs);
  }

  private async confirmPayment(tokenWs: string): Promise<void> {
    const result = await this.facade.confirmPayment(tokenWs);

    if (result.success) {
      this.enrollmentNumber.set(result.enrollmentNumber ?? null);
      this.studentName.set(result.studentName ?? null);
      this.branchName.set(result.branchName ?? null);
      this.branchAddress.set(result.branchAddress ?? null);
      this.courseName.set(result.courseName ?? null);
      this.amountPaid.set(result.amountPaid ?? null);
      this.pendingBalance.set(result.pendingBalance ?? null);
      this.sessionCount.set(result.sessionCount ?? null);
      this.paymentMode.set(result.paymentMode ?? null);
      this.status.set('success');
    } else if (result.rejected) {
      this.errorMessage.set(result.message ?? null);
      this.status.set('rejected');
    } else {
      this.errorMessage.set(result.message ?? null);
      this.status.set('error');
    }
  }

  formatClp(amount: number): string {
    return '$' + amount.toLocaleString('es-CL');
  }
}
