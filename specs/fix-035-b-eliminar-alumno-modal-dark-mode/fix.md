# Fix: eliminar-alumno-modal-dark-mode
> id: fix-035-b-eliminar-alumno-modal-dark-mode
> refs: —
> status: done
> closed: 2026-07-07
> created: 2026-07-07

## Root Cause
La card de `EliminarAlumnoModalComponent` (`src/app/shared/components/eliminar-alumno-modal/
eliminar-alumno-modal.component.ts:78`) usa `bg-white` hardcodeado en vez de un token del
design system. En modo claro pasa desapercibido porque `#ffffff` coincide con
`--bg-surface` claro, pero en modo oscuro **no cambia** — la card sigue siendo blanco puro
mientras el resto del componente sí usa tokens dark-aware (`text-text-primary`,
`bg-elevated`, `btn-neutral`, etc.) que en `data-mode="dark"` resuelven a colores pensados
para fondo oscuro.

Medido en runtime con `data-mode="dark"`:
- Fondo de la card: `rgb(255,255,255)` (hardcodeado, no cambia)
- `text-text-primary` (título/cuerpo): `#f4f4f5` (mismo valor que el token real `--text-primary`
  en dark)
- Contraste resultante: ~1.05:1 (WCAG exige ≥4.5:1) → título y párrafo de advertencia
  prácticamente invisibles; el chip `bg-elevated` y el botón `.btn-neutral` quedan como
  parches oscuros flotando sobre una card blanca.

Segundo hallazgo relacionado (mismo componente, misma causa raíz de "color arbitrario en vez
de token"): el backdrop usa `bg-black/[0.55]` en lugar del token `--overlay-backdrop` que ya
usan los overlays de `AppShellComponent` (`bg-(--overlay-backdrop)`), el cual sí es
dark-mode-aware (`rgba(9,9,11,.4)` en claro / `rgba(0,0,0,.7)` en oscuro).

## ACs Afectados
Ninguno — fix autónomo (bug visual de canon, detectado por el usuario al cambiar a modo
oscuro).

- AC-1: la card del modal usa `bg-surface` (token) en vez de `bg-white`; en `data-mode="dark"`
  el contraste de `text-text-primary` sobre el fondo de la card cumple WCAG AA (≥4.5:1).
- AC-2: el backdrop usa `bg-(--overlay-backdrop)` en vez de `bg-black/[0.55]`.

## Cambio
- **Archivo:** `src/app/shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component.ts`
- **Qué cambia:** `bg-white` → `bg-surface` en la card (línea ~78); `bg-black/[0.55]` →
  `bg-(--overlay-backdrop)` en el backdrop (línea ~69).

## Test de Regresión
- Verificación visual (Playwright): abrir el modal en `/app/admin/alumnos` con
  `data-mode="dark"` activo y confirmar que el título, el cuerpo y el chip `borrarlo` son
  legibles (contraste ≥4.5:1) contra el fondo de la card. Repetir en modo claro para
  confirmar que no hay regresión visual.
- No aplica test unitario — es una clase de estilo, sin lógica.
