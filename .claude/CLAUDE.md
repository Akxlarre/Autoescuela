# Autoescuela — Koa Agent Blueprint v5.1

Tu stack: **Angular + Tailwind v4 + PrimeNG + Supabase + GSAP**.

## Sistema de Hooks Activo

Este proyecto tiene guardrails automáticos que se ejecutan sin intervención humana:

- **Discovery Gate** — NO puedes escribir código en `src/app/` sin antes leer al menos un archivo de `indices/`. Serás bloqueado automáticamente.
- **Architect Guard** — Cada Edit/Write es validado en tiempo real. Se bloquean: `*ngIf`, `@Input()`, colores hardcodeados, imports de Supabase en UI, `@angular/animations`, `@keyframes`.
- **Spec Gate** — NO puedes escribir código de producción sin un track activo en `specs/.active` con `plan.md` aprobado. Paths exentos: `specs/`, `indices/`, `docs/`, tests, configs.
- **Plan Injector** — Al editar código de producción, inyecta automáticamente el `plan.md` del track activo como contexto.
- **AC Verifier** — Al terminar el turno, verifica que los Acceptance Criteria del track activo hayan sido cumplidos. Bloquea si quedan ACs abiertos.
- **File Protector** — No puedes modificar los archivos del sistema de hooks (`.claude/hooks/`, `settings.json`, `architect.js`).
- **Harness Gate** — Cada edición a `.claude/rules/`, `indices/ANTI-PATTERNS.md`, `indices/DOMAIN-GOTCHAS.md`, `CLAUDE.md` o `scripts/*.js` se valida contra el Generalization Gate: bloquea lecciones que citan un track (fix-/spec-/hotfix-NNN) sin criterio de aplicabilidad, snippets de despacho por keyword-matching, código ejecutable colado en un archivo de guía, o consejos sin mecanismo colados en un script. No aplica a `specs/**`, donde el track ID es el contenido legítimo. Skill asociado: `/harness-feedback`.
- **Bash Guard** — No puedes crear archivos `.ts/.html/.scss` via Bash. Usa Edit/Write.
- **Compact Recovery** — Si el contexto se compacta, se re-inyecta el mapa de los índices (qué hay y dónde), no su contenido: vuelve a leer con Read la sección que necesites.
- **Sync Check** — Al terminar de responder, se verifica si los índices necesitan actualización.
- **Prettier** — Cada archivo editado se formatea automáticamente.

> **Esta lista nombra solo lo que corre.** Regla: un hook se agrega acá cuando está conectado en
> `settings.json`, nunca antes. `npm run lint:arch` (ARCH-31) falla si un hook de la lista no
> tiene respaldo en `settings.json`, o si un archivo de `.claude/hooks/` no está conectado y no
> figura con su motivo en `scripts/lib/qa-guardrails.allowlist.json`. Hoy hay uno en ese caso:
> `context-enrichment-guard.js` (guard de día 0 para índices vacíos). No cuentes con él.

Detalle completo: @docs/HOOKS-SYSTEM.md

## Comandos del proyecto

- Dev: `ng serve`
- Build: `ng build`
- Lint: `ng lint`
- Lint arquitectónico: `npm run lint:arch`
- Lint arquitectónico estricto (el que corre el CI de pull requests): `npm run lint:arch:strict`
- Tests de los guardrails (`scripts/lib/*.test.mjs`): `npm run test:scripts`
- Consolidar una mejora en los trinquetes de QA (ARCH-33/34/35): `node scripts/check-qa-guardrails.mjs --update-qa-baseline`
- Tests: `npm run test:ci` (sin watch, para auto-validación)
- Tests cobertura: `npm run test:coverage`
- Supabase local: `npx supabase start`

## Sistema SDD (Spec-Driven Development)

**Todo código de producción requiere un track activo.** El Spec Gate te bloqueará si intentas editar `src/` sin uno.

### Los 3 tracks

| Track | Cuándo | ID format | Contrato |
|-------|--------|-----------|---------|
| **Spec** | Feature nueva | `NNNN-X-slug` | `specs/specs/<id>/spec.md` con ACs |
| **Fix** | Bug con ACs afectados | `fix-NNN-X-slug` | `specs/fixes/<id>/fix.md` |
| **Hotfix** | Fix urgente simple | `hotfix-NNN-X-slug` | `specs/hotfixes/<id>/hotfix.md` — auto-cerrado por hook |

