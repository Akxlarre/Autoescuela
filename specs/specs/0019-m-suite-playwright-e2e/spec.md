# Spec 0019-m — Suite Playwright E2E automatizada (base de la tanda de testing)

> **Status:** draft
> **Created:** 2026-09-30
> **Owner:** Matías
> **Priority:** P0

---

## 1. Contexto de negocio

**Origen:** Asignación de equipo `ASG-i-021`
(`specs/assignments/ASG-i-021-montar-suite-playwright-e2e.md`), creada por Ignacio el
2026-09-29 como base de la tanda de testing del piloto (`ASG-i-022` … `ASG-i-037`).

**Persona afectada:** Equipo de desarrollo (uso interno, no afecta a usuarios finales).

**Problema que resuelve:**
El proyecto solo tiene tests unitarios (Vitest, ~215 `.spec.ts`). No existe ninguna suite E2E
automatizada: todo lo "end-to-end" hecho hasta ahora (UAT de agosto, QA visual de `ASG-i-012`)
fue manual o asistido con el Playwright MCP, y no se puede re-ejecutar. Sin esta
infraestructura, las asignaciones de testing por módulo no pueden dejar sus casos críticos
("Auto ✓" en `specs/testing-piloto/`) automatizados y re-ejecutables antes de cada entrega.
Solo bloquea la capa Playwright de la tanda; la capa manual de cada módulo no depende de esto.

**Hipótesis de valor:**
Con una suite base (config, sesiones por rol, helpers y un test plantilla), cada módulo puede
automatizar sus casos sin re-decidir la infraestructura, empezando por el barrido de rutas de
`037` §3-B (todas las rutas × roles × anchos × temas).

**Alcance heredado de la ASG (confirmado por el owner al reclamar, 2026-09-30):**

- `@playwright/test`, `playwright.config.ts` y carpeta `e2e/` en la raíz del repo.
- `webServer` que levanta `ng serve` contra la **BD de desarrollo en la nube** (la que el
  equipo usa a diario). Nunca contra producción. No se usa Supabase local: nadie del equipo lo
  usa para desarrollar.
- **Convivencia con la BD compartida** (los 3 devs la usan mientras la suite corre):
  - Prohibido ejecutar el reset de `0008-i` desde la suite; los tests parten de los datos que
    el seed ya dejó.
  - Sin conteos absolutos: comparaciones relativas (antes vs después) o validación de
    forma/estado.
  - Todo dato que cree un test lleva el prefijo `E2E-` y se borra al terminar. La suite
    provee un **helper de limpieza base**; los casos que la UI no permite borrar los resuelve
    cada módulo en su propia asignación.
  - Si más adelante algún test que modifica datos no puede cumplir estas reglas, se evalúa un
    proyecto Supabase separado para E2E (fuera de esta spec).
- **Sesiones por rol** (`storageState`, un `BrowserContext` por rol): admin, secretaria sede A,
  secretaria sede B y secretaria con grant multi-sede (`users.can_access_both_branches`).
  **La cuenta de secretaria multi-sede no existe en la BD de desarrollo** (el seed de `0008-i`
  solo preserva `admin@`, `secretaria@`, `secretaria2@`, `instructor@` y `alumno@`): esta spec
  la crea.
- Selectores basados en `data-llm-action` / `data-llm-description` y roles ARIA, no en clases
  CSS.
- `npm run test:e2e` (+ modo `--ui` para depurar) y reporte HTML.
- 1 test de humo plantilla: login admin → dashboard carga sin errores de consola ni respuestas
  4xx/5xx. Con una **lista explícita de errores conocidos tolerados**, cada uno con
  justificación, para que un error preexistente no deje la suite en rojo desde el día uno.
- Credenciales en variables de entorno (`.env.e2e`, gitignored); nunca en el repo.
- Una página corta en `docs/` que explique cómo correr la suite.

---

## 2. User Stories

- **US1**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US2**: Como {{rol}}, quiero {{capacidad}} para {{outcome}}.
- **US3**: …

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC2**: Given {{precondición}}, When {{acción}}, Then {{resultado observable}}.
- **AC3**: …

### Edge cases obligatorios

- **AC-E1**: Given {{caso límite}}, When …, Then …
- **AC-E2**: …

---

## 4. Out of scope

> Explícito. Lo que NO entra en esta spec, aunque podría parecer relacionado.
> Si surge durante la implementación, crear spec nueva — NO extender ésta.

- ❌ Escribir los tests de cada módulo (lo hace cada `ASG-i-022…037`).
- ❌ Integrar la suite en CI (se propone después, cuando sea estable).
- ❌ Pagos reales por Webpay (la matrícula pública está fuera del piloto).
- ❌ Proyecto Supabase separado para E2E (se evalúa solo si hace falta más adelante).

---

## 5. Dependencias

### Specs previas
- `0008-i-reset-y-poblar-datos-prueba` (`done`): su seed es el dataset del que parte la suite.
  Su reset **no** se ejecuta desde la suite.

### Capacidades del proyecto que se asumen existentes
- Cuentas de prueba del seed: `admin@test.com`, `secretaria@test.com`,
  `secretaria2@test.com`.
- Grant multi-sede `users.can_access_both_branches` (spec `0017-b`).
- Atributos `data-llm-*` en el DOM interactivo (regla `ai-readability.md`).
- Checks del QA asistido en `.claude/skills/verify/SKILL.md` (consola, red, app-like).

### Capacidades nuevas requeridas
- Cuenta de secretaria con grant multi-sede en la BD de desarrollo.
- Dependencia de desarrollo `@playwright/test`.

---

## 6. Datos y modelo (preliminar)

> Solo si el feature toca persistencia. Detalle técnico final va en `plan.md`.

- Tablas nuevas / modificadas: ninguna. Solo se agrega una fila de usuario (secretaria
  multi-sede) en la BD de desarrollo; el mecanismo exacto va en `plan.md`.
- Modelos UI nuevos: ninguno.
- RLS requerida: ninguna nueva.

---

## 7. UX y flujos (preliminar)

> Solo a nivel de wireframe verbal. Detalle visual va con el diseñador/DS.

- Pantalla(s) afectada(s): ninguna (infraestructura de testing).
- Flujo principal (happy path): …
- Estados especiales (loading, error, vacío): …

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- {{métrica 1}}
- {{métrica 2}}

---

## 9. Notas / decisiones abiertas

- [x] BD objetivo: desarrollo en la nube, no Supabase local. Decisión del owner 2026-09-30
  (ASG actualizada antes de reclamar).
- [x] Secretaria multi-sede: no existe, se crea en esta spec. Owner 2026-09-30.
- [x] Test de humo con lista de errores tolerados justificados. Owner 2026-09-30.
- [x] Helper de limpieza base en la suite; casos no borrables por UI → cada módulo. Owner
  2026-09-30.
- [x] Ubicación `e2e/` en la raíz. Owner 2026-09-30.
- [ ] {{decisión a tomar antes de planificar}}
- Originado de Asignación ASG-i-021 (specs/assignments/ASG-i-021-montar-suite-playwright-e2e.md)

---

## Changelog

- 2026-09-30 — draft inicial por Matías, reclamada desde `ASG-i-021`.
