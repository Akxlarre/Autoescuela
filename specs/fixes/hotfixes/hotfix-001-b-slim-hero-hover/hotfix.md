# Hotfix: Slim hero sin hover GSAP
> id: hotfix-001-b-slim-hero-hover
> status: done
> closed: 2026-06-18
> created: 2026-06-18

## Fix
`app-section-hero` en `density="slim"` no tiene efecto hover GSAP (`addCardHover`).
El modo full sí lo tiene via `#cardRef` + `ngAfterViewInit`.

## Cambio
- `section-hero.component.ts`: agregar `#slimRef` al div externo slim + `viewChild slimRef` + `gsap.addCardHover(slimRef)` en `ngAfterViewInit`.
