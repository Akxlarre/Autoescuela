/**
 * PLANTILLA de la tanda de testing (ASG-i-022…037): copia este archivo para un test nuevo.
 *
 * Patrón:
 *   1. `pageAs(rol)` para entrar con la sesión ya iniciada (nunca pasar por /login).
 *   2. `watchErrors(page)` antes de navegar.
 *   3. Selectores data-llm-* o roles ARIA, nunca clases CSS.
 *   4. Sin conteos absolutos; si el test crea datos: `e2eName()` + `cleanup.track()`.
 *
 * Spec 0019-m, AC7.
 */
import { expect, test, watchErrors } from './support/fixtures';

test('humo: el dashboard de admin carga sin errores de consola ni de red', async ({ pageAs }) => {
  const page = await pageAs('admin');
  const errors = watchErrors(page);

  await page.goto('/app/admin/dashboard');
  await expect(page.getByRole('main')).toBeVisible();
  await page.waitForLoadState('networkidle');

  errors.expectClean();
});
