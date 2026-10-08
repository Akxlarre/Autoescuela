# Suite E2E con Playwright

Tests end-to-end automatizados que abren la app en un Chrome real, inician sesión con cada rol
y verifican pantallas completas. A diferencia del QA asistido con el Playwright MCP, estos tests
quedan en el repo y cualquiera los puede volver a correr sin Claude. Origen: spec `0019-m`
(`ASG-i-021`), base de la tanda de testing del piloto (`ASG-i-022` … `ASG-i-037`).

## Requisitos

- `npm install` (instala `@playwright/test`).
- **Google Chrome** instalado. La suite usa el Chrome del sistema (`channel: 'chrome'`), así que
  no hay que correr `npx playwright install`.

No hay nada que configurar: las cuentas de prueba están en `e2e/support/accounts.ts`.

## Cómo correrla

| Comando | Qué hace |
|---|---|
| `npm run test:e2e` | Corre toda la suite. Si `ng serve` no está corriendo, lo levanta (y si ya está, lo reutiliza). |
| `npm run test:e2e:ui` | Modo UI de Playwright: lista de tests, ejecución paso a paso y línea de tiempo. Para depurar. |
| `npx playwright show-report` | Abre el reporte HTML de la última corrida (`playwright-report/`). |
| `npx playwright test e2e/smoke.spec.ts` | Corre un solo archivo. |

Cada corrida empieza así:

1. **Verificación previa** (`e2e/global-setup.ts`): si la app apunta a una BD que no es la de
   desarrollo (`src/environments/environment.ts`), o si un error tolerado no tiene
   justificación, la suite se detiene sin correr ningún test.
2. **Sesiones** (`e2e/auth.setup.ts`): inicia sesión por la UI con los 4 roles y guarda cada
   sesión en `e2e/.auth/` (gitignored). Si una cuenta falla, el error dice qué rol y por qué.
3. **Tests.**

## Las 3 reglas de convivencia

La suite corre contra **la misma BD de desarrollo que usa el equipo**, mientras otros trabajan
en ella. Por eso:

### 1. Nunca resetear

Los tests parten de los datos que dejó el seed de la spec `0008-i`. Nunca se ejecuta su reset ni
ningún borrado masivo: borraría los datos que un compañero está usando.

### 2. Sin conteos absolutos

Otro dev puede crear o borrar datos en cualquier momento. Compara antes y después, o valida la
forma, nunca un número fijo.

```ts
// ❌ Se rompe apenas alguien crea un alumno a mano
await expect(page.getByTestId('total-alumnos')).toHaveText('250');

// ✅ Relativo: antes vs después de la acción
const antes = await contarFilas(page);
await crearAlumno(page, e2eName('alumno'));
expect(await contarFilas(page)).toBe(antes + 1);

// ✅ Forma: el KPI muestra un número, no un error ni un skeleton eterno
await expect(kpi).toHaveText(/^\d[\d.]*$/);
```

### 3. Todo lo que se crea lleva `E2E-` y se limpia

```ts
import { e2eName, test } from './support/fixtures';

test('crea algo', async ({ cleanup }) => {
  const nombre = e2eName('tarea'); // → "E2E-tarea-1727712345678"
  const id = await crearAlgo(nombre);
  cleanup.track('tasks', id); // se borra al terminar, pase o falle el test
});
```

`cleanup` borra con la sesión de admin (la RLS aplica igual que en la UI). Si un borrado falla
—por ejemplo, porque la RLS no deja borrar esa tabla—, el test lo reporta como error: ese caso
hay que resolverlo en el módulo correspondiente, no ignorarlo.

Si un test se corta de golpe (Ctrl+C) y deja datos, se encuentran por el prefijo. Ejemplo en el
SQL Editor de Supabase (proyecto de desarrollo):

```sql
select id, subject, created_at from tasks where subject like 'E2E-%';
```

## Escribir un test nuevo

Copia `e2e/smoke.spec.ts`, que es la plantilla:

```ts
import { expect, test, watchErrors } from './support/fixtures';

test('secretaria A ve su agenda', async ({ pageAs }) => {
  const page = await pageAs('secretariaA'); // sesión ya iniciada, sin pasar por /login
  const errors = watchErrors(page);          // antes de navegar

  await page.goto('/app/secretaria/agenda');
  await expect(page.getByRole('main')).toBeVisible();

  errors.expectClean();                      // sin errores de consola ni HTTP ≥400
});
```

- **Importa siempre desde `./support/fixtures`**, no desde `@playwright/test`.
- **Roles disponibles:** `admin`, `secretariaA` (sede 1), `secretariaB` (sede 2),
  `secretariaMultisede` (sede 1 + permiso para ambas sedes).
- **Dos roles en el mismo test:** llama `pageAs()` dos veces; cada rol tiene su propio contexto
  de navegador y sus sesiones no se pisan.
- **Selectores:** `data-llm-action` / `data-llm-description` (ya existen por la regla de
  AI-readability) o roles ARIA (`getByRole`). Nunca clases CSS: cambian con el diseño.
- Los archivos de test van en `e2e/` con extensión `.spec.ts`. Lo que está en `e2e/support/`
  son funciones de apoyo; sus `.spec.ts` son tests unitarios de Vitest (`npm run test:ci`).
