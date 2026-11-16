# Alcance de cada pieza del harness

Este proyecto nació de un boilerplate (Koa Agent Blueprint) y le fue agregando reglas propias.
Esta tabla dice, pieza por pieza, cuál vale para cualquier proyecto del mismo stack y cuál es de
la autoescuela. Sirve para una sola cosa: saber qué llevarse al arrancar el próximo proyecto, o qué
devolver al boilerplate.

| Alcance | Significa | Al exportar |
|---|---|---|
| boilerplate | Vale tal cual en cualquier proyecto Angular + Tailwind + PrimeNG + Supabase | Se copia |
| mixto | La regla es genérica, pero el texto cita pantallas, tablas o tracks de este proyecto | Se copia y se limpian los ejemplos |
| proyecto | Depende del negocio o del país de este proyecto | No se copia |

**Estado de la clasificación:** propuesta inicial (2026-11-16). Las reglas se clasificaron
leyendo su contenido; los antipatrones y los skills, por su título y descripción. La confirma
quien mantiene el boilerplate.

**Guardrail: ARCH-42** (`npm run lint:arch`). Falla si una regla de `.claude/rules/`, un
antipatrón de `indices/ANTI-PATTERNS.md` o un skill de `.claude/skills/` no tiene fila acá, si una
fila nombra una pieza que ya no existe, o si el alcance no es uno de los tres. Al crear una pieza
nueva, se clasifica en el mismo cambio.

**Fuera de la tabla, por definición:**

- `indices/DOMAIN-GOTCHAS.md`: todo es de este proyecto.
- `indices/PATTERNS.md`: los arquetipos son genéricos, las implementaciones de referencia son de
  este proyecto. En un proyecto nuevo se conserva la columna de arquetipos y se vacía la de
  referencias.
- Los hooks de `.claude/hooks/` y los guardrails de `scripts/`: son mecanismo del boilerplate.
  Lo único propio del proyecto en ellos son las listas de excepciones y las líneas base
  (`scripts/lib/*.allowlist.json`, `*.baseline.json`), que en un proyecto nuevo arrancan vacías.

## Reglas (`.claude/rules/`)

| Pieza | Alcance | Nota |
|---|---|---|
| `rules/ai-readability.md` | boilerplate | Atributos `data-llm-*` |
| `rules/architecture.md` | mixto | Carpetas, facade, signals y roles de `shared/` son genéricos; los ejemplos de organismos citan drawers de este proyecto |
| `rules/database.md` | mixto | Migraciones idempotentes y RLS son genéricas; revisar las menciones a tablas propias |
| `rules/dates.md` | mixto | "Dos tipos, un módulo por capa" es genérico; la zona `America/Santiago` y los nombres `chile*` son de este proyecto |
| `rules/facades.md` | mixto | Estructura del facade, mapeo y guard de orden son genéricos; la sección multi-sede y sus tablas de facades son de este proyecto |
| `rules/models.md` | boilerplate | División `dto/` y `ui/` |
| `rules/notifications.md` | mixto | Las tres capas son genéricas; el canal y la tabla son de este proyecto |
| `rules/swr-pattern.md` | boilerplate | Incluye los errores de carga; el ejemplo del cierre de caja es ilustrativo |
| `rules/testing-tdd.md` | mixto | TDD y Vitest son genéricos; la sección de capas fuera de `src/app` cita la base real de este proyecto |
| `rules/visual-system.md` | mixto | Tokens, bento, app-like y GSAP son genéricos; las notas de corrección citan tracks y pantallas de este proyecto |

## Antipatrones (`indices/ANTI-PATTERNS.md`)

| Pieza | Alcance | Nota |
|---|---|---|
| `AP-001` | boilerplate | `[ngClass]` |
| `AP-002` | boilerplate | `@Input()` / `@Output()` |
| `AP-003` | boilerplate | Supabase en componentes |
| `AP-004` | boilerplate | Colores Tailwind hardcodeados |
| `AP-005` | boilerplate | `@angular/animations` |
| `AP-006` | boilerplate | Interfaces duplicadas |
| `AP-007` | boilerplate | Polling con `setInterval` |
| `AP-008` | boilerplate | `effect()` en facades |
| `AP-009` | boilerplate | Lógica pesada en facades o componentes |
| `AP-010` | boilerplate | `MessageService` directo |
| `AP-011` | boilerplate | Clases de token que no generan CSS |
| `AP-012` | boilerplate | Pill o badge ad-hoc |
| `AP-013` | boilerplate | Utilities de tamaño sobre `btn-*` |
| `AP-014` | boilerplate | Tamaño de fuente arbitrario |
| `AP-015` | boilerplate | Alias bare en `@theme` |
| `AP-016` | mixto | El criterio de rol es genérico; la lista de organismos es de este proyecto |
| `AP-017` | boilerplate | Spacing sin verificar el `display` |
| `AP-018` | boilerplate | Color del `@theme` con nombre de tamaño |

## Skills (`.claude/skills/`)

| Pieza | Alcance | Nota |
|---|---|---|
| `skills/angular-component` | boilerplate | |
| `skills/angular-forms` | boilerplate | |
| `skills/angular-primeng` | boilerplate | |
| `skills/angular-signals` | boilerplate | |
| `skills/compliance-cl` | mixto | Sirve a cualquier SaaS en Chile; el pack `autoescuela-cl` es de este proyecto |
| `skills/design-system` | boilerplate | |
| `skills/form-ux` | boilerplate | |
| `skills/grill_me` | boilerplate | |
| `skills/harness-feedback` | boilerplate | |
| `skills/sdd` | mixto | El flujo es genérico; los códigos de autor y la capa de asignaciones dependen del equipo |
| `skills/supabase-data-model` | boilerplate | |
| `skills/sync-indices` | boilerplate | |
| `skills/verify` | mixto | El protocolo es genérico; las rutas y cuentas de prueba son de este proyecto |
| `skills/writing-great-skills` | boilerplate | |
