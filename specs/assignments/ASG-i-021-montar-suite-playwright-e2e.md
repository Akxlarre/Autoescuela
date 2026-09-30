# Asignación ASG-i-021 — Montar la suite Playwright E2E automatizada (base de la tanda de testing)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

El proyecto hoy solo tiene tests unitarios (Vitest, ~215 `.spec.ts`). No existe ninguna suite
E2E automatizada: todo lo "end-to-end" que se hizo hasta ahora (UAT de agosto, QA visual de
`ASG-i-012`) fue manual o asistido con el Playwright MCP, y no se puede re-ejecutar. Esta
asignación monta la infraestructura de **Playwright Test** para que las asignaciones de testing
por módulo (`ASG-i-022` … `ASG-i-037`) puedan dejar sus casos críticos automatizados y
re-ejecutables antes de cada entrega.

**Clasificación:** infraestructura · dificultad **Alta** · bloquea la capa "Playwright" del resto
de la tanda (la capa manual de cada módulo NO depende de esta).

## Alcance sugerido

- Instalar `@playwright/test` y crear `playwright.config.ts` + carpeta `e2e/` (confirmar ubicación
  con el equipo; `e2e/` en la raíz es lo convencional y no choca con la estructura de `src/`).
- `webServer` que levante `ng serve` contra **Supabase local** (`npx supabase start`) — nunca
  contra producción.
- **Datos reproducibles:** reusar el reset/seed de spec `0008-i` para partir de un estado
  conocido antes de cada corrida (o por archivo de test).
- **Fixtures de sesión por rol** (`storageState`): admin, secretaria sede A, secretaria sede B,
  secretaria con grant multi-sede. Cada rol en su propio `BrowserContext` — esto resuelve el
  problema del UAT de que 2 pestañas comparten `localStorage` y una sesión pisa a la otra.
- Selectores: priorizar `data-llm-action` / `data-llm-description` (ya existen por la regla de
  AI-readability) y roles ARIA, no clases CSS.
- Script `npm run test:e2e` (+ modo `--ui` para depurar) y reporte HTML.
- 1 test "humo" de ejemplo (login admin → dashboard carga sin errores de consola ni 4xx/5xx)
  como plantilla para el resto de la tanda.
- Documentar en `docs/` cómo correrla (una página corta).

## Fuera de alcance

- Escribir los tests de cada módulo — eso lo hace cada `ASG-i-022…037`.
- Integrarla en CI (se puede proponer después, cuando la suite sea estable).
- Pagos reales por Webpay (la matrícula pública está fuera del piloto).

## Referencias

- `specs/specs/0008-i-reset-y-poblar-datos-prueba/spec.md` (seed de datos)
- `docs/UAT-PLAN.md` — nota del Paquete 5 sobre `localStorage` compartido entre pestañas
- `.claude/skills/verify/SKILL.md` (checks que ya usa el QA asistido: consola, red, app-like)

## Archivos involucrados (opcional, para detectar solapes)

- `package.json`, `playwright.config.ts` (nuevo), `e2e/` (nuevo), `docs/` (nuevo doc)

## Notas para quien la reclame

- Es la primera de la tanda: conviene tomarla ya, en paralelo con las pasadas manuales.
- Las cuentas de prueba (`admin@…`, `secretaria@test.com`, `secretaria2@test.com`) están en el
  seed; no hardcodear contraseñas en el repo — usar variables de entorno (`.env.e2e` gitignored).
