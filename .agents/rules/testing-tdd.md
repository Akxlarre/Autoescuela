---
paths:
  - "src/app/core/**/*.ts"
  - "src/app/features/**/*.ts"
  - "**/*.spec.ts"
  - "supabase/**"
  - "e2e/**"
---

# Agentic Test-Driven Development (TDD) y Determinismo

Para contrarrestar la naturaleza no-determinista y mitigar el riesgo de deuda técnica silenciosa, estás obligado a operar bajo un estricto **Agentic TDD** — pero enfocado donde aporta valor real, no como burocracia.

## Qué testear y qué no

| Capa | Tests | Razón |
|---|---|---|
| `core/facades/` | **OBLIGATORIO** | Estado reactivo + lógica de negocio |
| `core/services/` | **OBLIGATORIO** | Lógica transversal |
| `core/utils/` | **OBLIGATORIO** | Funciones puras — las más fáciles y valiosas de testear |
| `features/` (Smart Components) | **OBLIGATORIO** | Coordinan facades, tienen `computed()` con lógica |
| `shared/` (Dumb) **con** `computed()` o lógica | **OBLIGATORIO** | Lógica derivada que puede fallar |
| `shared/` (Dumb) **sin** lógica | **OPCIONAL** | Solo inputs/outputs — no hay decisiones que verificar |

### Principio: testea decisiones, no bindings

Un test tiene valor cuando verifica una **decisión** de tu código — un `computed()` que filtra, un `if` que elige un camino, una transformación de datos. Un componente que solo pasa `input()` al template no toma decisiones; eso ya lo testea Angular.

```typescript
// SIN lógica → test opcional (smoke test, bajo valor)
value = input.required<number>();
label = input.required<string>();

// CON lógica → test OBLIGATORIO (decisión que puede fallar)
value = input.required<number>();
formattedValue = computed(() =>
  this.value() > 1000 ? `${(this.value() / 1000).toFixed(1)}K` : String(this.value())
);
```

## Doctrina de Ejecución (Test-Resolution Bucle Cerrado)

1. **Diseña el Contrato Primero:** Antes de implementar lógica funcional en un Facade, Service, util o Smart Component, **escribe su `.spec.ts` primero**. Esto define la expectativa de forma inmutable.
2. **Implementación de Lógica:** Escribe el código fuente intentando satisfacer las pruebas.
3. **Auto-Validación Obligatoria:** Si introduces nueva lógica de negocio, **no puedes dar la tarea por finalizada asumiendo éxito**. Tienes prohibido informarle al humano "ya lo codifiqué" sin antes haber validado empíricamente.
4. **Auto-Corrección:** Ejecuta los tests con `npm run test:ci`. Si fallan, analiza la salida, planifica un parche y corrige tu propio código. Repite hasta que la consola certifique el `PASS`.

## Prohibiciones Estrictas

- **Prohibido asumir éxito silente:** No asumas que tu TypeScript recién generado es correcto hasta interactuar con el validador o compilador.
- **Prohibido entregar lógica Core sin tests:** Cualquier código en `core/facades`, `core/services`, `core/utils` o Smart Components con `computed()` DEBE incluir pruebas unitarias funcionales.
- **Prohibido tests de humo sin valor:** No escribas tests que solo verifican que un componente dumb renderiza un input tal cual. Eso es testing del framework, no de tu código.

## Test Runner: Vitest (Angular 21+)

Este proyecto usa **Vitest** como test runner (no Karma/Jasmine).

### Comandos
- `npm run test` — tests interactivos (watch mode via ng test, legacy)
- `npm run test:ci` — tests sin watch, verbose (para CI y auto-validación)
- `npm run test:coverage` — genera reporte de cobertura en `coverage/`. Cuando falle por una
  dependencia faltante, es que el proveedor `@vitest/coverage-v8` no está instalado: pídele al
  humano que lo instale (el Bash Guard bloquea `npm install`), no lo des por corrido.

### Mocking con Vitest
- `vi.fn()` para crear mock functions
- `vi.spyOn(obj, 'method')` para espiar métodos existentes
- `vi.mock('module')` para mockear módulos completos
- `{ method: vi.fn() }` para mocks manuales de servicios (en lugar de `jasmine.createSpyObj`)
- **NUNCA** usar `jasmine.createSpy()`, `jasmine.createSpyObj()` ni matchers de Jasmine

