import { Injectable, signal } from '@angular/core';

export type UserRole = 'admin' | 'secretaria' | 'instructor' | 'alumno' | 'relator';

const SESSION_KEY = 'devRole';

/**
 * RoleService — Dev utility for switching roles without re-logging in.
 * Persists the active role to sessionStorage.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly _currentRole = signal<UserRole>(this.readFromStorage());

  readonly currentRole = this._currentRole.asReadonly();

  setRole(role: UserRole): void {
    sessionStorage.setItem(SESSION_KEY, role);
    this._currentRole.set(role);
  }

  private readFromStorage(): UserRole {
    const stored = sessionStorage.getItem(SESSION_KEY) as UserRole | null;
    return stored ?? 'admin';
  }
}
