// supabase/functions/_shared/email-errors.ts
//
// fix-199-b — Detección de correo duplicado, compartida por las Edge Functions de alta y edición
// de personas (create-instructor, create-secretary, update-instructor, update-secretary,
// update-student-profile). Funciones puras (sin I/O).
//
// Antes cada función hacía `message.includes('already registered')`, pero Supabase hoy responde
// "A user with this email address has already been registered" (code 'email_exists'): el 409 se
// volvía 500 con el texto crudo en inglés.

interface ErrorLike {
  code?: string | null;
  message?: string | null;
}

/** Error de Supabase Auth por correo ya registrado. */
export function isEmailTakenError(err: ErrorLike | null | undefined): boolean {
  if (!err) return false;
  if (err.code === 'email_exists') return true;
  return /already (been )?registered/i.test(err.message ?? '');
}

/** Error de Postgres por restricción UNIQUE (p. ej. `users_email_key`). */
export function isUniqueViolation(err: ErrorLike | null | undefined): boolean {
  return err?.code === '23505';
}

export const EMAIL_TAKEN_MESSAGE = 'Ya existe un usuario con ese correo electrónico';

/**
 * Mensaje para un 23505 al insertar/actualizar `users`: distingue RUT de correo según la
 * restricción que saltó (`users_rut_key` / `users_email_key`).
 */
export function duplicateUserMessage(err: ErrorLike | null | undefined): string {
  return /rut/i.test(err?.message ?? '') ? 'Ya existe un usuario con ese RUT' : EMAIL_TAKEN_MESSAGE;
}
