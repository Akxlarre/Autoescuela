# Autoescuela — Koa Agent Blueprint v5.1

Tu stack: **Angular + Tailwind v4 + PrimeNG + Supabase + GSAP**.

## Sistema de Hooks Activo

Este proyecto tiene guardrails automáticos que se ejecutan sin intervención humana:

- **Context Guard** — Verifica que exista contexto de negocio. Si `indices/DOMAIN_DICTIONARY.md` o `DATABASE.md` están vacíos/incompletos, te bloqueará para que pidas el brief al humano antes de programar a ciegas.
- **Discovery Gate** — NO puedes escribir código en `src/app/` sin antes leer al menos un archivo de `indices/`. Serás bloqueado automáticamente.
- **Architect Guard** — Cada Edit/Write es validado en tiempo real. Se bloquean: `*ngIf`, `@Input()`, colores hardcodeados, imports de Supabase en UI, `@angular/animations`, `@keyframes`.
- **Spec Gate** — NO puedes escribir código de producción sin un track activo en `specs/.active` con `plan.md` aprobado. Paths exentos: `specs/`, `indices/`, `docs/`, tests, configs.
- **Plan Injector** — Al editar código de producción, inyecta automáticamente el `plan.md` del track activo como contexto.
- **AC Verifier** — Al terminar el turno, verifica que los Acceptance Criteria del track activo hayan sido cumplidos. Bloquea si quedan ACs abiertos.
- **File Protector** — No puedes modificar los archivos del sistema de hooks (`.claude/hooks/`, `settings.json`, `architect.js`).
- **Bash Guard** — No puedes crear archivos `.ts/.html/.scss` via Bash. Usa Edit/Write.
- **Compact Recovery** — Si el contexto se compacta, los índices se re-inyectan automáticamente.
- **Sync Check** — Al terminar de responder, se verifica si los índices necesitan actualización.
- **Prettier** — Cada archivo editado se formatea automáticamente.

Detalle completo: @docs/HOOKS-SYSTEM.md

## Comandos del proyecto

- Dev: `ng serve`
- Build: `ng build`
- Lint: `ng lint`
- Lint arquitectónico: `npm run lint:arch`
- Tests: `npm run test:ci` (sin watch, para auto-validación)
- Tests cobertura: `npm run test:coverage`
- Supabase local: `npx supabase start`

## Sistema SDD (Spec-Driven Development)

**Todo código de producción requiere un track activo.** El Spec Gate te bloqueará si intentas editar `src/` sin uno.

### Los 3 tracks

| Track | Cuándo | ID format | Contrato |
|-------|--------|-----------|---------|
| **Spec** | Feature nueva | `NNNN-slug` | `specs/<id>/spec.md` con ACs |
| **Fix** | Bug con ACs afectados | `fix-NNN-slug` | `specs/<id>/fix.md` |
| **Hotfix** | Fix urgente simple | `hotfix-NNN-slug` | Auto-cerrado por hook |

### Slash commands globales

- `/spec-new` → crea `specs/<id>/spec.md`
- `/spec-activate <id>` → activa el track (escribe en `specs/.active`)
- `/spec-plan` → genera `specs/<id>/plan.md` desde la spec
- `/spec-tasks` → desglosa el plan en tareas atómicas
- `/spec-verify` → muestra ACs abiertos vs cumplidos
- `/fix-new <desc>` → crea track fix con `fix.md`
- `/fix-close` → cierra el track tras verificar test de regresión

### Flujo Feature nueva

```
/spec-new → editar spec.md (ACs) → /spec-activate <id> → /spec-plan
→ aprobar plan.md → implementar → npm run test:ci → AC Verifier pasa → done
```

### Flujo Bug Fix

```
/fix-new "desc" → /spec-activate fix-NNN → corregir → npm run test:ci → /fix-close
```

**Paths exentos del gate:** `specs/`, `indices/`, `docs/`, `.claude/`, `scripts/`, tests, configs.

## Capacidades del Agente

- **QA Visual activo:** El agente tiene acceso a Playwright MCP (`mcp__playwright__*`). Puede navegar la app en el navegador real, tomar capturas, leer la consola del browser y ejecutar scripts de auditoría del DOM. Ya **no es ciego a la UI renderizada**.
- **Protocolo visual:** Usar el skill `/verify` después de implementar cualquier componente o fix con cambios de UI. Definición completa: `.claude/skills/verify/SKILL.md`.

## Flujo obligatorio y Estado Cero (6 pasos)

0. **CONTEXT SEEDING (Día 0)** — Si es un proyecto/módulo nuevo, DEBES establecer el Lenguaje Ubicuo (`indices/DOMAIN_DICTIONARY.md`) y el modelo de datos (`indices/DATABASE.md`) ANTES de codificar. Si te falta contexto, pídeselo al humano (el Context Guard te obligará a hacerlo si lo olvidas).
1. **DESCUBRIR** — Lee `indices/COMPONENTS.md`, `indices/SERVICES.md`, `indices/DIRECTIVES.md`, `indices/STYLES.md` antes de escribir código. **El Discovery Gate te bloqueará si no lo haces.**
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

## Referencias

- Stack completo: @docs/TECH-STACK-RULES.md
- Brand & UI: @docs/BRAND_GUIDELINES.md
- Sistema de Hooks: @docs/HOOKS-SYSTEM.md
- Visión del producto: @docs/PRODUCT-VISION.md
- Guía de usuario: @docs/CLAUDE-USER-GUIDE.md
