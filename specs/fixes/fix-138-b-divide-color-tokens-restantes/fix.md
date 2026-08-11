# Fix: `divide-x`/`divide-y` sin color explícito caen a `currentColor` (archivos restantes)
> id: fix-138-b-divide-color-tokens-restantes
> refs: fix-136-b-cursos-container-query-divide-color (origen del hallazgo, root cause completa ahí)
> status: done
> closed: 2026-08-11
> created: 2026-08-11

## Root Cause

En Tailwind v4, las utilidades `divide-x`/`divide-y` sin sufijo de color explícito caen a
`currentColor` (el color de texto, generalmente negro/gris oscuro) en vez del token de borde
del design system (`--border-subtle`/`--border-muted`, rgba semitransparentes). El parche en
`src/tailwind.css:57` ("Fix: default color for 'border' class") solo registra `--color-border`
como color nombrado disponible (habilita `border-border`), pero no cambia el fallback de
`divide-x`/`divide-y` sola. Confirmado con `getComputedStyle`: separadores rotos mostraban
`rgb(9, 9, 11)` (negro pleno) en vez de `rgba(9, 9, 11, 0.06)` (token correcto).

Hallazgo original y primeros 2 archivos corregidos en `fix-136-b-cursos-container-query-divide-color`
(admin-contabilidad-cursos, vehicle-maintenances). Este fix cubre los 6 archivos restantes
detectados en la misma auditoría.

## ACs Afectados

Ninguno — fix autónomo de consistencia visual (design system), no ligado a una spec funcional.

## Cambio

Agregar `divide-{color}` explícito junto al `divide-x`/`divide-y` existente, usando el mismo
token que ya usa `border-{color}` en la misma zona del componente (`divide-border-subtle` en
todos los casos — es el token que ya usaban los `border-*` vecinos en cada archivo).

- **Archivo:** `src/app/features/admin/certificacion/drawers/enviar-masivo-drawer.component.ts:43`
- **Archivo:** `src/app/features/admin/certificacion/drawers/generar-pendientes-drawer.component.ts:41`
- **Archivo:** `src/app/features/admin/profesional-certificados/drawers/enviar-masivo-prof-drawer.component.ts:43`
- **Archivo:** `src/app/features/admin/profesional-certificados/drawers/generar-pendientes-prof-drawer.component.ts:49,72`
- **Archivo:** `src/app/features/alumno/clases/alumno-clases.component.ts:120,168,202,236`
- **Archivo:** `src/app/features/instructor/ficha/instructor-ficha.component.ts:345`

Cambio puramente de clase CSS (agregar `divide-border-subtle`), sin lógica — no requiere
`.spec.ts` nuevo (regla `testing-tdd.md`: solo aplica a lógica de negocio).

## Test de Regresión

No aplica test automatizado (cambio visual puro). Verificación:
- `npx tsc --noEmit` → sin errores ✓
- `npm run lint:arch` → exit 0, sin warnings nuevos atribuibles a este cambio ✓
- Verificación visual: el servidor de `ng serve` en `:4200` sirve el repo principal, no este
  worktree — un `ng serve` dedicado al worktree (puerto 4201) no llegó a compilar en un tiempo
  razonable en este entorno. Verificación alternativa vía CSSOM contra el bundle real ya
  compilado en `:4200` (que ya usa `divide-border-subtle` en 5 archivos del repo principal):
  confirmado que el navegador genera la regla
  `:where(.divide-border-subtle > :not(:last-child)) { border-color: var(--color-border-subtle) }`,
  exactamente scopeada igual que `:where(.divide-y > :not(:last-child))` (border-bottom-width).
  `--color-border-subtle` resuelve a `rgba(255,255,255,0.04)` (dark mode), no `currentColor`.
  Como los 9 cambios de este fix usan la clase `divide-border-subtle` ya existente y compilada
  (no una clase nueva), la generación de CSS es idéntica bit a bit a los usos ya verificados —
  no requiere recompilar el worktree para confirmar que la clase resuelve al token correcto.
