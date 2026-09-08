# Fix: Rollout del rediseño de cards a Base Alumnos Profesional y Ex-Alumnos (B + Profesional)
> id: fix-159-b-rollout-cards-alumnos-profesional-y-ex-alumnos
> refs: fix-158-b-rediseno-cards-alumnos
> status: done
> closed: 2026-09-07
> created: 2026-09-07

## Root Cause
fix-158-b resolvió el mismo problema (card ad-hoc + `p-tag`/`app-badge` mezclados +
`text-2xs text-text-muted` a mano) solo en `alumnos-list-content` (Base Alumnos B) y
dejó documentado que el rollout a los otros 3 lugares con el mismo bloque duplicado
sería un fix de seguimiento una vez validado el diseño con el owner — ya validado en
esta sesión. Los 3 lugares restantes:
- `alumnos-profesional-list-content` (modelo `AlumnoProfesionalTableRow`)
- `ex-alumnos-content` (modelo `EgresadoTableRow`, Ex-Alumnos B)
- `ex-alumnos-profesional-content` (modelo `EgresadoTableRow`, Ex-Alumnos Profesional —
  mismo modelo que el anterior, así que comparten UN solo componente de card)

`ex-alumnos-content` además tiene su propio caso de badge ad-hoc (`.inas-badge`, CSS
custom con `[data-licencia*='B']`) en vez de `app-badge` — mismo antipatrón, un lugar más.

## ACs Afectados
- Ninguno — fix autónomo, no altera comportamiento ni ACs de specs previas (misma data,
  mismas acciones, solo tratamiento visual). Preserva diferencias reales de copy/query
  params entre Ex-Alumnos B y Profesional vía inputs (no las borra ni las unifica de más).

## Cambio
- **Archivo nuevo:** `src/app/core/utils/alumno-profesional-status.utils.ts` — extrae
  `getSemaforo`/`moduloPct` (antes inline en `alumnos-profesional-list-content`) a
  funciones puras + `getSemaforoBadgeVariant`. Reutiliza `getAlumnoStatusBadgeVariant`
  de `alumno-status.utils.ts` (mismo enum `AlumnoStatus`). Con tests.
- **Archivo nuevo:** `src/app/core/utils/egresado-status.utils.ts` — `getEgresadoAccountStatus(saldoPendiente)`
  → label + `BadgeVariant` ("Debe $X" / "Al día"), extraído del `@if/@else` inline
  duplicado en `ex-alumnos-content` y `ex-alumnos-profesional-content`. Con tests.
- **Archivo nuevo:** `src/app/shared/components/alumno-profesional-card/alumno-profesional-card.component.ts`
  — Dumb, mismo lenguaje visual que `app-alumno-card` (fix-158-b): `.card`,
  `.micro-label`, header en dos filas, `app-badge` para estado/promoción/convalidación/
  semáforo. Cuerpo distinto: Promoción, Asistencia (semáforo), Progreso de módulos
  (barra + n/total), Saldo.
- **Archivo nuevo:** `src/app/shared/components/egresado-card/egresado-card.component.ts`
  — Dumb, compartido por Ex-Alumnos B y Profesional (mismo modelo `EgresadoTableRow`).
  Inputs opcionales `nroLabel` ('Nº Exp.' default / 'Nº Mat.') y `viewQueryParams` para
  preservar las diferencias reales de copy/routing entre ambos consumidores sin
  fusionarlas. `app-badge` reemplaza el `.inas-badge` custom CSS y el `p-tag`.
- **Archivos:** `alumnos-profesional-list-content.component.ts`, `ex-alumnos-content.component.ts`,
  `ex-alumnos-profesional-content.component.ts` — reemplazan su bloque de card inline
  (real + skeleton donde exista) por el componente correspondiente.

## Test de Regresión
- Tests unitarios de los 2 utils nuevos (`npm run test:ci`).
- Verificación visual manual en `localhost:4210` para los 3 listados (dual-viewport,
  claro/oscuro, ancho angosto ~375px sin overlap — la lección de fix-158-b).
- `npm run lint:arch` debe seguir en verde.
