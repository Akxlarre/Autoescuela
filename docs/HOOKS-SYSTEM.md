# Sistema de Hooks — Guardrails Automáticos (Koa Blueprint v5.0)

> Este documento explica cómo el sistema de hooks convierte las reglas arquitectónicas
> en **constraints** reales que Claude no puede ignorar.

## El Problema que Resuelve

Sin hooks, las reglas del proyecto son un **contrato social**: Claude las lee en CLAUDE.md
pero puede ignorarlas. El humano tiene que recordarle en cada prompt que siga las reglas.

Con hooks, las reglas son **constraints del sistema**: Claude es bloqueado automáticamente
si intenta violar una regla, sin intervención humana.

## Arquitectura del Sistema

```
Claude recibe un prompt del humano
    │
    ├─ Intenta Read("indices/COMPONENTS.md")
    │   └─ PostToolUse → discovery-tracker.js → crea flag de sesión ✓
    │
    ├─ Intenta Edit("src/app/features/dashboard.component.ts")
    │   └─ PreToolUse → pre-write-guard.js
    │       ├─ ¿Flag de discovery existe? → NO → BLOQUEADO "Lee los índices primero"
    │       ├─ ¿Flag existe? → SÍ → continúa
    │       ├─ ¿Tiene *ngIf? → SÍ → BLOQUEADO "Usa @if"
    │       ├─ ¿Tiene OnPush? → NO → BLOQUEADO "Agrega OnPush"
    │       └─ Todo OK → PERMITIDO + inyecta reglas relevantes como contexto
    │                    (architecture.md, visual-system.md, database.md, skills)
    │
    ├─ PostToolUse → post-edit.js → Prettier formatea automáticamente
    │
    ├─ Intenta Bash("echo > src/app/nuevo.ts")
    │   └─ PreToolUse → bash-guard.js → BLOQUEADO "Usa Edit/Write"
    │
    ├─ Claude termina de responder
    │   └─ Stop → prompt hook → "¿Actualizaste los índices?" → si no → sigue trabajando
    │
    └─ Contexto se compacta
        └─ SessionStart (compact) → compact-recovery.js → re-inyecta índices
```

## Hooks Activos

### 1. Pre-Write Guard (`pre-write-guard.js`)
- **Evento**: PreToolUse
- **Matcher**: `Edit|Write|MultiEdit`
- **Función**: Cuádruple capa de protección antes de cada escritura

| Capa | Qué hace | Resultado si falla |
|------|----------|--------------------|
| File Protection | Bloquea edits a `.claude/hooks/`, `settings.json`, `architect.js` | BLOQUEADO: archivo protegido |
| Discovery Gate | Verifica que se leyeron los índices | BLOQUEADO: lee indices/ primero |
| Architect Guard | Valida reglas en el contenido nuevo | BLOQUEADO: violación específica |
| Context Injection | Inyecta rules y skills relevantes según tipo de archivo | Contexto adicional para Claude |

**Reglas validadas por el Architect Guard:**

| Regla | Archivos | Qué detecta |
|-------|----------|-------------|
| No `*ngIf` / `*ngFor` | .ts, .html | Directivas deprecadas de Angular |
| No `[ngClass]` / `[ngStyle]` | .ts, .html | Bindings deprecados |
| No `@Input()` / `@Output()` | .ts | Decoradores legacy (usar signal API) |
| No `@supabase/supabase-js` | .ts (UI) | Import directo en capa de presentación |
| No `@angular/animations` | .ts | Usar GSAP en vez de animations |
| OnPush obligatorio | .component.ts | Solo en Write (archivo completo) |
| No colores hardcodeados | .ts, .html, .scss | `text-red-500`, `bg-blue-200`, etc. |
| No `@keyframes` | .scss, .css | Usar GSAP para animaciones |
| No Facade en Dumb comp. | shared/.component.ts | Dumb components no inyectan Facades |
| Naming de migraciones | supabase/migrations/ | Formato: YYYYMMDDHHMMSS_dominio_tipo_desc.sql |
| RLS obligatorio | .sql con CREATE TABLE | Toda tabla nueva debe tener RLS activado |

**Contexto inyectado por tipo de archivo (Context Injection):**

Cuando una escritura pasa todas las validaciones, el hook inyecta reglas relevantes
directamente en el contexto de Claude vía `additionalContext`. Esto hace que Claude
tenga las rules y skills presentes **sin tener que leerlas manualmente**.

| Archivo editado | Rules inyectadas | Skills referenciadas |
|----------------|-----------------|---------------------|
| `features/*.component.ts` | architecture.md (Smart), visual-system.md (tokens, bento, GSAP) | angular-component, design-system, angular-signals |
| `shared/*.component.ts` | architecture.md (Dumb: solo input/output), visual-system.md (cards, radios) | angular-component, design-system |
| `layout/*.component.ts` | architecture.md (Layout), visual-system.md (dark mode) | — |
| `core/services/*.facade.ts` | architecture.md (Facade pattern, toSignal) | angular-signals |
| `core/services/*.service.ts` | architecture.md (Core service, no UI injection) | angular-signals |
| `core/directives/*.ts` | architecture.md (directivas) | angular-component |
| `supabase/migrations/*.sql` | database.md (naming, RLS, idempotencia) | supabase-data-model |
| `*.html` (templates) | architecture.md (@if/@for), visual-system.md (tokens, bento), ai-readability.md (data-llm-*) | angular-primeng |
| `*.scss` / `*.css` | visual-system.md (tokens, layouts, motion) | design-system |

