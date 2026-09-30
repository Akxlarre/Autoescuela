/**
 * Tests de la infraestructura de la suite (spec 0019-m). Demuestran que las fixtures
 * funcionan; no prueban reglas de negocio.
 */
import { ACCOUNTS, ROLES } from './support/accounts';
import { e2eName, expect, test } from './support/fixtures';
import { getAdminClient, getUserDbId } from './support/supabase-admin';

const BRANCH_SELECTOR = '[data-llm-description^="Branch filter"]';

test.describe('sesiones por rol', () => {
  for (const role of ROLES) {
    test(`AC4: ${role} entra con la sesión iniciada, sin pasar por /login`, async ({ pageAs }) => {
      const page = await pageAs(role);
      await page.goto('/app');
      await expect(page).toHaveURL(new RegExp(`${ACCOUNTS[role].home}$`));
    });
  }

  test('AC5: admin y secretaria A en paralelo no se pisan la sesión', async ({ pageAs }) => {
    const [admin, secretaria] = await Promise.all([pageAs('admin'), pageAs('secretariaA')]);
    await Promise.all([admin.goto('/app'), secretaria.goto('/app')]);

    await expect(admin).toHaveURL(/\/app\/admin\/dashboard$/);
    await expect(secretaria).toHaveURL(/\/app\/secretaria\/dashboard$/);

    // Cada una sigue en su rol después de que la otra navegó.
    await Promise.all([admin.reload(), secretaria.reload()]);
    await expect(admin).toHaveURL(/\/app\/admin\/dashboard$/);
    await expect(secretaria).toHaveURL(/\/app\/secretaria\/dashboard$/);
  });

  test('AC6: el selector de sede aparece para la secretaria multi-sede y no para la de sede A', async ({
    pageAs,
  }) => {
    const [multisede, sedeA] = await Promise.all([
      pageAs('secretariaMultisede'),
      pageAs('secretariaA'),
    ]);
    await Promise.all([multisede.goto('/app'), sedeA.goto('/app')]);

    await expect(multisede.locator(BRANCH_SELECTOR)).toBeVisible();
    await expect(sedeA.getByRole('main')).toBeVisible();
    await expect(sedeA.locator(BRANCH_SELECTOR)).toHaveCount(0);
  });
});

test.describe('limpieza de datos E2E-', () => {
  // En orden y en un mismo worker: el afterAll verifica las tareas de ambos tests.
  test.describe.configure({ mode: 'default' });

  /** Crea por API una tarea admin → secretaria A (sin notificación, ver plan §3). */
  async function createE2eTask(subject: string): Promise<string> {
    const sb = await getAdminClient();
    const admin = await getUserDbId(ACCOUNTS.admin.email);
    const secretaria = await getUserDbId(ACCOUNTS.secretariaA.email);
    const { data, error } = await sb
      .from('tasks')
      .insert({
        branch_id: secretaria.branchId,
        from_user_id: admin.id,
        from_role: 'admin',
        to_user_id: secretaria.id,
        to_role: 'secretary',
        type: 'task',
        subject,
        status: 'pending',
      })
      .select('id')
      .single();
    if (error) throw new Error(`[e2e] No se pudo crear la tarea de prueba: ${error.message}`);
    return data.id;
  }

  async function taskExists(id: string): Promise<boolean> {
    const sb = await getAdminClient();
    const { data } = await sb.from('tasks').select('id').eq('id', id);
    return !!data?.length;
  }

  let createdIds: string[] = [];

  test('AC9: una tarea E2E- creada por el test se borra al terminar', async ({ cleanup }) => {
    const id = await createE2eTask(e2eName('tarea-limpieza'));
    cleanup.track('tasks', id);
    createdIds.push(id);
    expect(await taskExists(id)).toBe(true);
  });

  test('AC-E3: la tarea se borra aunque el test falle', async ({ cleanup }) => {
    test.fail(); // este test DEBE fallar: demuestra que la limpieza corre igual
    const id = await createE2eTask(e2eName('tarea-test-fallido'));
    cleanup.track('tasks', id);
    createdIds.push(id);
    expect(id, 'falla a propósito después de crear el dato').toBe('esto-no-coincide');
  });

  test.afterAll(async () => {
    for (const id of createdIds) {
      expect(await taskExists(id), `la tarea ${id} debió borrarse`).toBe(false);
    }
    createdIds = [];
  });
});
