# Hotfix: Corrección de contraste WCAG AA en tokens de estado
> id: hotfix-001-b-contraste-wcag-tokens-estado
> status: done
> closed: 2026-05-24
> created: 2026-05-23

## Problema
Los tokens `--state-*` en light mode usan variantes -600 de Tailwind que no alcanzan 4.5:1 (WCAG AA) sobre sus fondos pastel. En dark mode los toasts muestran texto coloreado en lugar de blanco.

## Cambio
- **Archivo:** `src/styles/tokens/_variables.scss`
- **Qué cambia:** `--state-success/warning/error/info` pasan de -600 a -700 en `:root` (light mode)
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss`
- **Qué cambia:** agregar bloque `[data-mode='dark']` que sobreescribe los 4 `--p-toast-*-text-color` a `#ffffff`
