import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PublicEnrollmentFacade } from '@core/facades/public-enrollment.facade';
import { branchIdToTheme, type SedeTheme } from '@core/utils/sede-theme.utils';
import { formatCLP } from '@core/utils/date.utils';
import { IconComponent } from '@shared/components/icon/icon.component';

type RetornoStatus = 'loading' | 'success' | 'rejected' | 'error';
type RejectedReason = 'cancelled' | 'bank_rejected';

/**
 * Convierte mensajes técnicos de infraestructura en texto amigable para el usuario.
 * Los errores de red/Edge Function nunca deben mostrarse crudos al alumno.
 */
function sanitizeInfraError(message: string | null): string {
  if (!message) return 'No pudimos verificar el resultado de tu pago. Por favor contáctanos.';
  const isInfra =
    /edge function/i.test(message) ||
    /non-2xx/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message) ||
    /network request/i.test(message) ||
    /fetch.*failed/i.test(message) ||
    /econnrefused/i.test(message);
  if (isInfra) {
    return 'Hubo un problema de comunicación al verificar tu pago. Si realizaste el cargo, contáctanos con tu número de referencia de Transbank.';
  }
  return message;
}

function humanizeWebpayError(message: string | null): string {
  if (!message) return 'La transacción no pudo completarse.';
  if (/cancelaste/i.test(message)) return message;
  const codeMatch = message.match(/código\s+(-?\d+)/i);
  if (codeMatch) {
    const code = parseInt(codeMatch[1], 10);
    if (code === -1)
      return 'Tu banco rechazó la transacción. Puede ser por fondos insuficientes, límite de crédito o restricciones temporales de tu tarjeta.';
    if (code === -2) return 'La tarjeta no está habilitada para transacciones de este tipo.';
    if (code === -3) return 'Se superó el monto máximo permitido por operación.';
    if (code === -4) return 'La fecha de expiración ingresada no es correcta.';
    if (code === -5) return 'El problema es de tipo cambiario. Intenta con otra tarjeta.';
    return 'El banco rechazó la autorización del pago. Puedes intentar con otra tarjeta o contactar a tu banco.';
  }
  return message;
}

