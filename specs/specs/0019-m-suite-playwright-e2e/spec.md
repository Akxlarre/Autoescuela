# Spec 0019-m — Suite Playwright E2E automatizada (base de la tanda de testing)

> **Status:** done
> **Closed:** 2026-09-30
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
- Credenciales escritas directo en la suite, centralizadas en un solo archivo. **Ajuste del
  owner a la ASG (2026-09-30):** la ASG pedía `.env.e2e` gitignored, pero la contraseña y los
  correos de las cuentas de prueba ya son públicos en la pantalla de login
  (`login.component.ts`) y la BD es solo de desarrollo; esconderlos no protege nada y agrega
  un paso de setup. La secretaria multi-sede usa la misma contraseña que las demás cuentas.
- Una página corta en `docs/` que explique cómo correr la suite.

---

## 2. User Stories

- **US1**: Como desarrollador, quiero correr toda la suite E2E con un solo comando y ver un
  reporte, para validar la app antes de cada entrega sin hacer QA manual repetido.
- **US2**: Como desarrollador que escribe los tests de un módulo (`ASG-i-022…037`), quiero
  sesiones ya iniciadas para cada rol, para escribir tests sin repetir el login y sin que una
  sesión pise a otra.
- **US3**: Como desarrollador que escribe los tests de un módulo, quiero un test plantilla y
  helpers listos (consola/red, limpieza de datos), para copiar un patrón en vez de reinventarlo.
- **US4**: Como integrante del equipo que trabaja en la BD de desarrollo, quiero que la suite
  no borre ni ensucie mis datos, para poder seguir trabajando mientras otro la corre.

---

## 3. Acceptance Criteria (Gherkin)

> Cada AC debe ser verificable empíricamente. Si no puedes escribir un test o un check
> manual reproducible, el AC está mal formulado.

- **AC1 (comando y reporte)**: Given las dependencias instaladas, When se
  ejecuta `npm run test:e2e`, Then se levanta `ng serve`, corre la suite completa, se genera un
  reporte HTML y el comando termina con código 0 si todos los tests pasan (distinto de 0 si
  alguno falla).
- **AC2 (modo depuración)**: Given lo mismo que AC1, When se ejecuta `npm run test:e2e:ui`,
  Then se abre el modo UI de Playwright con los tests de la suite listados.
- **AC3 (nunca contra otra BD)**: Given que la URL de Supabase con la que corre la app no es la
  del proyecto de desarrollo, When se inicia la suite, Then aborta antes de ejecutar cualquier
  test, con un mensaje que indica la URL detectada.
- **AC4 (sesiones por rol)**: Given los 4 roles (admin, secretaria sede A, secretaria sede B,
  secretaria multi-sede), When un test usa la fixture de un rol, Then abre la app con la sesión
  de ese rol ya iniciada, sin pasar por `/login`, y ve el dashboard de su rol.
- **AC5 (sesiones aisladas)**: Given un test que usa dos roles a la vez (admin y secretaria
  sede A), When ambos navegan en paralelo, Then cada uno sigue viendo su propio usuario y rol
  (ninguna sesión pisa a la otra).
- **AC6 (secretaria multi-sede)**: Given la cuenta de secretaria multi-sede creada por esta
  spec, When inicia sesión, Then puede operar en ambas sedes (comportamiento del grant de la
  spec `0017-b`), mientras que la secretaria sede A no puede.
- **AC7 (test de humo)**: Given la sesión de admin, When se abre `/app/admin/dashboard` y
  termina de cargar, Then no hay errores de consola ni respuestas HTTP 4xx/5xx, salvo los que
  están en la lista de tolerados (AC8). El test usa selectores `data-llm-*` o roles ARIA, no
  clases CSS.
- **AC8 (lista de tolerados)**: Given la lista de errores tolerados (un único archivo en
  `e2e/`), Then cada entrada tiene un patrón y una justificación. Una entrada sin justificación
  hace fallar la suite.
