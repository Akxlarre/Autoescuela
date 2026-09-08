# Fix: Cursos Singulares — cards mobile sin padding de contenedor ni hover por item
> id: fix-164-b-cursos-singulares-mobile-cards-hover-y-spacing
> refs: fix-158-b-rediseno-cards-alumnos, fix-161-b-rollout-cards-instructores-relatores-promociones-flota, fix-162-b-rollout-cards-mantenimientos-cursos-anticipos-certificacion
> status: done
> closed: 2026-09-08
> created: 2026-09-08

## Root Cause
`fix-162-b` corrigió el wrapper exterior de Cursos Singulares (`.card p-0 overflow-hidden`
+ `appCardHover` en la `<section>`), pero esa sección wrapea tanto la tabla desktop como el
listado de cards mobile — el fix nunca tocó las cards individuales del listado mobile porque
su alcance era "el contenedor exterior", no el contenido interno.

A diferencia de `vehiculo-card`, `alumno-card`, etc. (componentes extraídos en fix-158-b/161-b
que aplican `appCardHover` en la card individual), Cursos Singulares nunca pasó por esa
extracción — su vista mobile es un `@for` inline en `admin-contabilidad-cursos.component.ts`
con dos problemas respecto al patrón canónico de listados (`flota-list-content`,
`alumnos-list-content`):
1. El contenedor `.mobile-view` no tiene padding (`flex flex-col gap-3` sin `p-4`), mientras
   que todo el resto de listados usa `p-4` + `space-y-*`/`gap-*` — las cards quedan pegadas al
   borde de la sección en vez de tener aire respecto al panel que las contiene.
2. Cada card individual (`<div class="card p-0 overflow-hidden">`) no tiene `appCardHover` —
   solo lo tiene la `<section>` exterior (hover del panel completo, no de cada card), por lo
   que las cards no responden al hover como en el resto de la app.

## ACs Afectados
- Ninguno — mejora visual sobre UI ya en producción, misma data y acciones. Fix autónomo
  reportado por QA manual del usuario.

## Cambio
- **Archivo:** `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts`
  - Contenedor `.mobile-view`: agregar `p-4` (línea ~139), igual que `flota-list-content` /
    `alumnos-list-content`.
  - Card individual del `@for` (línea ~156): agregar directiva `appCardHover` — ya está
    importada y en `imports:` (se usa en la `<section>` exterior), solo falta aplicarla a
    cada card.

## Test de Regresión
- Verificación visual manual en `localhost:4200` (`/verify`): cards mobile de Cursos
  Singulares con separación respecto al borde del panel y con el mismo efecto hover (lift +
  shadow) que `flota`/`alumnos` al pasar el mouse. **Verificado**: viewport 700px muestra
  padding correcto (`p-4`) alrededor del listado; `dispatchEvent(mouseenter)` sobre las 2
  cards de seed confirma `transform: translateY(-2px)` + `box-shadow` glow aplicados por
  `appCardHover`. Vista desktop (1440px) sin regresión visual.
- `npm run lint:arch` → exit 0 (warnings preexistentes, no relacionados).