`X` = código de autor de una letra (ver `specs/AUTHORS.md`). `specs/` se commitea al
repo — cada autor numera de forma independiente por track (el contador de Benjamín no
afecta el de Matías). **Antes de crear un track nuevo, lee `specs/AUTHORS.md`** para
obtener tu código y calcular el siguiente número correcto para TU autor en ESE track.

### Slash commands globales

- `/spec-new` → crea `specs/specs/<id>/spec.md`
- `/spec-activate <id>` → activa el track (escribe en `specs/.active`)
- `/spec-plan` → genera `specs/specs/<id>/plan.md` desde la spec
- `/spec-tasks` → desglosa el plan en tareas atómicas
- `/spec-verify` → muestra ACs abiertos vs cumplidos
- `/fix-new <desc>` → crea `specs/fixes/<id>/fix.md`
- `/fix-close` → cierra el track tras verificar test de regresión

### Flujo Feature nueva

```
/spec-new → editar spec.md (ACs) → /spec-activate <id> → /spec-plan
→ aprobar plan.md → implementar → npm run test:ci → AC Verifier pasa → done
```

### Flujo Bug Fix

```
/fix-new "desc" → /spec-activate fix-NNN-X → corregir → npm run test:ci → /fix-close
```

**Paths exentos del gate:** `specs/`, `indices/`, `docs/`, `.claude/`, `scripts/`, tests, configs.

## Capacidades del Agente

- **QA Visual activo:** El agente tiene acceso a Playwright MCP (`mcp__playwright__*`). Puede navegar la app en el navegador real, tomar capturas, leer la consola del browser y ejecutar scripts de auditoría del DOM. Ya **no es ciego a la UI renderizada**.
- **Protocolo visual:** Usar el skill `/verify` después de implementar cualquier componente o fix con cambios de UI. Definición completa: `.claude/skills/verify/SKILL.md`.

## Flujo obligatorio y Estado Cero (6 pasos)

0. **CONTEXT SEEDING (Día 0)** — Si es un proyecto/módulo nuevo, DEBES establecer el Lenguaje Ubicuo (`indices/DOMAIN_DICTIONARY.md`) y el modelo de datos (`indices/DATABASE.md`) ANTES de codificar. Si te falta contexto, pídeselo al humano: ningún hook lo exige, es responsabilidad tuya.
1. **DESCUBRIR** — Lee `indices/COMPONENTS.md`, `indices/SERVICES.md`, `indices/DIRECTIVES.md`, `indices/STYLES.md` antes de escribir código. Siempre que vayas a construir algo nuevo (pantalla, drawer, facade, función, migración), lee también `indices/PATTERNS.md` para partir de la implementación de referencia y `indices/ANTI-PATTERNS.md` para no repetir un atajo que ya costó un fix. Si vas a tocar lógica de negocio, RLS, o una query nueva, lee también `indices/DOMAIN-GOTCHAS.md`. **El Discovery Gate te bloqueará si no lo haces.**
2. **PLANIFICAR** — Define qué vas a tocar sin violar las reglas de arquitectura.
3. **EJECUTAR** — Escribe el código. Reutiliza siempre lo existente primero. Los hooks validarán cada escritura en tiempo real. **Si hay lógica nueva, escribe el `.spec.ts` primero (TDD).**
4. **VALIDAR** — Corre `npm run lint:arch` para auditoría arquitectónica y `npm run test:ci` para tests. **Para cambios de UI, ejecutar también `/verify` (Playwright) para confirmar renderizado real en el navegador.**
5. **SINCRONIZAR** — Actualiza `indices/*.md` con los componentes/servicios creados. El Stop hook te lo recordará si lo olvidas.

## Reglas del proyecto

@.claude/rules/architecture.md
@.claude/rules/models.md
@.claude/rules/facades.md
@.claude/rules/visual-system.md
@.claude/rules/testing-tdd.md
@.claude/rules/notifications.md
@.claude/rules/swr-pattern.md
@.claude/rules/ai-readability.md
@.claude/rules/dates.md

## Referencias

- Stack completo: @docs/TECH-STACK-RULES.md
- Brand & UI: @docs/BRAND_GUIDELINES.md
- Sistema de Hooks: @docs/HOOKS-SYSTEM.md
- Setup de MCP servers: @docs/MCP-SETUP.md
- Visión del producto: @docs/PRODUCT-VISION.md
- Guía de usuario: @docs/CLAUDE-USER-GUIDE.md
