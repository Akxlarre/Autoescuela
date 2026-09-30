# Asignación ASG-i-021 — Montar la suite Playwright E2E automatizada (base de la tanda de testing)

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-09-30
> **resulting_track:** 0019-m-suite-playwright-e2e

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
- `webServer` que levante `ng serve` contra la **BD de desarrollo en la nube** (la misma que usa
  el equipo a diario, `environment.development.ts`) — nunca contra producción. No se usa
  Supabase local: nadie del equipo lo usa para desarrollar.
- **Convivencia con la BD compartida** (la usan los 3 devs mientras la suite corre):
  - **Prohibido ejecutar el reset de `0008-i`** desde la suite: borra instructores/alumnos que
    otros pueden estar usando. Los tests parten de los datos que el seed ya dejó.
  - **Sin conteos absolutos:** nada de "hay 250 alumnos". Usar comparaciones relativas (antes
    vs después de la acción) o validar forma/estado ("el KPI muestra un número, no un error").
  - **Datos propios marcados y limpiados:** todo registro que cree un test lleva un prefijo
    identificable (ej. `E2E-`) y se borra al terminar (`afterEach`/`afterAll`). El prefijo
    permite barrer a mano lo que quede si un test se cae a mitad de camino.
  - Si más adelante algún test que modifica datos no se puede escribir con estas reglas (ej.
    totales exactos de contabilidad), se evalúa un **proyecto Supabase separado para E2E**,
    donde sí se podría resetear. No es parte de esta asignación.
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

- `specs/specs/0008-i-reset-y-poblar-datos-prueba/spec.md` (seed de datos que la suite
  aprovecha; su reset NO se ejecuta desde la suite)
- `docs/UAT-PLAN.md` — nota del Paquete 5 sobre `localStorage` compartido entre pestañas
- `.claude/skills/verify/SKILL.md` (checks que ya usa el QA asistido: consola, red, app-like)

## Archivos involucrados (opcional, para detectar solapes)

- `package.json`, `playwright.config.ts` (nuevo), `e2e/` (nuevo), `docs/` (nuevo doc)

## Notas para quien la reclame

- Es la primera de la tanda: conviene tomarla ya, en paralelo con las pasadas manuales.
- Las cuentas de prueba (`admin@…`, `secretaria@test.com`, `secretaria2@test.com`) están en el
  seed; no hardcodear contraseñas en el repo — usar variables de entorno (`.env.e2e` gitignored).
