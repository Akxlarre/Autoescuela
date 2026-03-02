# Autoescuela — Koa Agent Blueprint v5.1

Tu stack: **Angular + Tailwind v4 + PrimeNG + Supabase + GSAP**.

## Sistema de Hooks Activo

Este proyecto tiene guardrails automáticos que se ejecutan sin intervención humana:

- **Discovery Gate** — NO puedes escribir código en `src/app/` sin antes leer al menos un archivo de `indices/`. Serás bloqueado automáticamente.
- **Architect Guard** — Cada Edit/Write es validado en tiempo real. Se bloquean: `*ngIf`, `@Input()`, colores hardcodeados, imports de Supabase en UI, `@angular/animations`, `@keyframes`.
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
- Supabase local: `npx supabase start`

## Flujo obligatorio (5 pasos)

1. **DESCUBRIR** — Lee `indices/COMPONENTS.md`, `indices/SERVICES.md`, `indices/DIRECTIVES.md`, `indices/STYLES.md`, `indices/DATABASE.md` antes de escribir código. **El Discovery Gate te bloqueará si no lo haces.**
2. **PLANIFICAR** — Define qué vas a tocar sin violar las reglas de arquitectura.
3. **EJECUTAR** — Escribe el código. Reutiliza siempre lo existente primero. Los hooks validarán cada escritura en tiempo real.
4. **VALIDAR** — Corre `npm run lint:arch` para una auditoría completa del proyecto.
5. **SINCRONIZAR** — Actualiza `indices/*.md` con los componentes/servicios creados. El Stop hook te lo recordará si lo olvidas.

## Reglas del proyecto

@.claude/rules/architecture.md
@.claude/rules/visual-system.md
@.claude/rules/testing-tdd.md
@.claude/rules/ai-readability.md

## Referencias

- Stack completo: @docs/TECH-STACK-RULES.md
- Brand & UI: @docs/BRAND_GUIDELINES.md
- Sistema de Hooks: @docs/HOOKS-SYSTEM.md
- Visión del producto: @docs/PRODUCT-VISION.md
- Guía de usuario: @docs/CLAUDE-USER-GUIDE.md