- **Ancho de pantalla:** `pageAs()` abre a 1280 px, y a ese ancho varias listas (Alumnos,
  Ex-Alumnos) ya se muestran como tarjetas, no como tabla. Si el test necesita la tabla, fija
  antes `page.setViewportSize({ width: 1600, height: 900 })`.

## Alumnos de prueba

Un test que cambia el estado de un alumno (archivar, marcar ex-alumno, editar perfil…) no usa
alumnos del seed: crea el suyo con `createE2eAlumno()` (`e2e/support/alumnos-seed.ts`).

```ts
import { createE2eAlumno } from './support/alumnos-seed';

test('archivar', async ({ pageAs, cleanup }) => {
  const alumno = await createE2eAlumno(
    { label: 'Archivar', branchId: 1, enrollments: [{ paymentStatus: 'pending' }] },
    cleanup, // usuario, alumno y matrículas se borran al terminar
  );
  // alumno.paternalLastName es único: sirve para buscarlo en la lista.
});
```

Cada matrícula acepta curso, estado, estado de pago, saldo, `docsComplete` y fechas. Sin
`enrollments`, el alumno queda "Pre-inscrito" y sin historial. `markCertificateSent()` deja una
matrícula con el certificado Clase B "ya enviado" (habilita "Marcar como Ex-Alumno").

Para una matrícula de **Clase Profesional**, pásale el curso y su cupo en una promoción:
`{ courseName: 'Profesional A2', promotionCourseId }`. El cupo se busca por API (la promoción en
curso más nueva de la sede 2 y su curso A2: ver `cursoVigente()` en
`e2e/clase-profesional.spec.ts`), nunca con un id fijo. Mientras el test corre, esa promoción
muestra un inscrito más.

El helper crea solo `users`, `students` y `enrollments`: sin clases, pagos ni documentos. Para
esos casos, por ahora, se lee un alumno del seed (nombres `AlumnoNN ApellidoNN`) sin modificarlo.

`getClientFor(email, password)` (`e2e/support/supabase-admin.ts`) entrega un cliente Supabase
con la sesión de cualquier cuenta de prueba, para comprobar la RLS por fuera de la UI.

## Tests de bugs conocidos

Cuando un test confirma un bug que todavía no se corrige, no se borra ni se relaja: se escribe con
el comportamiento **correcto** y se marca con `knownBug()` (de `./support/fixtures`; por dentro es
un `test.fail()`). La suite queda verde, y el día que el bug se corrija Playwright reporta que el
test "pasó inesperadamente", lo que obliga a quitar la marca.

```ts
test('M04: la Papelera no queda pegada', async ({ pageAs }) => {
  knownBug('B4 (fix-264-m)'); // bug + track de testing donde está descrito
  // … el test, escrito como debería comportarse la app
});
```

Para ver el error real de cada uno (y comprobar que falla por el bug y no por otra causa):

```bash
E2E_SHOW_KNOWN_BUGS=1 npx playwright test e2e/alumnos-b-lista.spec.ts
```

## Errores tolerados

`watchErrors().expectClean()` falla ante cualquier error de consola o respuesta HTTP ≥400. Si
aparece un error conocido que no se va a corregir ahora, se agrega a
`e2e/support/known-errors.ts` **con su justificación**:

```ts
export const KNOWN_ERRORS: KnownError[] = [
  { pattern: /favicon\.ico/, reason: 'Sin favicon en dev; no afecta al usuario' },
];
```

Una entrada sin `reason` detiene la suite entera. Si el error es un bug real, se reporta
(fix/asignación) en vez de agregarlo a la lista.

## Cuentas de prueba

Todas usan la contraseña `Test123456` (la misma que muestra la pantalla de login).

| Rol | Email | Sede | Origen |
|---|---|---|---|
| `admin` | `admin@test.com` | todas | seed `0008-i` |
| `secretariaA` | `secretaria@test.com` | 1 — Autoescuela Chillán | seed `0008-i` |
| `secretariaB` | `secretaria2@test.com` | 2 — Conductores Chillán | seed `0008-i` |
| `secretariaMultisede` | `secretaria.multisede@test.com` | 1 + permiso ambas sedes | creada a mano (abajo) |

### Cómo se creó la secretaria multi-sede

Se crea una sola vez en la BD de desarrollo (es compartida). Solo hay que repetirlo si la cuenta
se borra.

1. Entra como `admin@test.com` → **Secretarias** → **Crear**.
2. Completa los datos (la cuenta actual se creó como "Antonia Multi Sede", RUT `19.658.564-8`;
   cualquier nombre y RUT válido sirven): correo `secretaria.multisede@test.com`, sede
   **Autoescuela Chillán** y, en **Acceso a sedes**, el botón **Todas las sedes**.
3. Cierra sesión y entra con `secretaria.multisede@test.com`. La contraseña inicial es el RUT
   sin puntos ni dígito verificador (ej. `19658564`); no llega ningún correo.
4. La app pide cambiar la contraseña (primer login): pon `Test123456`.

Si el paso 4 no se hace, el setup falla con "la cuenta tiene el primer login pendiente".
