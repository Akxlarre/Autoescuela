import { Injectable, signal } from '@angular/core';

export type UserRole = 'admin' | 'secretaria' | 'instructor' | 'alumno' | 'relator';

/**
 * RoleService — rol activo del usuario en modo desarrollo.
 *
 * Persiste el rol seleccionado en sessionStorage para que sobreviva
 * a los hot-reloads durante el desarrollo. Se reemplazará por el
 * rol real que provea AuthFacade cuando el login esté completo.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly _role = signal<UserRole>(
    (sessionStorage.getItem('devRole') as UserRole) ?? 'admin',
  );

  readonly currentRole = this._role.asReadonly();

  setRole(role: UserRole): void {
    this._role.set(role);
    sessionStorage.setItem('devRole', role);
  }
}
