import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';
import { IconComponent } from '@shared/components/icon/icon.component';

/**
 * Pantalla de aviso para módulos bloqueados durante la fase piloto (fix-255-m).
 * Distinta de `acceso-denegado`: no es un error de permisos, es una fase del
 * lanzamiento — el módulo existe, todavía no está habilitado.
 */
@Component({
  selector: 'app-modulo-no-disponible',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-base p-6">
      <div class="card p-8 flex flex-col items-center gap-4 text-center max-w-md">
        <app-icon name="clock" [size]="40" color="var(--ds-brand)" />
        <div>
          <h1 class="text-xl font-semibold text-text-primary">Módulo no habilitado todavía</h1>
          <p class="text-sm text-text-muted mt-2">
            Esta sección está disponible en el sistema, pero no forma parte de esta fase del
            lanzamiento. Vuelve más adelante o contacta al administrador si crees que esto es un
            error.
          </p>
        </div>
        <button
          type="button"
          data-llm-action="volver-a-login"
          class="btn-primary mt-2"
          (click)="volverAlLogin()"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  `,
})
export class ModuloNoDisponibleComponent {
  private readonly auth = inject(AuthFacade);

  /**
   * Botón "Volver al inicio de sesión" (hotfix-107-m): un usuario que llega acá
   * ya está autenticado (instructor/alumno bloqueado por la fase piloto), así
   * que navegar a `/login` con `routerLink` chocaba con `guestGuard` y volvía a
   * esta misma pantalla. `logout()` cierra la sesión de verdad antes de navegar.
   */
  volverAlLogin(): void {
    this.auth.logout();
  }
}