/** Lee el PendingPaymentRef del sessionStorage para recuperar branchId post-pago. */
function readPendingBranchId(): number | null {
  try {
    const raw = sessionStorage.getItem('pec_pending');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { branchId?: number };
    return typeof parsed.branchId === 'number' ? parsed.branchId : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-public-enrollment-retorno',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, RouterLink],
  host: { style: 'display: block;' },
  template: `
    <!-- Scope del tema de sede (lee branchId de sessionStorage post-pago) -->
    <div
      class="p-6"
      [attr.data-public-theme]="theme()"
      style="
        display: flex;
        min-height: 100dvh;
        width: 100%;
        align-items: center;
        justify-content: center;
        background: var(--bg-base);
      "
    >
      <!-- Orb decorativo de sede -->
      <div
        class="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none"
        style="background: var(--gradient-hero)"
        aria-hidden="true"
      ></div>

      <div
        class="surface-glass rounded-2xl p-8 w-full max-w-lg text-center relative"
        style="box-shadow: var(--pe-shadow-xl, var(--shadow-lg));"
      >
        @switch (status()) {
          @case ('loading') {
            <div class="flex flex-col items-center gap-4 py-6">
              <div
                class="w-12 h-12 rounded-full border-2 animate-spin"
                style="border-color: var(--ds-brand); border-top-color: transparent;"
                role="status"
                aria-label="Verificando pago..."
              ></div>
              <p style="color: var(--text-secondary);">Verificando el resultado del pago…</p>
            </div>
          }

          @case ('success') {
            <div class="flex flex-col items-center gap-5">
              <!-- Ícono éxito premium con gradiente de sede -->
              <div
                class="flex h-20 w-20 items-center justify-center rounded-full"
                style="
                  background: var(--gradient-primary);
                  box-shadow: 0 8px 24px -6px color-mix(in srgb, var(--ds-brand) 50%, transparent);
                "
              >
                <app-icon name="check" [size]="38" color="white" />
              </div>

              <div class="space-y-1">
                <h1
                  class="font-bold"
                  style="font-family: var(--font-display); font-size: 1.6rem; color: var(--text-primary);"
                >
                  ¡Pago confirmado!
                </h1>
                @if (studentName()) {
                  <p class="text-sm" style="color: var(--text-secondary);">
                    Bienvenido/a, {{ studentName() }}.
                  </p>
                }
              </div>

              <!-- N° Matrícula prominente -->
              @if (enrollmentNumber()) {
                <div
                  class="w-full rounded-xl p-4 text-center"
                  style="
                    background: var(--color-primary-muted);
                    border: 1px solid color-mix(in srgb, var(--ds-brand) 30%, transparent);
                  "
                >
                  <p
                    class="text-xs font-bold uppercase tracking-wider mb-1"
                    style="color: var(--color-primary);"
                  >
                    N° Matrícula
                  </p>
                  <p
                    class="kpi-value"
                    style="color: var(--color-primary);"
                    data-llm-description="enrollment number assigned after payment"
                  >
                    {{ enrollmentNumber() }}
                  </p>
                </div>
              }

              <!-- Detalle de la matrícula -->
              <div
                class="w-full rounded-xl p-4 text-left space-y-3"
                style="background: var(--bg-surface); border: 1px solid var(--border-default);"
              >
                @if (branchName()) {
                  <div class="flex items-start gap-3">
                    <app-icon
                      name="building-2"
                      [size]="16"
                      color="var(--text-muted)"
                      class="mt-0.5 shrink-0"
                    />
                    <div class="flex-1 flex justify-between items-start gap-2">
                      <span
                        class="text-xs uppercase tracking-wide"
                        style="color: var(--text-muted);"
                        >Sede</span
                      >
                      <div class="text-right">
                        <p class="text-sm font-medium" style="color: var(--text-primary);">
                          {{ branchName() }}
                        </p>
                        @if (branchAddress()) {
                          <p class="text-xs" style="color: var(--text-muted);">
                            {{ branchAddress() }}
                          </p>
                        }
                      </div>
                    </div>
                  </div>
                }
                @if (courseName()) {
                  <div class="flex items-center gap-3">
                    <app-icon
                      name="graduation-cap"
                      [size]="16"
                      color="var(--text-muted)"
                      class="shrink-0"
                    />
                    <div class="flex-1 flex justify-between items-center">
                      <span
                        class="text-xs uppercase tracking-wide"
                        style="color: var(--text-muted);"
                        >Curso</span
                      >
                      <span class="text-sm font-medium" style="color: var(--text-primary);">{{
                        courseName()
                      }}</span>
                    </div>
                  </div>
                }
                @if (sessionCount()) {
                  <div class="flex items-center gap-3">
                    <app-icon
                      name="calendar-days"
                      [size]="16"
                      color="var(--text-muted)"
                      class="shrink-0"
                    />
                    <div class="flex-1 flex justify-between items-center">
                      <span
                        class="text-xs uppercase tracking-wide"
                        style="color: var(--text-muted);"
                        >Clases prácticas</span
                      >
                      <span class="text-sm font-medium" style="color: var(--text-primary);"
                        >{{ sessionCount() }} clases</span
                      >
                    </div>
                  </div>
                }
                <div style="border-top: 1px solid var(--border-subtle);"></div>
                @if (amountPaid() !== null) {
                  <div class="flex items-center gap-3">
                    <app-icon
                      name="credit-card"
                      [size]="16"
                      color="var(--text-muted)"
                      class="shrink-0"
                    />
                    <div class="flex-1 flex justify-between items-center">
                      <span
                        class="text-xs uppercase tracking-wide"
                        style="color: var(--text-muted);"
                      >
                        {{ paymentMode() === 'partial' ? 'Abono pagado' : 'Total pagado' }}
                      </span>
                      <span class="text-sm font-semibold" style="color: var(--text-primary);">
                        {{ formatClp(amountPaid()!) }}
                      </span>
                    </div>
                  </div>
                }
                @if (pendingBalance() && pendingBalance()! > 0) {
                  <div class="flex items-center gap-3">
                    <app-icon name="clock" [size]="16" color="var(--text-muted)" class="shrink-0" />
                    <div class="flex-1 flex justify-between items-center">
                      <span
                        class="text-xs uppercase tracking-wide"
                        style="color: var(--text-muted);"
                        >Saldo pendiente</span
                      >
                      <span class="text-sm font-medium" style="color: var(--state-warning);">
                        {{ formatClp(pendingBalance()!) }}
                      </span>
                    </div>
                  </div>
                }
              </div>

              <p class="text-sm" style="color: var(--text-secondary);">
                Recibirás un correo con los detalles y el horario de tus clases prácticas.
              </p>

              <!-- CTAs (AC11): WhatsApp primario, portal secundario -->
              <div class="flex flex-col gap-3 w-full">
                <!-- CTA principal: WhatsApp de la sede -->
                <a
                  [href]="whatsappHref()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-primary flex items-center justify-center gap-2 w-full rounded-xl py-3 font-semibold"
                  data-llm-action="contact-school-whatsapp"
                  data-llm-description="Contact the driving school via WhatsApp after enrollment confirmation"
                >
                  <app-icon name="message-circle" [size]="18" color="white" />
                  Contactar a la escuela por WhatsApp
                </a>
                <!-- CTA secundario: portal del alumno -->
                <a
                  routerLink="/app/dashboard"
                  class="btn-secondary flex items-center justify-center gap-2 w-full rounded-xl py-2.5 font-semibold"
                  data-llm-nav="student-portal-dashboard"
                >
                  <app-icon name="layout-dashboard" [size]="16" color="var(--color-primary)" />
                  Ir al portal del alumno
                </a>
                <!-- Terciario: volver al inicio -->
                <a
                  routerLink="/inscripcion"
                  class="text-xs text-center cursor-pointer"
                  style="color: var(--text-muted);"
                  data-llm-nav="public-enrollment-start"
                >
                  Volver al inicio de inscripción
                </a>
              </div>
            </div>
          }

          @case ('rejected') {
            <div class="flex flex-col items-center gap-5">
              <div
                class="flex h-16 w-16 items-center justify-center rounded-full"
                [style.background]="
                  rejectedReason() === 'cancelled'
                    ? 'var(--state-warning-bg)'
                    : 'var(--state-error-bg)'
                "
              >
                <app-icon
                  [name]="rejectedReason() === 'cancelled' ? 'circle-x' : 'x-circle'"
                  [size]="32"
                  [color]="
                    rejectedReason() === 'cancelled' ? 'var(--state-warning)' : 'var(--state-error)'
                  "
                />
              </div>

              @if (rejectedReason() === 'cancelled') {
                <div class="space-y-1 text-center">
                  <h1
                    class="font-bold"
                    style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
                  >
                    Pago cancelado
                  </h1>
                  <p class="text-sm" style="color: var(--text-secondary);">
                    No completaste el proceso de pago en Webpay. No se realizó ningún cargo.
                  </p>
                </div>
                <p class="text-sm text-center" style="color: var(--text-secondary);">
                  Puedes intentarlo de nuevo. Tu sesión de matrícula sigue disponible.
                </p>
              } @else {
                <div class="space-y-1 text-center">
                  <h1
                    class="font-bold"
                    style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
                  >
                    Pago no autorizado
                  </h1>
                  <p class="text-sm" style="color: var(--text-secondary);">
                    Tu banco no autorizó esta transacción. No se realizó ningún cargo.
                  </p>
                </div>
                <div
                  class="w-full rounded-xl p-4 text-sm space-y-2"
                  style="background: var(--bg-surface); border: 1px solid var(--border-default);"
                >
                  <p style="color: var(--text-secondary);">{{ errorMessage() }}</p>
                  <p class="text-xs" style="color: var(--text-muted);">
                    Si el problema persiste, intenta con otra tarjeta o contacta a tu banco.
                  </p>
                </div>
              }

              <div class="flex flex-col gap-3 w-full">
                <a
                  routerLink="/inscripcion"
                  class="btn-primary flex items-center justify-center gap-2 w-full rounded-xl py-3 font-semibold"
                  data-llm-nav="public-enrollment-retry"
                  data-llm-action="retry-enrollment"
                >
                  {{
                    rejectedReason() === 'cancelled'
                      ? 'Reintentar pago'
                      : 'Intentar con otra tarjeta'
                  }}
                </a>
                <a
                  [href]="whatsappHref()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-secondary flex items-center justify-center gap-2 w-full rounded-xl py-2.5"
                  data-llm-action="contact-school-whatsapp-rejected"
                >
                  <app-icon name="message-circle" [size]="16" color="var(--color-primary)" />
                  Contactar a la escuela
                </a>
              </div>
            </div>
          }

          @case ('error') {
            <div class="flex flex-col items-center gap-5">
              <div
                class="flex h-16 w-16 items-center justify-center rounded-full"
                style="background: var(--state-warning-bg);"
              >
                <app-icon name="alert-triangle" [size]="32" color="var(--state-warning)" />
              </div>
              <div class="space-y-1 text-center">
                <h1
                  class="font-bold"
                  style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
                >
                  Error al verificar el pago
                </h1>
                <p class="text-sm" style="color: var(--text-secondary);">
                  {{ errorMessage() ?? 'Ocurrió un error inesperado.' }}
                </p>
              </div>
              <p class="text-sm text-center" style="color: var(--text-secondary);">
                Si realizaste el pago y el problema persiste, contáctanos con tu número de
                referencia de Transbank.
              </p>
              <div class="flex flex-col gap-3 w-full">
                <a
                  [href]="whatsappHref()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="btn-primary flex items-center justify-center gap-2 w-full rounded-xl py-3 font-semibold"
                  data-llm-action="contact-school-whatsapp-error"
                >
                  <app-icon name="message-circle" [size]="18" color="white" />
                  Contactar a la escuela
                </a>
                <a
                  routerLink="/inscripcion"
                  class="btn-secondary flex items-center justify-center w-full rounded-xl py-2.5"
                  data-llm-nav="public-enrollment-start"
                >
                  Volver al inicio
                </a>
              </div>
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
  readonly rejectedReason = signal<RejectedReason>('bank_rejected');
  readonly enrollmentNumber = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly studentName = signal<string | null>(null);
  readonly branchName = signal<string | null>(null);
  readonly courseName = signal<string | null>(null);
  readonly amountPaid = signal<number | null>(null);
  readonly pendingBalance = signal<number | null>(null);
  readonly sessionCount = signal<number | null>(null);
  readonly paymentMode = signal<string | null>(null);
  readonly branchAddress = signal<string | null>(null);

  /** Tema de sede desde el PendingPaymentRef guardado antes del redirect a Webpay. */
  private readonly _branchId = signal<number | null>(readPendingBranchId());
  readonly theme = computed<SedeTheme>(() => branchIdToTheme(this._branchId()));

  /**
   * URL de WhatsApp de la sede.
   * TODO(spec-0009): cuando `branches` exponga `whatsapp_url`, usar ese dato.
   * Por ahora abre WhatsApp Web sin número predeterminado (el alumno verá la app abierta).
   */
  readonly whatsappHref = computed<string>(() => 'https://wa.me/');

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const tokenWs = params.get('token_ws');
    const tbkToken = params.get('TBK_TOKEN');

    if (!tokenWs && tbkToken) {
      this.status.set('rejected');
      this.rejectedReason.set('cancelled');
      return;
    }

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
      this.rejectedReason.set('bank_rejected');
      this.errorMessage.set(humanizeWebpayError(result.message ?? null));
      this.status.set('rejected');
    } else {
      this.errorMessage.set(sanitizeInfraError(result.message ?? null));
      this.status.set('error');
    }
  }

  formatClp(amount: number): string {
    return formatCLP(amount);
  }
}