### Matchers Vitest vs Jasmine
| Jasmine | Vitest |
|---------|--------|
| `toBeTrue()` | `toBe(true)` |
| `toBeFalse()` | `toBe(false)` |
| `jasmine.createSpy()` | `vi.fn()` |
| `spy.and.returnValue(x)` | `spy.mockReturnValue(x)` |
| `spy.and.resolveTo(x)` | `spy.mockResolvedValue(x)` |
| `spy.and.callFake(fn)` | `spy.mockImplementation(fn)` |
| `spyOn(obj, 'm')` | `vi.spyOn(obj, 'm')` |
| `expectAsync(p).toBeResolved()` | `await expect(p).resolves.toBeDefined()` |

### LucideAngularModule en tests
- Usar `LucideAngularModule.pick({ Icon1, Icon2 })` en `imports:` del TestBed
- **NUNCA** usar `provideIcons()` en tests (no existe en lucide-angular 0.577+)

## Las capas de test fuera de `src/app`

Regla: **una regla se prueba en la capa donde vive.** Cuando la regla es una política de la base,
un trigger o el código de una edge function, un test de interfaz solo prueba que la pantalla no
muestra el dato, no que el dato sea inaccesible.

| Qué cambias | Dónde va el test | Lo exige |
|---|---|---|
| Una política de RLS o una función `SECURITY DEFINER` | `supabase/tests/<dominio>/` | ARCH-37 |
| Un trigger o una función con regla de negocio (candado de caja, solape de agenda) | `supabase/tests/<dominio>/` | — |
| Lógica de una edge function | Función pura en `supabase/functions/_shared/` con su `*.test.ts` | — |
| Una edge function nueva | Importa un guard de autorización de `_shared` | ARCH-36 |
| Un permiso, visto desde afuera | E2E que consulta la API con `getClientFor()` | — |
| Un flujo entre pantallas o entre roles | `e2e/*.spec.ts` | — |

### Tests SQL (`supabase/tests/`)

- **Nombra la migración que pruebas por su timestamp** en el encabezado del test. Es el vínculo
  que ARCH-37 busca.
- **Prueba también lo que no se puede hacer.** Siempre que pruebes un permiso, incluye el caso
  negativo: otro rol, otra sede, sin sesión. Es el caso que protege.
- **Suplanta a un usuario real** (`SET LOCAL role authenticated` más sus claims). Una consulta
  probada como dueño de la base no pasa por las políticas.
- **El test termina deshaciendo todo.** Hoy estos tests se corren contra el proyecto enlazado, que
  es la base real (`indices/DOMAIN-GOTCHAS.md` DG-128): van dentro de una transacción que termina
  en `RAISE`. Nunca quites ese cierre.
- **Simular la sesión no prueba la petición real.** Cuando lo que arreglas depende de cómo llega
  la sesión por la API (no de la lógica de la política), agrega además un test por la API.

### E2E (`e2e/`)

- **Nunca `waitForTimeout`:** espera la condición (`expect(locator).toBeVisible()`, `expect.poll`,
  `waitForResponse`), no el reloj.
- **Nunca un `test.skip` que dependa de los datos del día:** un test que se salta deja de probar
  sin avisar. Siembra lo que el test necesita (`createE2eAlumno`, `seedClase`).
- **Un bug conocido no se salta ni se relaja:** se escribe con el comportamiento correcto y se
  marca con `knownBug()`.

### Tests desactivados

Nunca dejes un `describe.skip`, un `it.skip` ni un spec nuevo en el `exclude` de
`vitest.config.ts` para llegar a verde. Excepción: si el motivo es de infraestructura y no lo
puedes resolver en el track, dilo en tu respuesta final con el motivo.

ARCH-35 lleva la cuenta de los cuatro (tests unitarios desactivados, specs excluidos, esperas
fijas, saltos de e2e) contra una línea base: ninguno puede subir.

## Shadow CI y Cobertura

El Linter Arquitectónico (`npm run lint:arch`) verifica que lógicas y módulos clave tengan sus `.spec.ts` complementarios. Si detecta una falta, interrumpirá tu flujo de éxito. Las capas fuera de `src/app` las cubre el mismo comando con ARCH-35, ARCH-36 y ARCH-37 (`scripts/check-qa-guardrails.mjs`).
