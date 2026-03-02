import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  inject,
  input,
  effect,
} from "@angular/core";
import { AuthFacade } from "@core/services/auth.facade";
import type { UserRole } from "@core/models/user.model";

/**
 * Directiva estructural para renderizar contenido según el rol del usuario.
 * Reactiva a cambios de sesión vía signal effect.
 *
 * @example
 * <button *appHasRole="'admin'">Solo administradores</button>
 * <div *appHasRole="['admin', 'member']">Admin o member</div>
 */
@Directive({
  selector: "[appHasRole]",
  standalone: true,
})
export class HasRoleDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthFacade);

  readonly appHasRole = input<UserRole | UserRole[]>([]);

  constructor() {
    effect(() => {
      const value = this.appHasRole();
      const roles = Array.isArray(value) ? value : [value];
      const user = this.auth.currentUser();
      const hasRole =
        user !== null && roles.length > 0 && roles.includes(user.role);

      this.viewContainer.clear();
      if (hasRole) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      }
    });
  }
}
