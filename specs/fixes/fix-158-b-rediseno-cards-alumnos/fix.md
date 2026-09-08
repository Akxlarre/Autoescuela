# Fix: Rediseño de las cards de alumnos (vista tarjetas dual-viewport)
> id: fix-158-b-rediseno-cards-alumnos
> refs: — (independiente, mejora visual sobre UI ya en producción)
> status: done
> closed: 2026-09-07
> created: 2026-09-07

## Root Cause
La card de alumno en la vista comprimida/móvil (`alumnos-list-content.component.ts` y
duplicada en `alumnos-profesional-list-content`, `ex-alumnos-content`,
`ex-alumnos-profesional-content`) se armó con Tailwind ad-hoc
(`bg-base border border-border-subtle rounded-xl shadow-sm`) en vez de la clase semántica
canónica `.card`, y con labels `text-2xs text-text-muted` recompuestos a mano en vez de
`.micro-label` — el mismo patrón que causó las 221 instancias ad-hoc de overline
documentadas en `visual-system.md`. El resultado es una card visualmente plana que no
usa el vocabulario tipográfico ni de superficie del resto de la app, y con el mismo bloque
de markup duplicado 4 veces (~170 líneas repetidas) en vez de un componente reutilizable.

## ACs Afectados
- Ninguno — fix autónomo, no altera comportamiento ni ACs de specs previas (misma data,
  mismas acciones, solo tratamiento visual).

## Cambio
- **Archivo nuevo:** `src/app/core/utils/alumno-status.utils.ts` — extrae
  `getExpedienteStatus`/`getAlumnoStatusSeverity` (antes duplicadas inline en
  `alumnos-list-content` y `alumnos-profesional-list-content`) a funciones puras
  (Núcleo Funcional, `architecture.md`), + `getAlumnoStatusBadgeVariant` para unificar
  el pill de Estado sobre `app-badge` en vez de mezclar `p-tag`/`app-badge` en la misma
  card. Con tests (`alumno-status.utils.spec.ts`).
- **Archivo nuevo:** `src/app/shared/components/alumno-card/alumno-card.component.ts` —
  Dumb component (`input()`/`output()`, sin Facades) que reemplaza el bloque de card
  duplicado. Redesign: usa `.card` en vez de composición Tailwind ad-hoc, `.micro-label`
  en vez de `text-2xs text-text-muted` a mano, jerarquía visual reforzada (avatar con
  color determinístico por iniciales, header/body/footer con separación consistente),
  loading resuelto internamente vía `@if (loading())` + `<app-skeleton-block>` (Single-
  Component Skeleton, sin duplicar el bloque skeleton aparte).
- **Archivo:** `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
  — Qué cambia: reemplaza el bloque de card inline (real + skeleton) por
  `<app-alumno-card>`.
- (Rollout a `alumnos-profesional-list-content`, `ex-alumnos-content`,
  `ex-alumnos-profesional-content` en un fix de seguimiento si el diseño se valida.)

## Test de Regresión
- Verificación visual manual en `localhost:4210` (dual-viewport, claro/oscuro) — no hay
  lógica de negocio nueva que testear con Vitest; `npm run lint:arch` debe seguir en verde.
