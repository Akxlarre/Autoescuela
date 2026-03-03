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
      class="relative flex min-h-[100dvh] flex-col items-center justify-center gap-8 overflow-hidden bg-base p-4"
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
          class="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent)"
        ></div>
      </div>

      <!-- Card de autenticación — wrapper ref para animación GSAP.
           w-full + max-w fija el ancho del wrapper independientemente
           del contenido interior (alertas, campos) — evita reflow horizontal. -->
      <div #cardRef class="w-full max-w-[440px]">
        <app-login-card
          [mode]="mode()"
          [loading]="loading()"
          [errorMsg]="errorMsg()"
          [successMsg]="successMsg()"
          (modeChange)="switchMode($event)"
          (formSubmit)="onSubmit($event)"
        />
      </div>

      <!-- ── Dev: acceso rápido a la app sin autenticación ─────────── -->
      @if (devMode) {
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg border border-dashed border-border-default bg-surface px-4 py-2 font-body text-xs text-text-muted transition-[var(--transition-color)] hover:border-brand hover:text-brand"
          data-llm-action="dev-skip-auth-navigate-to-app"
          (click)="navigateToApp()"
        >
          <app-icon name="arrow-right" [size]="13" />
          Saltarme el login → ir a la app
        </button>
      }
      <!-- ── /Dev: acceso rápido ───────────────────────────────────── -->

      <!-- ── Dev Test Panel ───────────────────────────────────────────
           Permite visualizar todos los estados sin flujo auth real.
           TODO: eliminar antes de producción.
      ─────────────────────────────────────────────────────────────── -->
      <div
        class="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl border border-border-default bg-surface px-5 py-3 shadow-sm"
        role="toolbar"
        aria-label="Panel de pruebas visuales"
      >
        <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Test visual
        </span>

        <div class="h-4 w-px bg-border-default"></div>

        <!-- Modos -->
        <div class="flex items-center gap-1" role="group" aria-label="Modo del formulario">
          @for (m of modes; track m.value) {
            <button
              type="button"
              class="rounded-md border px-3 py-1 text-xs font-medium transition-[var(--transition-color)]"
              [class.border-brand]="mode() === m.value"
              [class.text-brand]="mode() === m.value"
              [class.bg-brand-muted]="mode() === m.value"
              [class.border-border-default]="mode() !== m.value"
              [class.text-text-secondary]="mode() !== m.value"
              (click)="switchMode(m.value)"
            >
              {{ m.label }}
            </button>
          }
        </div>

        <div class="h-4 w-px bg-border-default"></div>

        <!-- Estados -->
        <div class="flex items-center gap-1" role="group" aria-label="Estados visuales">
          <button
            type="button"
            class="rounded-md border px-3 py-1 text-xs font-medium transition-[var(--transition-color)]"
            [class.border-error]="errorMsg()"
            [class.text-error]="errorMsg()"
            [class.bg-[var(--state-error-bg)]]="errorMsg()"
            [class.border-border-default]="!errorMsg()"
            [class.text-text-secondary]="!errorMsg()"
            (click)="toggleError()"
          >
            Error
          </button>

          <button
            type="button"
            class="rounded-md border px-3 py-1 text-xs font-medium transition-[var(--transition-color)]"
            [class.border-success]="successMsg()"
            [class.text-success]="successMsg()"
            [class.bg-[var(--state-success-bg)]]="successMsg()"
            [class.border-border-default]="!successMsg()"
            [class.text-text-secondary]="!successMsg()"
            (click)="toggleSuccess()"
          >
            Éxito
          </button>

          <button
            type="button"
            class="rounded-md border px-3 py-1 text-xs font-medium transition-[var(--transition-color)]"
            [class.border-brand]="loading()"
            [class.text-brand]="loading()"
            [class.bg-brand-muted]="loading()"
            [class.border-border-default]="!loading()"
            [class.text-text-secondary]="!loading()"
            (click)="loading.set(!loading())"
          >
            Cargando
          </button>
        </div>
      </div>
      <!-- ── /Dev Test Panel ──────────────────────────────────────── -->
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
