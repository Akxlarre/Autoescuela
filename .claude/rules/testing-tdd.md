---
paths:
  - "src/app/core/**/*.ts"
  - "src/app/features/**/*.ts"
  - "**/*.spec.ts"
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
- `npm run test:coverage` — genera reporte de cobertura en `coverage/`

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

## Shadow CI y Cobertura

El Linter Arquitectónico (`npm run lint:arch`) verifica que lógicas y módulos clave tengan sus `.spec.ts` complementarios. Si detecta una falta, interrumpirá tu flujo de éxito.
