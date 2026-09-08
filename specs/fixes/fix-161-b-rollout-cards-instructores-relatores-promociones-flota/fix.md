# Fix: Rollout de cards a Instructores, Relatores, Promociones y Flota
> id: fix-161-b-rollout-cards-instructores-relatores-promociones-flota
> refs: fix-158-b-rediseno-cards-alumnos, fix-159-b-rollout-cards-alumnos-profesional-y-ex-alumnos, fix-160-b-guardrail-colores-hardcodeados-y-card-adhoc
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Root Cause
Continuación del rollout iniciado en fix-158-b/159-b. De los 15 archivos con el mismo bloque
duplicado de card dual-viewport, 4 quedan hechos (Alumnos B/Profesional + Ex-Alumnos B/Prof.).
Este fix ataca los 4 con el patrón más roto de los 11 restantes — cada uno con su propia
variante ad-hoc de badge (span custom con estilo inline, o `p-tag` mezclado con spans), en vez
de `app-badge` unificado:

- `admin-instructores.component.ts` — `<span class="license-badge" style="font-size:10px;...">`
  (estilo inline literal en el template, ARCH-08 no lo agarra por no ser color).
- `admin-profesional-relatores.component.ts` — `<span class="spec-badge" [style.background]="...">`
  para especialidades + `p-tag` para estado, dos sistemas de pill en la misma card.
- `admin-profesional-promociones.component.ts` — `.promo-card` (clase propia ad-hoc, no `.card`)
  + `<span class="course-badge">` custom + `p-tag` para estado.
- `flota-list-content.component.ts` — ya tocado en fix-160-b (bug de contraste de la patente);
  el resto de la card sigue ad-hoc.

## ACs Afectados
- Ninguno — mejora visual sobre UI ya en producción, misma data y acciones.

## Cambio
- **Archivo nuevo:** `shared/components/instructor-card/instructor-card.component.ts` — Dumb,
  reemplaza el bloque de `admin-instructores`. `app-badge` para estado de licencia.
- **Archivo nuevo:** `shared/components/relator-card/relator-card.component.ts` — Dumb,
  reemplaza el bloque de `admin-profesional-relatores`. Mantiene `spec-badge` (color dinámico
  por especialidad vía `getSpecColor()`, no es un severity fijo — no mapea 1:1 a `app-badge`)
  pero unifica el pill de estado a `app-badge`.
- **Archivo nuevo:** `shared/components/promocion-card/promocion-card.component.ts` — Dumb,
  reemplaza el bloque de `admin-profesional-promociones`. Mismo criterio con `course-badge`
  (color por curso) + `app-badge` para estado.
- **Archivo nuevo:** `shared/components/vehiculo-card/vehiculo-card.component.ts` — Dumb,
  reemplaza el bloque de `flota-list-content` (incluida la patente ya corregida en fix-160-b).
- **Archivos:** los 4 componentes `*-content`/feature de arriba — reemplazan su bloque de
  card inline (real + skeleton) por el componente correspondiente.

## Test de Regresión
- Verificación visual manual en `localhost:4210` para las 4 páginas — **confirmado**:
  Instructores (badge "Vigente" unificado), Relatores (badge "Activo" + `spec-badge` A4/A5
  intacto), Promociones (badge "En curso" + `course-badge` por curso intacto), Flota
  (patente legible + badge "Disponible").
- `npm run lint:arch` → **exit 0**.
- **ARCH-25 bajó**: 137 → 130 composiciones ad-hoc (64 → 60 archivos) — la cuota del
  ratchet se mueve en la dirección correcta, no hace falta re-sellar el baseline.
- `npm run test:ci` → **2333/2333 tests, 0 fallos** (el flaky de `instructor-clases.facade`
  de la sesión anterior no reapareció).
