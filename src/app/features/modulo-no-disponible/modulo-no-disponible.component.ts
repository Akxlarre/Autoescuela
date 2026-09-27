import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthFacade } from '@core/facades/auth.facade';
import type { UserRole } from '@core/models/ui/user.model';
import { IconComponent } from '@shared/components/icon/icon.component';

export type ModuloNoDisponibleAction = 'dashboard' | 'logout' | 'login';

/**
 * Qué hace el botón de la pantalla según quién llegó (fix-261-m). Admin/secretaria
 * caen acá por una ruta puntual bloqueada (recorte de Clase Profesional) — su portal
 * sigue habilitado, así que vuelven a su dashboard SIN perder la sesión. Instructor/
 * alumno tienen el portal entero bloqueado: cerrar sesión es la única salida
 * (hotfix-107-m). Sin sesión (matrícula pública) solo se navega al login.
 */
export function resolveModuloNoDisponibleAction(
  role: UserRole | undefined,
): ModuloNoDisponibleAction {
  if (!role) return 'login';
  return role === 'admin' || role === 'secretaria' ? 'dashboard' : 'logout';
}

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
          [attr.data-llm-action]="
            action() === 'dashboard' ? 'volver-al-dashboard' : 'volver-a-login'
          "
          class="btn-primary mt-2"
          (click)="volver()"
        >
          {{ action() === 'dashboard' ? 'Volver al inicio' : 'Volver al inicio de sesión' }}
        </button>
      </div>
    </div>
  `,
})
export class ModuloNoDisponibleComponent {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);

  protected readonly action = computed(() =>
    resolveModuloNoDisponibleAction(this.auth.currentUser()?.role),
  );

  /**
   * Para instructor/alumno, navegar a `/login` con `routerLink` chocaba con
   * `guestGuard` y volvía a esta misma pantalla (hotfix-107-m): `logout()` cierra
   * la sesión de verdad antes de navegar. Se espera `whenReady` porque en una
   * recarga directa de esta URL la sesión todavía puede estar restaurándose.
   */
  async volver(): Promise<void> {
    await this.auth.whenReady;
    switch (resolveModuloNoDisponibleAction(this.auth.currentUser()?.role)) {
      case 'dashboard':
        // `/app` resuelve el dashboard del rol vía `roleRedirectGuard`.
        this.router.navigate(['/app']);
        return;
      case 'logout':
        this.auth.logout();
        return;
      case 'login':
        this.router.navigate(['/login']);
    }
  }
}
