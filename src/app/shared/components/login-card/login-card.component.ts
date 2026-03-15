import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  viewChild,
  ElementRef,
  afterNextRender,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import gsap from 'gsap';

export interface LoginFormData {
  email: string;
  password: string;
}

/**
 * LoginCardComponent — Presentación visual del formulario de autenticación.
 *
 * Dumb component: recibe estado por input(), emite eventos por output().
 * Sin inyección de servicios de datos. GSAP importado directamente para
 * micro-animaciones de layout (campo contraseña + mensajes de estado).
 *
 * Técnica: todos los contenedores animables están SIEMPRE en DOM con
 * overflow:hidden. GSAP anima height 0↔auto y opacity 0↔1.
 * La `private ready` flag evita animaciones durante la hidratación inicial.
 *
 * Modos: 'login' | 'reset'
 */
@Component({
  selector: 'app-login-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  template: `
    <div class="surface-glass w-full max-w-110 rounded-2xl p-10">
      <!-- Logo / Brand -->
      <div class="mb-8 text-center">
        <div
          class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl"
          style="background: var(--gradient-primary); box-shadow: 0 8px 40px color-mix(in srgb, var(--ds-brand) 35%, transparent)"
        >
          <app-icon name="car" [size]="32" color="white" />
        </div>
        <p class="m-0 mb-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
          Autoescuela
        </p>
        <h1 class="m-0 mb-1 font-display text-2xl font-bold text-text-primary">
          @switch (mode()) {
            @case ('reset') {
              Recuperar Contraseña
            }
            @default {
              Bienvenido de vuelta
            }
          }
        </h1>
        <p class="m-0 text-sm text-text-muted">
          @switch (mode()) {
            @case ('reset') {
              Ingresa tu correo para recibir un enlace
            }
            @default {
              Ingresa tus credenciales para continuar
            }
          }
        </p>
      </div>

      <!--
        Mensajes de error y éxito — siempre en DOM.
        GSAP anima height: 0 → auto y marginBottom: 0 → 16px al aparecer.
        overflow:hidden en el wrapper garantiza que el contenido no sea
        visible cuando height = 0, sin causar layout shift.
      -->
      <div #errorMsgRef style="overflow: hidden">
        <div
          class="flex items-center gap-2 rounded-md border border-(--state-error-border) bg-(--state-error-bg) px-4 py-3 text-sm text-error"
          role="alert"
          [attr.aria-live]="errorMsg() ? 'assertive' : null"
        >
          <app-icon name="alert-triangle" [size]="14" />
          {{ errorMsg() }}
        </div>
      </div>

      <div #successMsgRef style="overflow: hidden">
        <div
          class="flex items-center gap-2 rounded-md border border-(--state-success-border) bg-(--state-success-bg) px-4 py-3 text-sm text-success"
          role="status"
        >
          <app-icon name="check" [size]="14" />
          {{ successMsg() }}
        </div>
      </div>

      <!--
        Form — flex sin gap. Espaciado via pb-4 en cada campo wrapper.
        Así el campo contraseña (#passwordWrapRef) puede colapsar a height:0
        sin dejar huecos de gap residuales en el flex container.
      -->
      <form class="flex flex-col" (ngSubmit)="handleSubmit()" data-llm-form="auth-form">
        <!-- Email -->
        <div class="flex flex-col gap-2 pb-4">
          <label for="lc-email" class="text-sm font-medium text-text-secondary">
            Correo electrónico
          </label>
          <input
            id="lc-email"
            type="email"
            data-llm-description="User email address for authentication"
            class="w-full box-border rounded-(--input-radius) border border-(--input-border-default) bg-(--input-bg) px-(--input-padding-x) py-(--input-padding-y) font-body text-(--input-text) outline-none transition-(--transition-input) placeholder:text-(--input-placeholder) focus:border-(--input-border-focus) focus:shadow-(--input-shadow-focus-neutral)"
            placeholder="tu@correo.com"
            [(ngModel)]="email"
            name="email"
            required
            autocomplete="email"
          />
        </div>

        <!--
          Password — siempre en DOM. GSAP: height 0↔auto según modo.
          Inner div con pb-4 para espaciar al botón submit cuando está visible.
        -->
        <div #passwordWrapRef style="overflow: hidden">
          <div class="flex flex-col gap-2 pb-4">
            <label for="lc-password" class="text-sm font-medium text-text-secondary">
              Contraseña
            </label>
            <input
              id="lc-password"
              type="password"
              data-llm-description="User password for authentication"
              class="w-full box-border rounded-(--input-radius) border border-(--input-border-default) bg-(--input-bg) px-(--input-padding-x) py-(--input-padding-y) font-body text-(--input-text) outline-none transition-(--transition-input) placeholder:text-(--input-placeholder) focus:border-(--input-border-focus) focus:shadow-(--input-shadow-focus-neutral)"
              placeholder="••••••••"
              [(ngModel)]="password"
              name="password"
              [attr.required]="mode() !== 'reset' ? '' : null"
              autocomplete="current-password"
            />
          </div>
        </div>

        <!-- Submit -->
        <button
          type="submit"
          data-llm-action="submit-auth-form"
          class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-(--btn-primary-radius) border-none bg-(--btn-primary-bg) px-(--btn-primary-padding-x) py-(--btn-primary-padding-y) font-body font-semibold text-(--btn-primary-text) shadow-(--btn-primary-shadow) transition-(--transition-btn) hover:enabled:bg-(--btn-primary-bg-hover) hover:enabled:shadow-(--btn-primary-shadow-hover) active:enabled:scale-(--btn-press-scale-value) disabled:cursor-not-allowed disabled:opacity-70"
          [disabled]="loading()"
        >
          @if (loading()) {
            <span
              class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-current"
            ></span>
          }
          @switch (mode()) {
            @case ('reset') {
              Enviar Enlace
            }
            @default {
              Iniciar Sesión
            }
          }
        </button>
      </form>

      <!-- Footer links -->
      <div class="mt-6 flex items-center justify-center gap-2">
        @switch (mode()) {
          @case ('login') {
            <button
              type="button"
              class="cursor-pointer border-none bg-transparent p-0 font-body text-sm text-brand transition-(--transition-color) hover:text-brand-hover"
              data-llm-action="switch-to-password-reset-mode"
              (click)="modeChange.emit('reset')"
            >
              ¿Olvidaste tu contraseña?
            </button>
          }
          @case ('reset') {
            <button
              type="button"
              class="cursor-pointer border-none bg-transparent p-0 font-body text-sm text-brand transition-(--transition-color) hover:text-brand-hover"
              data-llm-action="switch-to-login-mode"
              (click)="modeChange.emit('login')"
            >
              Volver a iniciar sesión
            </button>
          }
        }
      </div>
    </div>
  `,
  host: { style: 'display: contents;' },
})
export class LoginCardComponent {
  mode = input<'login' | 'reset'>('login');
  loading = input(false);
  errorMsg = input('');
  successMsg = input('');

  modeChange = output<'login' | 'reset'>();
  formSubmit = output<LoginFormData>();

  readonly passwordWrapRef = viewChild<ElementRef<HTMLElement>>('passwordWrapRef');
  readonly errorMsgRef = viewChild<ElementRef<HTMLElement>>('errorMsgRef');
  readonly successMsgRef = viewChild<ElementRef<HTMLElement>>('successMsgRef');

  // Flag no-reactiva — se activa en afterNextRender para evitar que los
  // effects animen elementos antes de que el DOM esté completamente hidratado.
  private ready = false;

  email = '';
  password = '';

  constructor() {
    // Estado inicial sin animación — elementos colapsados antes del primer paint
    afterNextRender(() => {
      const errorEl = this.errorMsgRef()?.nativeElement;
      const successEl = this.successMsgRef()?.nativeElement;
      if (errorEl) gsap.set(errorEl, { height: 0, opacity: 0 });
      if (successEl) gsap.set(successEl, { height: 0, opacity: 0 });

      // Si la página carga directamente en modo reset, colapsar contraseña
      if (this.mode() === 'reset') {
        const passEl = this.passwordWrapRef()?.nativeElement;
        if (passEl) gsap.set(passEl, { height: 0, opacity: 0 });
      }

      this.ready = true;
    });

    // Campo contraseña: aparece en login, se oculta en reset
    effect(() => {
      const isReset = this.mode() === 'reset';
      if (!this.ready) return;
      const el = this.passwordWrapRef()?.nativeElement;
      if (!el) return;

      gsap.to(
        el,
        isReset
          ? { height: 0, opacity: 0, duration: 0.3, ease: 'power2.inOut' }
          : { height: 'auto', opacity: 1, duration: 0.35, ease: 'power2.out', clearProps: 'height' },
      );
    });

    // Mensaje de error: slide-down + fade al aparecer, slide-up + fade al desaparecer
    effect(() => {
      const hasError = !!this.errorMsg();
      if (!this.ready) return;
      const el = this.errorMsgRef()?.nativeElement;
      if (!el) return;

      gsap.to(
        el,
        hasError
          ? { height: 'auto', opacity: 1, marginBottom: 16, duration: 0.3, ease: 'power2.out' }
          : { height: 0, opacity: 0, marginBottom: 0, duration: 0.25, ease: 'power2.in' },
      );
    });

    // Mensaje de éxito: misma lógica que el error
    effect(() => {
      const hasSuccess = !!this.successMsg();
      if (!this.ready) return;
      const el = this.successMsgRef()?.nativeElement;
      if (!el) return;

      gsap.to(
        el,
        hasSuccess
          ? { height: 'auto', opacity: 1, marginBottom: 16, duration: 0.3, ease: 'power2.out' }
          : { height: 0, opacity: 0, marginBottom: 0, duration: 0.25, ease: 'power2.in' },
      );
    });
  }

  handleSubmit(): void {
    this.formSubmit.emit({ email: this.email, password: this.password });
  }
}