- **AC9 (limpieza de datos)**: Given un test de ejemplo que crea un registro con el prefijo
  `E2E-` usando el helper de limpieza, When termina (pase o falle), Then ese registro ya no
  existe en la BD de desarrollo.
- **AC10 (sin reset)**: Given el código de `e2e/`, Then no invoca el reset de `0008-i` ni
  ningún borrado masivo; solo borra lo que registró el helper de limpieza.
- **AC11 (cuentas centralizadas)**: Given la suite, Then los correos y contraseñas de las 4
  cuentas de prueba están definidos en un único archivo de `e2e/`, y ningún test los escribe
  por su cuenta. La suite corre sin ningún paso de configuración previo.
- **AC12 (documentación)**: Given una página en `docs/`, Then explica cómo instalar, correr la
  suite y el modo UI, cómo se creó la secretaria multi-sede, y las 3 reglas de convivencia (sin
  reset, sin conteos absolutos, datos `E2E-` con limpieza), con un ejemplo de cada una.

### Edge cases obligatorios

- **AC-E1 (servidor ya corriendo)**: Given `ng serve` ya levantado en `localhost:4200`, When se
  ejecuta `npm run test:e2e`, Then la suite lo reutiliza en vez de fallar por el puerto ocupado.
- **AC-E2 (credencial inválida)**: Given la contraseña de un rol incorrecta, When se generan
  las sesiones, Then la suite falla indicando qué rol no pudo iniciar sesión (no un timeout
  genérico).
- **AC-E3 (test caído a mitad)**: Given un test que falla después de crear un registro `E2E-`,
  When termina la corrida, Then el registro igual se borra (la limpieza corre también cuando
  el test falla).

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
- Flujo principal (happy path): `npm run test:e2e` → se generan las sesiones de los 4 roles →
  corren los tests → abre el reporte HTML.
- Estados especiales: BD equivocada (AC3), credencial inválida (AC-E2).

---

## 8. Métricas de éxito post-launch

> Cómo sabremos en producción que funciona. Opcional para specs internas.

- Al menos una asignación de módulo (`ASG-i-022…037`) agrega sus tests copiando la plantilla,
  sin cambiar la infraestructura.
- Nadie del equipo reporta datos borrados o basura `E2E-` por corridas de la suite.

---

## 9. Notas / decisiones abiertas

- [x] BD objetivo: desarrollo en la nube, no Supabase local. Decisión del owner 2026-09-30
  (ASG actualizada antes de reclamar).
- [x] Secretaria multi-sede: no existe, se crea en esta spec. Owner 2026-09-30.
- [x] Test de humo con lista de errores tolerados justificados. Owner 2026-09-30.
- [x] Helper de limpieza base en la suite; casos no borrables por UI → cada módulo. Owner
  2026-09-30.
- [x] Ubicación `e2e/` en la raíz. Owner 2026-09-30.
- [x] Secretaria multi-sede: se crea desde la UI de admin (crear secretaria + otorgar el
  grant), con los pasos documentados, sin migración (es un dato de prueba, no esquema). Owner
  2026-09-30.
- [x] Entidad del test de ejemplo de limpieza (AC9): una `tasks` creada por API (no por UI,
  para no generar una notificación real). Detalle en `plan.md` §3.
- Originado de Asignación ASG-i-021 (specs/assignments/ASG-i-021-montar-suite-playwright-e2e.md)

---

## Changelog

- 2026-09-30 — draft inicial por Matías, reclamada desde `ASG-i-021`.
- 2026-09-30 — borrador de US1-US4 y AC1-AC12 + AC-E1-E4, pendiente de revisión del owner.
- 2026-09-30 — sin `.env.e2e`: credenciales centralizadas en la suite (AC11 reescrito, AC-E de
  variable faltante eliminado; quedan AC-E1-E3). Secretaria multi-sede vía UI de admin.
- 2026-09-30 — aprobada por Matías (owner).
- 2026-09-30 — cerrada (`done`): 15/15 AC, ver [acceptance.md](./acceptance.md).
