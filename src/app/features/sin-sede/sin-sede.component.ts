import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import { isMissingBranch } from '@core/utils/missing-branch.utils';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Pantalla de una secretaria sin sede asignada (hotfix-099-b). Fuera del shell, como
 * `/modulo-no-disponible`: no hay nada que pueda apretar y que falle o guarde datos sin sede.
 *
 * Escucha su propia fila de `users` en tiempo real: cuando el admin le asigna una sede entra sola
 * al portal. Si llega alguien que sí tiene sede (o sin sesión), se la manda a `/app`.
 */
@Component({
  selector: 'app-sin-sede',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-base p-6">
      <div class="card p-8 flex flex-col items-center gap-4 text-center max-w-md">
        <app-icon name="alert-triangle" [size]="40" color="var(--state-warning)" />
        <div>
          <h1 class="text-xl font-semibold text-text-primary">
            Tu cuenta no tiene una sede asignada
          </h1>
          <p class="text-sm text-text-muted mt-2">
            Pídele al administrador que te asigne una sede para empezar a trabajar. Cuando lo haga,
            esta pantalla se actualiza sola.
          </p>
        </div>
        <button
          type="button"
          data-llm-action="cerrar-sesion-sin-sede"
          class="btn-primary mt-2"
          (click)="cerrarSesion()"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  `,
})
export class SinSedeComponent {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  /** La sesión terminó de restaurarse: antes no se sabe si tiene sede. */
  private readonly ready = signal(false);

  constructor() {
    void this.auth.whenReady.then(() => {
      this.ready.set(true);
      this.auth.initializeRealtime();
    });

    effect(() => {
      const user = this.auth.currentUser();
      if (!this.ready()) return;
      if (!user || !isMissingBranch(user.role, user.branchId, user.canAccessBothBranches)) {
        void this.router.navigate(['/app']);
      }
    });
  }

  cerrarSesion(): void {
    this.auth.logout();
  }
}
