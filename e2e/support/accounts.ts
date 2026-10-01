/**
 * Cuentas de prueba de la suite E2E (spec 0019-m, AC11) — fuente ÚNICA.
 *
 * Ningún test escribe correos o contraseñas por su cuenta: todo sale de aquí.
 * No se esconden en variables de entorno a propósito: son las mismas credenciales que ya
 * muestra la pantalla de login (login.component.ts) y la BD es solo de desarrollo.
 *
 * Las 3 primeras vienen del seed de la spec 0008-i. La secretaria multi-sede se creó a mano
 * desde Admin → Secretarias (pasos en docs/E2E-PLAYWRIGHT.md).
 */

export type E2eRole = 'admin' | 'secretariaA' | 'secretariaB' | 'secretariaMultisede';

export interface E2eAccount {
  email: string;
  password: string;
  /** Ruta a la que redirige la app después del login. */
  home: string;
}

const PASSWORD = 'Test123456';

export const ACCOUNTS: Record<E2eRole, E2eAccount> = {
  admin: { email: 'admin@test.com', password: PASSWORD, home: '/app/admin/dashboard' },
  /** Sede 1 — Autoescuela Chillán. */
  secretariaA: {
    email: 'secretaria@test.com',
    password: PASSWORD,
    home: '/app/secretaria/dashboard',
  },
  /** Sede 2 — Conductores Chillán. */
  secretariaB: {
    email: 'secretaria2@test.com',
    password: PASSWORD,
    home: '/app/secretaria/dashboard',
  },
  /** Sede 1 + grant `can_access_both_branches`. */
  secretariaMultisede: {
    email: 'secretaria.multisede@test.com',
    password: PASSWORD,
    home: '/app/secretaria/dashboard',
  },
};

export const ROLES = Object.keys(ACCOUNTS) as E2eRole[];

/** Archivo donde el proyecto `setup` guarda la sesión de cada rol (gitignored). */
export function storageStatePath(role: E2eRole): string {
  return `e2e/.auth/${role}.json`;
}
