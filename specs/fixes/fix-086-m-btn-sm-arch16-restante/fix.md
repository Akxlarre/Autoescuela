# Fix: Modificador btn-sm + resolver los 3 archivos deferidos de ARCH-16
> id: fix-086-m-btn-sm-arch16-restante
> refs: ASG-b-008, fix-054-b-arch16-ratchet-btn-utilities
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
[Heredado de ASG-b-008, a confirmar]: El linter `lint:arch` (regla ARCH-16) detectó que 3
archivos (`asistencia-clase-b-content.component.ts`, `certificacion-clase-b-content.component.ts`,
`certificacion-profesional-content.component.ts`) montan utilities de tamaño de Tailwind
directamente sobre clases `btn-*`, lo cual está prohibido por el Design System. El patrón está
replicado en ~120 instancias en todo el repo (backlog ya documentado en
`docs/BACKLOG-DEUDA-TECNICA.md`, línea 86-88). La causa raíz es que el DS no tenía un
modificador de tamaño compacto — la única forma de conseguir un botón chico era "mutilando"
la utilidad base (`text-xs`, `px-*`, `py-*`, `rounded-*` sueltos). `fix-054-b` ya resolvió los
otros 3 archivos "limpios" de la misma regresión y deferió estos 3 explícitamente a la espera
de esta decisión de diseño.

## ACs Afectados
Ninguno — fix autónomo de deuda técnica (no corrige un AC de spec).

## Cambio
- **Archivo:** `src/tailwind.css` — nuevo `@utility btn-sm` (componible con cualquier `btn-*`
  base, sin variantes por tipo). Tamaño elegido: `padding: 0.375rem 0.75rem; gap: 0.375rem;
  font-size: var(--text-xs)` — el patrón compacto ya mayoritario en el repo (`px-3 py-1.5
  text-xs gap-1.5`, 10/44 instancias en los propios archivos deferidos).
- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  — 10 instancias migradas a `btn-sm` (o utility redundante eliminada donde ya coincidía con
  el tamaño base).
- **Archivo:** `src/app/shared/components/certificacion-clase-b-content/certificacion-clase-b-content.component.ts`
  — 17 instancias migradas.
- **Archivo:** `src/app/shared/components/certificacion-profesional-content/certificacion-profesional-content.component.ts`
  — 17 instancias migradas (componente hermano de Clase B, mismo patrón).

## Test de Regresión
- `npm run lint:arch` → ARCH-16 sin regresiones en los 3 archivos (baseline re-calculado a 0
  para estos 3 vía `--update-ds-baseline`).
- `npm run test:ci` → 100% verde, sin cambios de lógica (solo clases CSS).
