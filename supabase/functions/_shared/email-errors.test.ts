// supabase/functions/_shared/email-errors.test.ts
//
// fix-199-b — detección de correo duplicado (Auth y Postgres). Funciones puras.
//   deno test supabase/functions/_shared/email-errors.test.ts

import { assertEquals } from 'jsr:@std/assert';
import { duplicateUserMessage, isEmailTakenError, isUniqueViolation } from './email-errors.ts';

Deno.test('isEmailTakenError: texto actual de Supabase ("has already been registered")', () => {
  assertEquals(
    isEmailTakenError({ message: 'A user with this email address has already been registered' }),
    true,
  );
});

Deno.test('isEmailTakenError: texto antiguo ("already registered")', () => {
  assertEquals(isEmailTakenError({ message: 'User already registered' }), true);
});

Deno.test('isEmailTakenError: por código email_exists aunque cambie el texto', () => {
  assertEquals(isEmailTakenError({ code: 'email_exists', message: 'otro texto' }), true);
});

Deno.test('isEmailTakenError: otros errores → false', () => {
  assertEquals(
    isEmailTakenError({ message: 'Unable to validate email address: invalid format' }),
    false,
  );
  assertEquals(
    isEmailTakenError({ code: 'over_email_send_rate_limit', message: 'rate limit' }),
    false,
  );
  assertEquals(isEmailTakenError(null), false);
  assertEquals(isEmailTakenError(undefined), false);
});

Deno.test('isUniqueViolation: 23505 → true; otros → false', () => {
  assertEquals(
    isUniqueViolation({
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_email_key"',
    }),
    true,
  );
  assertEquals(isUniqueViolation({ code: '23503', message: 'fk' }), false);
  assertEquals(isUniqueViolation(null), false);
});

Deno.test('duplicateUserMessage: distingue RUT de correo por la restricción', () => {
  assertEquals(
    duplicateUserMessage({ code: '23505', message: 'duplicate key value violates unique constraint "users_rut_key"' }),
    'Ya existe un usuario con ese RUT',
  );
  assertEquals(
    duplicateUserMessage({ code: '23505', message: 'duplicate key value violates unique constraint "users_email_key"' }),
    'Ya existe un usuario con ese correo electrónico',
  );
});
