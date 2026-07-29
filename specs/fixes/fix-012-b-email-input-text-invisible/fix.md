# Fix: Email input — texto invisible en flujo público
> id: fix-012-b-email-input-text-invisible
> refs: 0009-rediseno-ux-flujo-inscripcion-online-publico
> status: done
> closed: 2026-06-09
> created: 2026-06-09

## Root Cause

`email-input.component.html` no declara color de texto explícito en el `<input>`.
En el wizard público, el template de `public-wizard-shell` aplica `.surface-hero` (color
de texto blanco) que se hereda en cascade. El input tiene `bg-surface` (fondo claro) pero
hereda `color: white` del ancestro, haciendo el texto invisible al escribir.

## ACs Afectados

- Ninguno — fix autónomo de accesibilidad visual.

## Cambio

- **Archivo:** `src/app/shared/components/email-input/email-input.component.html`
- **Qué cambia:** Agregar `style="color: var(--text-primary);"` inline al elemento `<input>`
  para forzar el color de texto independientemente del contexto heredado.

## Test de Regresión

- Visual: escribir en el campo Email del paso "Datos personales" del flujo público
  → el texto debe ser legible (oscuro sobre fondo claro).
- No hay test unitario aplicable (componente dumb sin lógica, issue de CSS puro).
