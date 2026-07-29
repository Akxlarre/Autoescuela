# Spec 0018-b — Guardrails quick-wins: linter + indexer

> **Status:** done (2026-07-01 — ver acceptance.md)
> **Created:** 2026-07-01
> **Owner:** Akxlarre
> **Priority:** P2
> **Modelo Claude:** `claude-haiku-4-5-20251001` (Haiku 4.5) — trabajo mecánico y bien especificado: cada regla tiene un patrón existente que imitar en `architect.js` / `indices-sync.js`, cero decisiones de diseño abiertas.

---

## 1. Contexto de negocio

**Origen:** Sesión de análisis del tooling AST (2026-07-01). Cuatro reglas del proyecto viven
solo en docs/CLAUDE.md y hoy nadie las vigila mecánicamente; el costo de agregarlas es mínimo
porque el andamiaje (AST walker, colectores, marcadores AUTO-GENERATED) ya existe.

**Persona afectada:** El agente (Claude Code) y el humano que revisa sus PRs.

**Problema que resuelve:**
1. La tabla de `models.md` prohíbe que componentes importen de `core/models/dto/` — hoy hay
   **2 violaciones reales** sin detectar (`task-reply-thread.component.ts`,
   `admin-configuracion-web.component.ts`).
2. `facades.md` prohíbe `effect()` dentro de facades — hoy hay 0 violaciones: momento ideal
   para bloquearlo antes de que aparezca la primera.
3. ARCH-06 (`*ngIf`, `[ngClass]`…) solo corre sobre `.html` — los templates inline en `.ts`
   escapan a `npm run lint:arch`.
4. El Discovery Gate menciona `indices/PIPES.md` pero **no existe colector de pipes** en
   `indices-sync.js`: hay 3 pipes reales (`safe`, `relative-time`, `short-currency`) en
   `core/pipes/` y `shared/pipes/` invisibles para todos los índices.

**Hipótesis de valor:**
Cuatro reglas pasan de "documentadas" a "aplicadas automáticamente", cerrando la brecha entre
lo que el blueprint promete y lo que el linter realmente verifica.

---

## 2. User Stories

- **US1**: Como agente, quiero que `lint:arch` me bloquee si un componente importa un DTO,
  para no violar la tabla de capas de `models.md` sin darme cuenta.
- **US2**: Como agente, quiero que `lint:arch` me bloquee si escribo `effect()` en una facade,
  para respetar la regla de reactividad en el Smart Component.
- **US3**: Como agente, quiero que ARCH-06 también inspeccione templates inline, para que un
  `*ngIf` no pase el lint solo por estar dentro de un `.ts`.
- **US4**: Como agente, quiero un `PIPES.md` auto-sincronizado, para descubrir pipes existentes
  antes de crear duplicados.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 (ARCH-12 — DTO en componentes)**: Given un `*.component.ts` con
  `import ... from '.../models/dto/...'`, When corre `npm run lint:arch`, Then reporta error
  ARCH-12 con el fix "mapea el DTO a un modelo ui/ en la Facade".
- **AC2 (backlog ARCH-12 resuelto)**: Given las 2 violaciones existentes
  (`task-reply-thread`, `admin-configuracion-web`), When se cierra esta spec, Then ambas están
  corregidas (DTO → modelo `ui/` mapeado en su facade) y `lint:arch` queda verde.
- **AC3 (ARCH-13 — effect en facades)**: Given un `*.facade.ts` que contiene una llamada
  `effect(...)` (AST: CallExpression con identifier `effect`), When corre `lint:arch`,
  Then reporta error ARCH-13 apuntando a `facades.md`.
- **AC4 (ARCH-06 inline)**: Given un componente con `template:` inline que contiene `*ngIf`
  o `[ngClass]`, When corre `lint:arch`, Then dispara ARCH-06 igual que si fuera `.html`
  (reutilizando la técnica de `extractTemplateContent` de `indices-sync.js`).
- **AC5 (colector de pipes)**: Given los 3 pipes existentes, When corre `npm run indices:sync`,
  Then `indices/PIPES.md` lista nombre de pipe (`name:` del decorador), clase, pure/impure y
  archivo, entre marcadores AUTO-GENERATED.
- **AC6 (idempotencia)**: Given una corrida de `indices:sync` recién hecha, When corre de nuevo
  sin cambios en el código, Then PIPES.md no cambia y los pipes salen del cache mtime.

### Edge cases obligatorios

- **AC-E1**: Given un import de `models/dto/` dentro de un `.spec.ts`, Then NO dispara ARCH-12
  (los tests pueden fabricar DTOs).
- **AC-E2**: Given una facade que menciona `effect` en un comentario o string, Then NO dispara
  ARCH-13 (por eso AST y no regex).
- **AC-E3**: Given un pipe en carpeta no convencional (fuera de `core/pipes/`/`shared/pipes/`),
  Then el colector lo encuentra igual (barrido por sufijo `.pipe.ts` en `src/app/`).

---

## 4. Out of scope

- ❌ La whitelist derivada de `@theme` → **spec 0019**.
- ❌ El cross-reference de íconos Lucide → **spec 0020**.
- ❌ Cualquier cambio en `.claude/hooks/` (pre-write-guard) — esta spec solo toca
  `scripts/architect.js` e `scripts/indices-sync.js`.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- `walkAst`, `reportError/reportWarning` y el registro `RULES` en `architect.js`.
- Colectores con cache mtime + `injectGenerated` en `indices-sync.js`.
- `extractTemplateContent` (inline + templateUrl) en `indices-sync.js`.

### Capacidades nuevas requeridas
- Crear `indices/PIPES.md` con marcadores AUTO-GENERATED (archivo nuevo).
- ⚠️ **Constraint operativo:** `scripts/architect.js` está protegido por el File Protector.
  El humano debe aplicar el diff manualmente, levantar la protección durante la sesión, o
  autorizar explícitamente la escritura vía PowerShell (como el 2026-07-01).

---

## 6. Datos y modelo (preliminar)

No aplica — no toca persistencia.

---

## 7. UX y flujos (preliminar)

No aplica — tooling de consola. Salida sigue el formato existente de `lint:arch` e `indices:sync`.

---

## 8. Métricas de éxito post-launch

- `lint:arch` reporta 2 nuevas reglas en su resumen final (ARCH-12, ARCH-13).
- Cero imports de DTO en componentes y cero `effect()` en facades desde el merge en adelante.
- PIPES.md deja de ser un índice fantasma para el Discovery Gate.

---

## 9. Notas / decisiones abiertas

- [ ] ¿Los 2 fixes de ARCH-12 (AC2) van en esta spec o como fix-track aparte? (Propuesta: aquí,
  son pequeños y sin ellos el lint nace rojo.)

---

## Changelog

- 2026-07-01 — draft inicial por Akxlarre (redactado por Claude a partir del análisis AST de la sesión).
