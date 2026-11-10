/**
 * Testing de agenda / triple match (fix-186-b), §H del checklist
 * specs/testing-piloto/026-agenda-triple-match.md: el paso 2 de la matrícula presencial
 * (instructor + horarios) en la sede 1, como secretaria.
 *
 * Cada test siembra un alumno E2E- con un borrador de matrícula ya en el paso 2 y lo retoma desde
 * "Matrículas en progreso". Los que pasan al paso 3 reservan clases reales del instructor
 * (class_b_sessions 'reserved'): se borran al terminar, pase o falle el test.
 */
import type { Locator, Page } from '@playwright/test';
import { createE2eAlumno } from './support/alumnos-seed';
import { getAdminClient } from './support/supabase-admin';
import { expect, test, type Cleanup } from './support/fixtures';

test.describe.configure({ timeout: 180_000 });

const SEDE_1 = 1;
const CARGA = { timeout: 30_000 };
const MODAL = '[aria-labelledby="confirm-modal-title"]';
const PASO_2 = 'app-assignment-step';
const SLOT = 'app-schedule-grid button[aria-label]';
/** Horario que se puede elegir y todavía no está elegido (el elegido se pinta con la marca). */
const SLOT_LIBRE =
  'app-schedule-grid button[data-llm-action="toggle-schedule-slot"]:not([disabled]):not([style*="ds-brand"])';
const SLOT_ELEGIDO = 'app-schedule-grid button[style*="ds-brand"]';

/** Instructores de la sede 1 en producción (ver indices/DATABASE.md y el fix.md). */
const CON_DISPONIBILIDAD = 'Andrea Morales';
const OTRO_CON_DISPONIBILIDAD = 'Rodrigo Silva';
const CON_CLASES_AGENDADAS = 'Gabriel Molina';
const AMBAS_SEDES_DE_LA_SEDE_2 = 'Carlos Muñoz';
const SIN_VEHICULO = 'Paulina Silva';
const SOLO_SEDE_2 = 'Roberto Araya';

