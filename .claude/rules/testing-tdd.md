# Agentic Test-Driven Development (TDD) y Determinismo

Para contrarrestar la naturaleza no-determinista y mitigar el riesgo de deuda técnica silenciosa, estás obligado a operar bajo un estricto **Agentic TDD**.

## Doctrina de Ejecución (Test-Resolution Bucle Cerrado)

1. **Diseña el Contrato Primero:** Antes de implementar la lógica funcional de un componente de UI, un Servicio o un Facade, **debes escribir su archivo de pruebas (`.spec.ts`) primero**. Esto define la expectativa de forma inmutable.
2. **Implementación de Lógica:** Escribe el código fuente (la implementación real) intentando satisfacer las pruebas.
3. **Auto-Validación Obligatoria:** Si introduces nueva lógica de negocio, **no puedes dar la tarea por finalizada asumiendo éxito**. Tienes prohibido informarle al humano "ya lo codifiqué" sin antes haber validado empíricamente.
4. **Auto-Corrección:** Utiliza tus capacidades de terminal para ejecutar los tests usando `npm run test` (u otra herramienta como Vitest, Jasmine, dependiendo de la configuración de Angular). Si el terminal te devuelve errores o el test falla, analiza la salida del fallo, planifica un parche y corrige tu propio código. Repite este bucle de validación de forma autónoma hasta que la consola certifique el `PASS`.

## Prohibiciones Estrictas

- ❌ **Prohibido asumir éxito silente:** No asumas que tu TypeScript recién generado es correcto hasta interactuar con el validador o compilador.
- ❌ **Prohibido entregar Features "Core" sin tests:** Cualquier código escrito en `core/facades`, `core/services` o en capas de integración complejas DEBE incluir sus pruebas unitarias funcionales.

## Shadow CI y Cobertura

Nuestro sistema incluye un Linter Arquitectónico (Guardrails) que será ejecutado en el paso de Validación (`npm run lint:arch`). Este linter revisará que, si creaste nuevas lógicas o modulos clave, no hayas "olvidado" de manera negligente sus archivos `.spec.ts` complementarios. Si el linter detecta una falta de validadores de código, interrumpirá tu flujo de éxito.
