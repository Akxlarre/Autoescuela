# Asignación ASG-b-094 — Override de `force-compact` muerto en `section-hero` (modo slim)

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P2
> **created:** 2026-08-22
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-22
> **resulting_track:** hotfix-052-b-force-compact-selector-muerto-section-hero

---

## Contexto / Objetivo

Detectado al cerrar `hotfix-051-b-hero-slim-acciones-shrink0-overflow` (antes
`hotfix-038-b`, renumerado por colisión). Ese hotfix cambió el contenedor RIGHT del modo
slim de `shrink-0` a `shrink min-w-0` en el template
(`section-hero.component.ts:475`), para que el bloque de acciones se ajuste al ancho
disponible cuando baja a su propia línea.

El problema es que el bloque CSS de `:host-context(.force-compact)` sigue seleccionando ese
mismo elemento **por sus clases viejas**:

```css
/* section-hero.component.ts:150 */
.flex.items-center.gap-2.flex-wrap.shrink-0 {
  width: 100% !important;
  flex-shrink: 1 !important;
}
```

Como el elemento ya no tiene `shrink-0`, el selector **no matchea nada**. Verificado: los
únicos candidatos en el archivo son `:475` (`flex items-center gap-2 flex-wrap shrink min-w-0`)
y `:493` (`flex items-center gap-2 flex-wrap`, sin `shrink-0`).

Consecuencia: el comportamiento compacto que ese bloque forzaba (ancho 100% del contenedor de
acciones con el layout-drawer abierto) se perdió en silencio. No hubo regresión visible
reportada porque el fix por defecto de `:475` cubre el caso común — pero el override
específico de compact ya no existe, y el comentario de 6 líneas que lo explica quedó
describiendo código muerto.

## Alcance sugerido

1. Decidir si el override sigue siendo necesario ahora que el default es `shrink min-w-0`.
   - Si **sí** → reapuntar el selector al elemento real (idealmente por un atributo/clase
     estable, no por la cadena de utilities de Tailwind, que es exactamente lo que causó
     este bug).
   - Si **no** → borrar el bloque y su comentario en vez de dejarlo colgado.
2. Verificar con `/verify` a ~910px de ancho **con el layout-drawer abierto** (`force-compact`)
   y sin él — es el escenario del hotfix original.

`section-hero` es uno de los componentes más consumidos de la app: revisar el impacto en el
resto de las páginas antes de tocar, no solo en `/app/admin/dashboard`.

## Lección transversal

Un selector CSS escrito como cadena de utilities de Tailwind (`.flex.items-center.gap-2...`)
se rompe en silencio en cuanto alguien edita una sola utility del template. Vale la pena
evaluar un guardrail en `scripts/architect.js` que detecte selectores compuestos solo por
utilities en `styles:` de un componente, o adoptar la convención de marcar con `data-*` los
elementos que el CSS del propio componente necesita seleccionar.
