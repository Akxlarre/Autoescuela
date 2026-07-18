# Fix: Tier D2 — *-content components con animateHero explícita
> id: fix-022-b-tier-d2-content-animatehero
> refs: fix-018-refactor-animaciones-entrada-bento-premium, fix-021-hero-canon-sweep-tier-c-d
> status: done
> created: 2026-06-15

## Root Cause

8 componentes `*-content` de `shared/` llaman explícitamente a `animateHero(hero)` **y**
a `animateBentoGrid(grid)`. Con el canon actual, `animateBentoGrid` ya incluye el hero en
el stagger (lo trata como una celda más); la llamada extra a `animateHero` es redundante
y provoca doble tween en la entrada del hero.

Además, si `section-hero` tiene `[animateOnInit]` en `true` (default), el hero puede
disparar su propio `animateHero` interno también → triple tween en algunos casos.

## ACs Afectados

Ninguno — limpieza de animaciones sin impacto en negocio.

## Cambio por componente

Para cada componente afectado:
1. Agregar `[animateOnInit]="false"` al `<app-section-hero>` interno.
2. Eliminar la llamada explícita `this.gsap.animateHero(heroRef)`.
3. Eliminar el `viewChild('heroRef')` / `#heroRef` si ya no se usa.
4. Conservar únicamente `animateBentoGrid(grid)` (o el SWR effect equivalente).

## Componentes afectados

- `shared/components/servicios-especiales-content/`
- `shared/components/cuadratura-content/`
- `shared/components/asistencia-clase-b-content/`
- `shared/components/alumnos-list-content/`
- `shared/components/flota-list-content/`
- `shared/components/certificacion-profesional-content/`
- `shared/components/certificacion-clase-b-content/`
- `shared/components/agenda-semanal/`

## Notas de implementación

- `agenda-semanal`: excluido. Su `animateHero(calendarCardRef)` anima la tarjeta semanal,
  no el `section-hero` (que está dentro de un `@if`). Comportamiento intencional.
- `cuadratura-content`: cambios de template aplicados (`#heroRef` eliminado del div,
  `[animateOnInit]="false"` añadido al section-hero). Dead code residual (`viewChild heroRef`
  + llamada muerta) bloqueado por Architect Guard — la violación pre-existente de
  `inject(LayoutDrawerFacadeService)` en un Dumb component impide editar el TS.
  El bug de doble animación está efectivamente mitigado (heroRef() = undefined en runtime).
  Violación de arquitectura pendiente en fix-023.

## Test de Regresión

- ✅ `ng build` verde — sin errores de compilación.
- Playwright: pendiente de verificación visual interactiva.