/** Siembra un alumno con un borrador vigente en el paso 2 y devuelve su apellido e id. */
async function conBorradorEnPaso2(label: string, cleanup: Cleanup, courseName?: string) {
  const alumno = await createE2eAlumno(
    { label, branchId: SEDE_1, enrollments: [{ status: 'draft', courseName }] },
    cleanup,
  );
  const enrollmentId = alumno.enrollmentIds[0];
  const sb = await getAdminClient();
  const { error } = await sb
    .from('enrollments')
    .update({
      current_step: 2,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .eq('id', enrollmentId);
  expect(error, 'dejar el borrador vigente en el paso 2').toBeNull();
  return { apellido: alumno.paternalLastName, enrollmentId };
}

/** La tarjeta del borrador del alumno en "Matrículas en progreso". */
function tarjetaBorrador(page: Page, apellido: string): Locator {
  return page
    .locator('app-draft-list div')
    .filter({ hasText: apellido })
    .filter({ has: page.locator('[data-llm-action="discard-enrollment-draft"]') })
    .last();
}

async function retomarEnPaso2(page: Page, apellido: string): Promise<void> {
  await page.goto('/app/secretaria/matricula');
  const tarjeta = tarjetaBorrador(page, apellido);
  await expect(tarjeta).toBeVisible(CARGA);
  await tarjeta.locator('[data-llm-action="resume-enrollment-draft"]').click();
  await expect(page.locator(PASO_2)).toBeVisible(CARGA);
}

const selectorInstructor = (page: Page) => page.locator(`${PASO_2} .instructor-select`);
const opciones = (page: Page) => page.locator('.instructor-select-panel [role="option"]');

async function abrirInstructores(page: Page): Promise<string[]> {
  await expect(selectorInstructor(page)).toBeVisible(CARGA);
  await selectorInstructor(page).click();
  await expect(opciones(page).first()).toBeVisible(CARGA);
  return opciones(page).allInnerTexts();
}

/** Elige el instructor y, si el paso lo pide, el pago total; espera la grilla. */
async function elegirInstructor(page: Page, nombre: string): Promise<void> {
  if (!(await opciones(page).first().isVisible())) await selectorInstructor(page).click();
  await opciones(page).filter({ hasText: nombre }).first().click();
  const pagoTotal = page.locator('[data-llm-action="select-payment-mode-total"]');
  if (await pagoTotal.isVisible()) await pagoTotal.click();
  await expect(page.locator(SLOT).first()).toBeVisible(CARGA);
}

const contador = (page: Page, total: number) =>
  page.locator('app-schedule-grid').getByText(new RegExp(`^\\s*\\d+ / ${total}\\s*$`));

async function irASemana(page: Page, direccion: 'next' | 'prev'): Promise<boolean> {
  const boton = page.locator(`[data-llm-action="schedule-${direccion}-week"]`);
  if (!(await boton.isVisible()) || (await boton.isDisabled())) return false;
  await boton.click();
  return true;
}

/**
 * Elige horarios libres, semana por semana, hasta completar el total. Parte en la semana 2: un
 * horario de hoy puede empezar mientras corre el test, y entonces la grilla lo saca de la
 * selección (con razón: ya no se puede agendar).
 */
async function elegirHorarios(page: Page, total: number): Promise<void> {
  expect(await irASemana(page, 'next'), 'una semana siguiente con horarios').toBe(true);
  for (let elegidos = 0; elegidos < total; ) {
    const libre = page.locator(SLOT_LIBRE).first();
    if (await libre.isVisible()) {
      await libre.click();
      elegidos += 1;
      await expect(contador(page, total)).toHaveText(new RegExp(`^\\s*${elegidos} / ${total}`));
    } else {
      expect(await irASemana(page, 'next'), `sin horarios para completar ${total}`).toBe(true);
    }
  }
}

/**
 * Marca cada horario con su columna (día) de la semana visible. La grilla es una fila por hora:
 * el primer hijo es la hora y cada uno de los siguientes es un día (botón, o vacío si no hay).
 */
async function marcarColumnas(page: Page): Promise<void> {
  await page.locator('app-schedule-grid').evaluate((grid) => {
    for (const fila of grid.querySelectorAll('div.grid.text-xs')) {
      [...fila.children].forEach((celda, i) => celda.setAttribute('data-e2e-col', String(i)));
    }
  });
}

async function volverAlPaso2(page: Page): Promise<void> {
  await page.locator('app-documents-step').getByRole('button', { name: 'Volver' }).click();
  await expect(page.locator(PASO_2)).toBeVisible(CARGA);
}

/**
 * Las 12 clases que este borrador ya reservó se ven elegidas y siguen siendo suyas: ninguna
 * deshabilitada ni "ocupada", y se puede continuar. Con `expect.soft` para que un fallo acá no
 * impida probar lo que sigue (descartar, que también libera los horarios).
 */
async function revisarHorariosPropios(page: Page, caso: string): Promise<void> {
  await expect(contador(page, 12)).toHaveText(/^\s*12 \/ 12/, CARGA);
  await expect(page.locator(`${SLOT}`).first()).toBeVisible(CARGA);
  while (await irASemana(page, 'prev'));
  let elegidas = 0;
  let noPropias = 0;
  do {
    for (const slot of await page.locator(SLOT_ELEGIDO).all()) {
      elegidas += 1;
      const ocupada = /: occupied$/.test((await slot.getAttribute('aria-label')) ?? '');
      if (ocupada || (await slot.isDisabled())) noPropias += 1;
    }
  } while (await irASemana(page, 'next'));
  expect.soft(elegidas, `${caso}: horarios propios visibles en la grilla`).toBe(12);
  expect.soft(noPropias, `${caso}: horarios propios que aparecen "ocupados"`).toBe(0);
  await expect
    .soft(page.locator('[data-llm-action="submit-assignment"]'), `${caso}: se puede continuar`)
    .toBeEnabled();
}

test('H01 + H02 + H03: la lista trae a los instructores con vehículo de la sede y a los de "ambas sedes"; no a los sin vehículo', async ({
  pageAs,
  cleanup,
}) => {
  const { apellido } = await conBorradorEnPaso2('Paso2Lista', cleanup);
  const page = await pageAs('secretariaA');
  await retomarEnPaso2(page, apellido);
  const lista = await abrirInstructores(page);

  // H01: cada instructor con su vehículo (marca y modelo · patente).
  expect(lista.length).toBeGreaterThan(0);
  for (const item of lista) expect(item, 'vehículo y patente').toMatch(/·\s*\S+/);
  expect(lista.join('\n')).toContain(CON_DISPONIBILIDAD);
  // H02: el instructor de la sede 2 marcado "ambas sedes" también se ofrece en la sede 1 (S7).
  expect(lista.join('\n'), 'instructor "ambas sedes" de la sede 2').toContain(
    AMBAS_SEDES_DE_LA_SEDE_2,
  );
  // H03: sin vehículo asignado no se ofrece; uno solo de la sede 2 tampoco.
  expect(lista.join('\n')).not.toContain(SIN_VEHICULO);
  expect(lista.join('\n')).not.toContain(SOLO_SEDE_2);
});

test('H04 + H07 + H12 + H15: grilla por semanas, máximo 2 por día, ocupados en gris y cambiar de instructor limpia', async ({
  pageAs,
  cleanup,
}) => {
  const { apellido } = await conBorradorEnPaso2('Paso2Grilla', cleanup);
  const page = await pageAs('secretariaA');
  await retomarEnPaso2(page, apellido);
  await abrirInstructores(page);

  // H12: los horarios ya ocupados por otra clase del instructor quedan deshabilitados.
  await elegirInstructor(page, CON_CLASES_AGENDADAS);
  let ocupados = 0;
  do {
    const enSemana = page.locator(`${SLOT}[aria-label$=": occupied"]`);
    ocupados += await enSemana.count();
    for (const slot of await enSemana.all()) await expect(slot).toBeDisabled();
  } while (await irASemana(page, 'next'));
  expect(ocupados, 'horarios ocupados en la grilla de un instructor con clases').toBeGreaterThan(0);

  // H04: otra grilla, con "Semana 1 de N" y horarios libres.
  await abrirInstructores(page);
  await elegirInstructor(page, CON_DISPONIBILIDAD);
  await expect(page.locator('app-schedule-grid').getByText(/Semana 1 de \d+/)).toBeVisible();
  await expect(page.getByText('Puedes seleccionar hasta 2 clases por día.')).toBeVisible();
  await expect(contador(page, 12)).toHaveText(/^\s*0 \/ 12/);

  // H07: con 2 horarios elegidos en un día, el resto de ese día queda deshabilitado. En la
  // semana 2, para no depender de horarios de hoy que empiezan durante el test.
  expect(await irASemana(page, 'next'), 'una semana siguiente con horarios').toBe(true);
  await marcarColumnas(page);
  const columna = await page.locator(SLOT_LIBRE).evaluateAll((botones) => {
    const porColumna = new Map<string, number>();
    for (const b of botones) {
      const col = b.getAttribute('data-e2e-col')!;
      porColumna.set(col, (porColumna.get(col) ?? 0) + 1);
    }
    return [...porColumna].find(([, n]) => n >= 3)?.[0] ?? null;
  });
  expect(columna, 'un día con al menos 3 horarios libres').not.toBeNull();
  const delDia = page.locator(`app-schedule-grid button[data-e2e-col="${columna}"]`);
  const libresDelDia = page.locator(`${SLOT_LIBRE}[data-e2e-col="${columna}"]`);
  await libresDelDia.first().click();
  await libresDelDia.first().click();
  await expect(contador(page, 12)).toHaveText(/^\s*2 \/ 12/);
  await expect(page.locator(`${SLOT_ELEGIDO}[data-e2e-col="${columna}"]`)).toHaveCount(2);
  for (const slot of await delDia.all()) {
    const elegido = ((await slot.getAttribute('style')) ?? '').includes('ds-brand');
    if (!elegido) await expect(slot, 'tercer horario del mismo día').toBeDisabled();
  }

  // H15: cambiar de instructor descarta lo elegido; la grilla nueva parte de cero.
  await abrirInstructores(page);
  await elegirInstructor(page, OTRO_CON_DISPONIBILIDAD);
  await expect(contador(page, 12)).toHaveText(/^\s*0 \/ 12/, CARGA);
  await expect(page.locator(SLOT_ELEGIDO)).toHaveCount(0);
  await expect(page.locator(`${PASO_2} .instructor-select`)).toContainText(OTRO_CON_DISPONIBILIDAD);
});

test('H17 + H18 + H20: al volver del paso 3 o retomar el borrador los horarios reservados siguen siendo propios; descartar los libera', async ({
  pageAs,
}) => {
  // Descartar el borrador borra la matrícula, el alumno y su usuario: la limpieza tolera que ya
  // no existan y borra antes las clases que haya dejado reservadas.
  const sembrados: { table: string; id: string | number }[] = [];
  const limpiezaTolerante: Cleanup = { track: (table, id) => sembrados.push({ table, id }) };
  const sb = await getAdminClient();
  const { apellido, enrollmentId } = await conBorradorEnPaso2('Paso2Volver', limpiezaTolerante);
  const reservadas = async () => {
    const { count, error } = await sb
      .from('class_b_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId);
    expect(error).toBeNull();
    return count ?? 0;
  };

  try {
    const page = await pageAs('secretariaA');
    await retomarEnPaso2(page, apellido);
    await abrirInstructores(page);
    await elegirInstructor(page, CON_DISPONIBILIDAD);
    await elegirHorarios(page, 12);

    await page.locator('[data-llm-action="submit-assignment"]').click();
    await expect(page.locator('app-documents-step')).toBeVisible(CARGA);
    expect(await reservadas(), 'clases reservadas al pasar al paso 3').toBe(12);

    // H17: de vuelta en el paso 2, las 12 siguen elegidas y ninguna aparece "ocupada".
    await volverAlPaso2(page);
    await revisarHorariosPropios(page, 'H17');

    // H18: retomar el borrador con sus clases ya reservadas. Volver al paso 2 dejó guardado ese
    // paso, así que "Retomar" abre directo en él.
    await page.goto('/app/secretaria/matricula');
    const paraRetomar = tarjetaBorrador(page, apellido);
    await expect(paraRetomar).toBeVisible(CARGA);
    await paraRetomar.locator('[data-llm-action="resume-enrollment-draft"]').click();
    await expect(page.locator(PASO_2)).toBeVisible(CARGA);
    await revisarHorariosPropios(page, 'H18');

    // H20: descartar el borrador deja libres los horarios reservados.
    await page.goto('/app/secretaria/matricula');
    const tarjeta = tarjetaBorrador(page, apellido);
    await expect(tarjeta).toBeVisible(CARGA);
    await tarjeta.locator('[data-llm-action="discard-enrollment-draft"]').click();
    await page.locator(MODAL).getByRole('button', { name: 'Sí, descartar' }).click();
    // La tarjeta se va apenas empieza el descarte: lo que cuenta es lo que quedó en la base.
    await expect
      .poll(async () => {
        const { count } = await sb
          .from('enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('id', enrollmentId);
        return count;
      }, CARGA)
      .toBe(0);
    expect(await reservadas(), 'clases reservadas tras descartar').toBe(0);
    await expect(tarjetaBorrador(page, apellido)).toHaveCount(0);
  } finally {
    await sb.from('class_b_sessions').delete().eq('enrollment_id', enrollmentId);
    for (const { table, id } of sembrados.reverse()) {
      await sb.from(table).delete().eq('id', id);
    }
  }
});

test('H22: el Refuerzo Clase B pide 6 clases, no 12', async ({ pageAs, cleanup }) => {
  const { apellido } = await conBorradorEnPaso2('Paso2Refuerzo', cleanup, 'Refuerzo Clase B');
  const page = await pageAs('secretariaA');
  await retomarEnPaso2(page, apellido);
  await abrirInstructores(page);
  await elegirInstructor(page, CON_DISPONIBILIDAD);

  await expect(page.locator(PASO_2).getByText(/Elige las\s+6\s+clases prácticas/)).toBeVisible();
  await expect(contador(page, 6)).toHaveText(/^\s*0 \/ 6/);
  await expect(page.locator('[data-llm-action="select-payment-mode-partial"]')).toHaveCount(0);
});
