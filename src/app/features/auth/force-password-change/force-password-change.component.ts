import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AuthFacade } from '@core/facades/auth.facade';
import gsap from 'gsap';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { evaluatePassword, PASSWORD_MIN_LENGTH } from '@core/utils/password-policy.utils';
import { PasswordRequirementsComponent } from '@shared/components/password-requirements/password-requirements.component';

@Component({
  selector: 'app-force-password-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, PasswordRequirementsComponent],
  template: `
    <div
      class="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden bg-base p-4"
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute -left-40 -top-40 h-96 w-96 rounded-full blur-3xl bg-brand/18"></div>
        <div
          class="absolute -bottom-40 -right-20 h-80 w-80 rounded-full blur-3xl bg-brand-dark/14"
        ></div>
        <div
          class="absolute left-1/2 top-1/2 h-140 w-140 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl bg-brand/6"
        ></div>
      </div>

      <div #cardRef class="w-full max-w-110">
        <div class="surface-glass w-full rounded-2xl p-10">
          <div class="mb-8 text-center">
            <div
              class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-primary"
              style="box-shadow:  0 8px 40px color-mix(in srgb, var(--ds-brand) 35%, transparent)"
            >
              <app-icon [name]="copy.icon" [size]="32" color="white" />
            </div>
            <p class="micro-label m-0 mb-2 font-display tracking-[0.18em]">Autoescuela</p>
            <h1 class="m-0 mb-1 font-display text-2xl font-bold text-text-primary">
              {{ copy.title }}
            </h1>
            <p class="m-0 text-sm text-text-muted">{{ copy.subtitle }}</p>
          </div>

          <div #errorMsgRef class="overflow-hidden">
            @if (errorMsg()) {
              <div
                class="flex items-center gap-2 rounded-md border border-(--state-error-border) bg-(--state-error-bg) px-4 py-3 text-sm text-error mb-4"
                role="alert"
              >
                <app-icon name="alert-triangle" [size]="14" />
                {{ errorMsg() }}
              </div>
            }
          </div>

          <form class="flex flex-col" [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="flex flex-col gap-2 pb-4">
              <label for="new-password" class="text-sm font-medium text-text-secondary">
                Nueva Contraseña
              </label>
              <div class="relative">
                <input
                  id="new-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  class="w-full box-border rounded-(--input-radius) border border-(--input-border-default) bg-(--input-bg) py-(--input-padding-y) pl-(--input-padding-x) pr-10 font-body text-(--input-text) outline-none transition-(--transition-input) placeholder:text-(--input-placeholder) focus:border-(--input-border-focus) focus:shadow-(--input-shadow-focus-neutral)"
                  [placeholder]="'Mínimo ' + minLength + ' caracteres'"
                  required
                  autocomplete="new-password"
                  aria-describedby="new-password-requirements"
                  data-llm-description="input for the new account password"
                />
                <button
                  type="button"
                  class="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent p-0 text-text-muted transition-(--transition-color) hover:text-text-primary"
                  (click)="togglePasswordVisibility()"
                  [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                >
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="18" />
                </button>
              </div>
              <!-- spec 0050-b: los requisitos se ven mientras se escribe -->
              <app-password-requirements
                id="new-password-requirements"
                [requirements]="evaluation().requirements"
                [strength]="evaluation().strength"
              />
            </div>

            <!-- spec 0050-b (AC6): antes era un solo campo; un error de tipeo dejaba a la persona fuera -->
            <div class="flex flex-col gap-2 pb-4">
              <label for="confirm-password" class="text-sm font-medium text-text-secondary">
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                [type]="showPassword() ? 'text' : 'password'"
                formControlName="confirm"
                class="w-full box-border rounded-(--input-radius) border border-(--input-border-default) bg-(--input-bg) py-(--input-padding-y) px-(--input-padding-x) font-body text-(--input-text) outline-none transition-(--transition-input) placeholder:text-(--input-placeholder) focus:border-(--input-border-focus) focus:shadow-(--input-shadow-focus-neutral)"
                placeholder="Repite tu contraseña"
                required
                autocomplete="new-password"
                data-llm-description="input to confirm the new account password"
              />
              @if (mismatch()) {
                <span class="text-xs text-error" role="alert">Las contraseñas no coinciden.</span>
              }
            </div>

            <button
              type="submit"
              class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-(--btn-primary-radius) border-none bg-(--btn-primary-bg) px-(--btn-primary-padding-x) py-(--btn-primary-padding-y) font-body font-semibold text-(--btn-primary-text) shadow-(--btn-primary-shadow) transition-(--transition-btn) hover:enabled:bg-(--btn-primary-bg-hover) hover:enabled:shadow-(--btn-primary-shadow-hover) active:enabled:scale-(--btn-press-scale-value) disabled:cursor-not-allowed disabled:opacity-70"
              [disabled]="!canSubmit() || loading()"
              [attr.data-llm-action]="copy.llmAction"
            >
              @if (loading()) {
                <span
                  class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-current"
                ></span>
              }
              {{ copy.submit }}
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  host: { style: 'display: contents;' },
})
export class ForcePasswordChangeComponent {
  private readonly sanitizer = inject(ErrorSanitizerService);
  private readonly fb = inject(FormBuilder);

  /** Igual al mínimo de Supabase Auth (hotfix-059-b). */
  readonly minLength = PASSWORD_MIN_LENGTH;
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /**
   * Misma pantalla para dos flujos: el primer ingreso (activación por enlace) y el link de "recuperar
   * contraseña" (fix-181-b, ruta /recuperar-contrasena con data.mode = 'recovery').
   */
  readonly isRecovery = this.route.snapshot.data['mode'] === 'recovery';
  readonly copy = this.isRecovery
    ? {
        icon: 'shield-check',
        title: 'Crea una contraseña nueva',
        subtitle: 'Escribe la contraseña que usarás de ahora en adelante para entrar.',
        submit: 'Guardar y entrar',
        llmAction: 'guardar-contrasena-recuperada',
      }
    : {
        icon: 'shield-alert',
        // hotfix-072-b: decía "actualizar tu contraseña temporal". Desde fix-182-b las cuentas
        // nacen sin contraseña y se activan por enlace: nadie tiene una temporal.
        title: 'Crea tu contraseña',
        subtitle:
          'Es tu primer ingreso. Crea la contraseña que usarás de ahora en adelante para entrar.',
        submit: 'Guardar y entrar',
        llmAction: 'actualizar-contrasena-forzada',
      };
  private readonly gsap = inject(GsapAnimationsService);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
    confirm: ['', [Validators.required]],
  });

  private readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** La regla única de contraseñas (spec 0050-b), con los datos de la persona como contexto. */
  readonly evaluation = computed(() => {
    const user = this.auth.currentUser();
    return evaluatePassword(this.values().password ?? '', {
      name: user?.name,
      email: user?.email,
      rut: user?.rut,
    });
  });
  readonly mismatch = computed(() => {
    const { password, confirm } = this.values();
    return !!confirm && confirm !== password;
  });
  readonly canSubmit = computed(
    () => this.evaluation().valid && this.values().confirm === this.values().password,
  );

  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly showPassword = signal(false);

  readonly cardRef = viewChild<ElementRef<HTMLElement>>('cardRef');
  readonly errorMsgRef = viewChild<ElementRef<HTMLElement>>('errorMsgRef');

  constructor() {
    afterNextRender(() => {
      const el = this.cardRef()?.nativeElement;
      if (el) this.gsap.animateHero(el);

      const errorEl = this.errorMsgRef()?.nativeElement;
      if (errorEl) gsap.set(errorEl, { height: '0', opacity: 0 });
    });
  }

  showError(msg: string) {
    this.errorMsg.set(msg);
    const el = this.errorMsgRef()?.nativeElement;
    if (el) {
      gsap.to(el, {
        height: 'auto',
        opacity: 1,
        marginBottom: 16,
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((val) => !val);
  }

  hideError() {
    this.errorMsg.set('');
    const el = this.errorMsgRef()?.nativeElement;
    if (el) {
      gsap.to(el, { height: '0', opacity: 0, marginBottom: 0, duration: 0.25, ease: 'power2.in' });
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.hideError();
    this.loading.set(true);

    try {
      const newPassword = this.form.getRawValue().password;

      // Actualizar la contraseña a través de AuthFacade
      const { error } = this.isRecovery
        ? await this.auth.completePasswordRecovery(newPassword)
        : await this.auth.updatePassword(newPassword);

      if (error) {
        this.showError(this.sanitizer.sanitize(error).message);
        return;
      }

      this.router.navigate(['/app']);
    } catch (err) {
      this.showError('Ocurrió un error inesperado al actualizar la contraseña.');
    } finally {
      this.loading.set(false);
    }
  }
}
