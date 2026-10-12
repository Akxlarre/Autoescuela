/**
 * La regla de contraseñas también la exige el servidor (spec 0050-b, AC5 y AC8).
 *
 * Habla directo con Supabase Auth, sin pasar por la pantalla, con la cuenta de prueba de la sede 2:
 * intenta fijar claves que no cumplen y espera el rechazo. No debería cambiar ninguna clave; si Auth
 * aceptara alguna (configuración perdida), el test la repone y falla. Por tocar una cuenta real no
 * corre con la suite: E2E_CLAVE_REAL=1.
 */
import { ACCOUNTS } from './support/accounts';
import { getClientFor } from './support/supabase-admin';
import { expect, test } from './support/fixtures';
import { mapAuthError } from '../src/app/core/utils/auth-errors.utils';

const CUENTA = ACCOUNTS.secretariaB;

test.describe.configure({ timeout: 120_000 });
test.skip(!process.env['E2E_CLAVE_REAL'], 'Toca una cuenta real: correr con E2E_CLAVE_REAL=1');

const DEBILES: { clave: string; motivo: string; mensaje: RegExp }[] = [
  { clave: 'camino202', motivo: '9 caracteres', mensaje: /al menos 10 caracteres/ },
  { clave: 'caminolargo', motivo: 'sin números', mensaje: /letras y números/ },
  { clave: '12345678901', motivo: 'sin letras', mensaje: /letras y números/ },
];

test('AC8: una cuenta existente sigue entrando con su clave de siempre', async () => {
  await expect(getClientFor(CUENTA.email, CUENTA.password)).resolves.toBeTruthy();
});

for (const { clave, motivo, mensaje } of DEBILES) {
  test(`AC5: Auth rechaza una clave ${motivo}`, async () => {
    const sb = await getClientFor(CUENTA.email, CUENTA.password);
    const { error } = await sb.auth.updateUser({ password: clave });

    if (!error) {
      // Auth la aceptó: se repone antes de fallar.
      const repuesto = await sb.auth.updateUser({ password: CUENTA.password });
      throw new Error(
        `Auth aceptó "${clave}" (${motivo}). Clave repuesta: ${repuesto.error ? 'NO — ' + repuesto.error.message : 'sí'}`,
      );
    }
    console.log(`[AC5] ${motivo}:`, JSON.stringify({ code: error.code, message: error.message }));
    expect(error.code).toBe('weak_password');
    // AC7: el mensaje que vería la persona dice qué falta.
    expect(mapAuthError(error)).toMatch(mensaje);
    // Y la clave de siempre sigue sirviendo.
    await expect(getClientFor(CUENTA.email, CUENTA.password)).resolves.toBeTruthy();
  });
}