### 2. Discovery Tracker (`discovery-tracker.js`)
- **Evento**: PostToolUse
- **Matcher**: `Read`
- **Función**: Cuando Claude lee un archivo de `indices/`, crea un flag temporal
  que desbloquea el Discovery Gate para el resto de la sesión.

### 3. Bash Guard (`bash-guard.js`)
- **Evento**: PreToolUse
- **Matcher**: `Bash`
- **Función**: Bloquea dos patrones peligrosos:
  - Creación de archivos `.ts/.html/.scss/.sql` via Bash (debe usar Edit/Write)
  - Operaciones destructivas (`rm -rf`) sobre directorios críticos

### 4. Compact Recovery (`compact-recovery.js`)
- **Evento**: SessionStart
- **Matcher**: `compact`
- **Función**: Cuando Claude Code compacta la conversación, re-inyecta el contenido
  de todos los archivos `indices/*.md` al contexto. Claude nunca pierde la memoria
  de lo que existe en el proyecto.

### 5. Sync Check (prompt hook)
- **Evento**: Stop
- **Matcher**: ninguno (se ejecuta en cada respuesta)
- **Tipo**: `prompt` (evaluado por modelo Haiku)
- **Función**: Cuando Claude termina de responder, Haiku evalúa si se crearon
  componentes/servicios nuevos sin actualizar los índices. Si detecta drift,
  fuerza a Claude a continuar y actualizar los índices.

### 6. Prettier (post-edit.js)
- **Evento**: PostToolUse
- **Matcher**: `Edit|Write|MultiEdit`
- **Función**: Formatea automáticamente con Prettier cada archivo editado.

## Linter Arquitectónico Completo (`architect.js` v2.0)

El linter AST se ejecuta con `npm run lint:arch` y valida **8 reglas**:

| # | Regla | Método |
|---|-------|--------|
| 1 | Sin @supabase/supabase-js en UI | AST (import declaration) |
| 2 | Sin inject(*Service) en componentes vista | AST (call expression) |
| 3 | TDD: .spec.ts para facades/services en core/ | File existence check |
| 4 | OnPush en todos los componentes | AST (decorator) + text search |
| 5 | Sin @angular/animations | AST (import declaration) |
| 6 | Sin *ngIf/*ngFor/[ngClass]/[ngStyle] | Regex en .html |
| 7 | Sin @keyframes en SCSS | Regex en .scss/.css |
| 8 | Sin colores Tailwind hardcodeados | Regex en .ts/.html |

## Diferencia entre Hooks y Linter

| | Pre-Write Guard (Hook) | architect.js (Linter) |
|---|---|---|
| **Cuándo corre** | En cada Edit/Write individual | Bajo demanda (`npm run lint:arch`) |
| **Qué analiza** | Solo el contenido nuevo (diff) | Todo el proyecto completo |
| **Profundidad** | Regex rápido | AST completo de TypeScript |
| **Puede bloquear** | Sí (exit 2) | Sí (exit 1), pero post-hoc |
| **Detecta OnPush faltante** | Solo en Write (archivo nuevo) | Siempre (recorre todos los .component.ts) |

Juntos forman un sistema de **defensa en profundidad**: el hook atrapa violaciones
en tiempo real, el linter las atrapa en auditoría completa.

## Personalización

### Desactivar un hook específico

Edita `.claude/settings.json` y elimina el bloque del hook que quieres desactivar.

### Desactivar todos los hooks temporalmente

En Claude Code, ejecuta `/hooks` y usa el toggle al final del menú.

### Agregar reglas nuevas al Architect Guard

Edita `.claude/hooks/pre-write-guard.js` y agrega checks en la sección 3 (Architect Guard).
Para reglas que requieren AST, agrégalas en `scripts/architect.js`.

### Agregar archivos protegidos

Edita el array `protectedPatterns` en `pre-write-guard.js`.

## Troubleshooting

### "Discovery Gate me bloquea pero ya leí los índices"
El flag es por sesión. Si reiniciaste Claude Code, debes leer un archivo
de `indices/` de nuevo. Cualquier archivo de esa carpeta sirve.

### "El hook falla con error de JSON parsing"
Verifica que tu `~/.zshrc` o `~/.bashrc` no imprima texto en shells no-interactivas.
Envuelve los `echo` en `if [[ $- == *i* ]]; then ... fi`.

### "Quiero editar un archivo protegido"
Los archivos del sistema de hooks están protegidos contra edición por Claude.
Edítalos manualmente en tu editor de texto.
