# Fix: El nombre del egresado se muestra como texto en la confirmación de re-matricular
> id: fix-284-m-nombre-del-egresado-como-texto-en-re-matricular
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
El modal de confirmación pinta el mensaje con `[innerHTML]` (`app-shell.component.ts`) para que
quien lo llama pueda usar negrita. Las cuatro pantallas de Ex-Alumnos arman ese mensaje metiendo
el nombre del egresado tal cual dentro de `<strong>…</strong>`: un nombre con `<`, `>` o `&` se
interpreta como HTML. Angular quita scripts y eventos, pero las etiquetas se aplican y el texto se
ve distinto de como está guardado. Es B35 de la 2ª pasada de `fix-264-m` (`024b` Z06).

## ACs Afectados
- `024b` Z06: un nombre con `<`, `>` o `&` se ve tal cual en la confirmación de re-matricular, en
  Ex-Alumnos B y Ex-Alumnos Profesional (admin y secretaria).

## Cambio
- **Archivo:** `src/app/core/utils/html.utils.ts` (nuevo) — `escapeHtml()`: convierte `& < > " '`
  en entidades para insertar texto dentro de un mensaje HTML.
- **Archivo:** `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`,
  `features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts`,
  `features/admin/ex-alumnos-profesional/admin-ex-alumnos-profesional.component.ts`,
  `features/secretaria/ex-alumnos-profesional/secretaria-ex-alumnos-profesional.component.ts` —
  el nombre pasa por `escapeHtml()` antes de entrar al mensaje.

## Test de Regresión
- `src/app/core/utils/html.utils.spec.ts > escapeHtml` ✓ (5 tests)
- `e2e/alumnos-b-ficha.spec.ts > Z06 (fix-284-m)` sin la marca `knownBug` ✓
