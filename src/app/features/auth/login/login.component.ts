import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
  isDevMode,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import {
  LoginCardComponent,
  LoginFormData,
} from '@shared/components/login-card/login-card.component';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * LoginComponent — Smart container de autenticación.
 *
 * Responsabilidades:
 *   - Coordina el estado (mode, loading, errorMsg, successMsg) via signals
 *   - Delega toda la UI a LoginCardComponent (Dumb)
 *   - Llama a AuthFacade para login / register / reset
 *
 * El panel de test visual (al final del template) permite alternar
 * estados sin flujo auth real. Eliminar antes de producción.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoginCardComponent, IconComponent],
  template: `
    <div
      class="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-base p-4"
    >
      <!-- Orbs decorativos — backdrop para el efecto glass de la card -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          class="absolute -left-40 -top-40 h-96 w-96 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--ds-brand) 18%, transparent)"
        ></div>
        <div
          class="absolute -bottom-40 -right-20 h-80 w-80 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--color-primary-dark) 14%, transparent)"
        ></div>
        <div
          class="absolute left-1/2 top-1/2 h-140 w-140 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent)"
        ></div>
      </div>

      <!-- Card de autenticación — wrapper ref para animación GSAP.
           w-full + max-w fija el ancho del wrapper independientemente
           del contenido interior (alertas, campos) — evita reflow horizontal. -->
      <div #cardRef class="w-full max-w-110">
        <app-login-card
          [mode]="mode()"
          [loading]="loading()"
          [errorMsg]="errorMsg()"
          [successMsg]="successMsg()"
          (modeChange)="switchMode($event)"
          (formSubmit)="onSubmit($event)"
        />
      </div>

      <!-- ── Recordatorio de credenciales de prueba ─────────────────── -->
      @if (devMode) {
        <div
          class="w-full max-w-110 rounded-xl border border-border-subtle bg-surface px-4 py-3 font-body text-[11px] text-text-muted shadow-sm"
          aria-label="Credenciales de prueba disponibles"
        >
          <p class="m-0 mb-1 flex items-center gap-1 font-semibold text-text-secondary">
            <app-icon name="info" [size]="14" style="color: var(--text-muted)" />
            Credenciales de prueba
          </p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-2">
            <span>admin@test.com</span>
            <span>secretaria@test.com</span>
            <span>secretaria2@test.com</span>
            <span>alumno@test.com</span>
            <span>instructor@test.com</span>
          </div>
          <p class="m-0">
            <span class="font-semibold text-text-secondary">Contraseña:</span>
            <span class="font-normal"> Test123456</span>
          </p>
        </div>
      }
      <!-- ── /Recordatorio de credenciales de prueba ────────────────── -->
    </div>
  `,
  host: { style: 'display: contents;' },
})
export class LoginComponent {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly gsap = inject(GsapAnimationsService);

  /** Solo true en `ng serve` / builds de desarrollo. False en producción. */
  readonly devMode = isDevMode();

  readonly cardRef = viewChild<ElementRef<HTMLElement>>('cardRef');

  readonly mode = signal<'login' | 'reset'>('login');
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');

  readonly modes: { value: 'login' | 'reset'; label: string }[] = [
    { value: 'login', label: 'Login' },
    { value: 'reset', label: 'Reset' },
  ];

  constructor() {
    afterNextRender(() => {
      const el = this.cardRef()?.nativeElement;
      if (el) this.gsap.animateHero(el);
    });
  }

  switchMode(newMode: 'login' | 'reset'): void {
    this.mode.set(newMode);
    this.errorMsg.set('');
    this.successMsg.set('');
  }

  toggleError(): void {
    this.errorMsg.set(this.errorMsg() ? '' : 'Error de autenticación: credenciales inválidas.');
    this.successMsg.set('');
  }

  navigateToApp(): void {
    this.router.navigate(['/app']);
  }

  toggleSuccess(): void {
    this.successMsg.set(
      this.successMsg() ? '' : 'Cuenta creada. Revisa tu correo para confirmar tu registro.',
    );
    this.errorMsg.set('');
  }

  async onSubmit(data: LoginFormData): Promise<void> {
    this.errorMsg.set('');
    this.successMsg.set('');
    this.loading.set(true);

    try {
      switch (this.mode()) {
        case 'login': {
          const { error } = await this.auth.login(data.email, data.password);
          if (error) {
            this.errorMsg.set(error.message);
          } else {
            this.router.navigate(['/app']);
          }
          break;
        }

        case 'reset': {
          const { error } = await this.auth.resetPasswordForEmail(data.email);
          if (error) {
            this.errorMsg.set(error.message);
          } else {
            this.successMsg.set('Se envió un enlace de recuperación a tu correo.');
          }
          break;
        }
      }
    } catch {
      this.errorMsg.set('Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }
}
