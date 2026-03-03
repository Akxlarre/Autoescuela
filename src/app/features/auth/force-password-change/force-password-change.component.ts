import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AuthFacade } from '@core/facades/auth.facade';
import gsap from 'gsap';

@Component({
  selector: 'app-force-password-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div
      class="relative flex min-h-[100dvh] flex-col items-center justify-center gap-8 overflow-hidden bg-base p-4"
    >
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute -left-40 -top-40 h-96 w-96 rounded-full blur-3xl" style="background: color-mix(in srgb, var(--ds-brand) 18%, transparent)"></div>
        <div class="absolute -bottom-40 -right-20 h-80 w-80 rounded-full blur-3xl" style="background: color-mix(in srgb, var(--color-primary-dark) 14%, transparent)"></div>
        <div class="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent)"></div>
      </div>

      <div #cardRef class="w-full max-w-[440px]">
        <div class="surface-glass w-full rounded-2xl p-10">
          <div class="mb-8 text-center">
            <div class="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-xl" style="background: var(--gradient-primary); box-shadow: 0 8px 40px color-mix(in srgb, var(--ds-brand) 35%, transparent)">
              <app-icon name="shield-alert" [size]="32" color="white" />
            </div>
            <p class="m-0 mb-2 font-display text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
              Autoescuela
            </p>
            <h1 class="m-0 mb-1 font-display text-2xl font-bold text-text-primary">
              Actualiza tu contraseña
            </h1>
            <p class="m-0 text-sm text-text-muted">
              Por motivos de seguridad, debes actualizar tu contraseña temporal en tu primer inicio de sesión.
            </p>
          </div>

          <div #errorMsgRef style="overflow: hidden">
            @if (errorMsg()) {
              <div class="flex items-center gap-2 rounded-md border border-[var(--state-error-border)] bg-[var(--state-error-bg)] px-4 py-3 text-sm text-error mb-4" role="alert">
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
              <input
                id="new-password"
                type="password"
                formControlName="password"
                class="w-full box-border rounded-[var(--input-radius)] border border-[var(--input-border-default)] bg-[var(--input-bg)] px-[var(--input-padding-x)] py-[var(--input-padding-y)] font-body text-base text-[var(--input-text)] outline-none transition-[var(--transition-input)] placeholder:text-[var(--input-placeholder)] focus:border-[var(--input-border-focus)] focus:shadow-[var(--input-shadow-focus-neutral)]"
                placeholder="Mínimo 6 caracteres"
                required
              />
            </div>

            <button
              type="submit"
              class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--btn-primary-radius)] border-none bg-[var(--btn-primary-bg)] px-[var(--btn-primary-padding-x)] py-[var(--btn-primary-padding-y)] font-body text-base font-semibold text-[var(--btn-primary-text)] shadow-[var(--btn-primary-shadow)] transition-[var(--transition-btn)] hover:enabled:bg-[var(--btn-primary-bg-hover)] hover:enabled:shadow-[var(--btn-primary-shadow-hover)] active:enabled:scale-[var(--btn-press-scale-value)] disabled:cursor-not-allowed disabled:opacity-70"
              [disabled]="form.invalid || loading()"
            >
              @if (loading()) {
                <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-current"></span>
              }
              Actualizar y Continuar
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  host: { style: 'display: contents;' },
})
export class ForcePasswordChangeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly gsap = inject(GsapAnimationsService);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly loading = signal(false);
  readonly errorMsg = signal('');

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
      gsap.to(el, { height: 'auto', opacity: 1, marginBottom: 16, duration: 0.3, ease: 'power2.out' });
    }
  }

  hideError() {
    this.errorMsg.set('');
    const el = this.errorMsgRef()?.nativeElement;
    if (el) {
      gsap.to(el, { height: '0', opacity: 0, marginBottom: 0, duration: 0.25, ease: 'power2.in' });
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;

    this.hideError();
    this.loading.set(true);

    try {
      const newPassword = this.form.getRawValue().password;

      // Actualizar la contraseña a través de AuthFacade
      const { error } = await this.auth.updatePassword(newPassword);

      if (error) {
        this.showError(error.message);
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
