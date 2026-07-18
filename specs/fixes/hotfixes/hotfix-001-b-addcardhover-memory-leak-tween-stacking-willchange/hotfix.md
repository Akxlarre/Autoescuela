# Hotfix: addCardHover — memory leak, tween stacking y willChange
> id: hotfix-001-b-addcardhover-memory-leak-tween-stacking-willchange
> status: done
> closed: 2026-06-30
> created: 2026-06-29

## Problema
`addCardHover` registra event listeners que nunca se remueven, permite tween stacking si el mouse entra/sale rápido, y no aplica `will-change` para compositing GPU.

## Cambios
- **Archivo:** `src/app/core/services/ui/gsap-animations.service.ts` — cambiar retorno a `(() => void) | null`, agregar `WeakSet` anti-duplicado, `gsap.killTweensOf()` antes de cada tween, `will-change` en enter + clear en onComplete del leave
- **Archivo:** `src/app/core/directives/card-hover.directive.ts` — inyectar `DestroyRef`, registrar cleanup en `destroyRef.onDestroy()`
- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts` — almacenar cleanup de las dos llamadas directas y ejecutarlas en `ngOnDestroy`
