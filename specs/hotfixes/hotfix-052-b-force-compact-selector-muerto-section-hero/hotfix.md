# Hotfix: Override de `force-compact` muerto en `section-hero` (modo slim)

> id: hotfix-052-b-force-compact-selector-muerto-section-hero
> refs: ASG-b-094
> status: done
> closed: 2026-08-22
> created: 2026-08-22

## Problema

[Heredado de ASG-b-094, confirmado]: `hotfix-051-b` cambió el contenedor RIGHT del modo slim de
`shrink-0` a `shrink min-w-0` en el template (`section-hero.component.ts:475`), pero el bloque
CSS de `:host-context(.force-compact)` siguió seleccionando ese elemento **por sus clases
viejas**:

```css
/* section-hero.component.ts:150 */
.flex.items-center.gap-2.flex-wrap.shrink-0 {
  width: 100% !important;
  flex-shrink: 1 !important;
}
```

Como el elemento ya no tiene `shrink-0`, el selector **no matchea nada**. Verificado: los únicos
candidatos del archivo son `:475` (`flex items-center gap-2 flex-wrap shrink min-w-0`) y `:493`
(sin `shrink-0`).

**Qué se perdió exactamente.** El override hacía dos cosas y solo una quedó cubierta:

| Declaración | ¿Sigue cubierta? |
|---|---|
| `flex-shrink: 1` | ✅ Sí — el template ya usa `shrink` desde `hotfix-051-b` |
| `width: 100%` | ❌ **No** — nadie lo aplica |

El `width: 100%` es el que hace que, con el layout-drawer abierto, el contenedor de acciones tome
la fila completa y sus hijos wrapeen alineados a la izquierda, coherente con la regla
`[role='group'] { width: 100% }` inmediatamente debajo. Sin él, en compacto el bloque queda
shrink-to-fit y desalineado respecto a su propio grupo de acciones.

No hubo regresión reportada porque el fix por defecto de `:475` cubre el caso común (sin drawer);
lo que se perdió es el ajuste **específico de compacto**.

## Causa raíz

Un selector CSS escrito como **cadena de utilities de Tailwind** se rompe en silencio en cuanto
alguien edita una sola utility del template. No hay error, no hay warning: la regla simplemente
deja de aplicar.

## Cambios

- **`section-hero.component.ts`** — el contenedor RIGHT gana un anclaje **estable**
  (`data-hero-right`), y el override de `force-compact` pasa a seleccionarlo por ese atributo en
  vez de por la cadena de utilities. Se conserva `width: 100%` (lo que realmente se había
  perdido) y se elimina `flex-shrink: 1`, que hoy es redundante con el `shrink` del template.

Elegido `data-*` y no una clase porque Tailwind no lo poda por contenido escaneado (precedente:
la trampa de purga documentada en `fix-036`).

## Resultado

- El override de compacto vuelve a aplicar, y ahora es inmune a que alguien reordene o cambie
  las utilities del template.
- El comentario de 6 líneas que describía código muerto queda describiendo código vivo.

## Verificación

**CSSOM** (`/app/admin/ex-alumnos`, dev server real): la regla nueva está cargada y la vieja
desapareció. Único match:

```
.force-compact[_nghost-…] [data-hero-right][_ngcontent-…],
.force-compact [_nghost-…] [data-hero-right][_ngcontent-…] { width: 100% !important; }
```

**Probe funcional** — se aplica `.force-compact` sobre el ancestro del host y se mide el ancho
real del contenedor RIGHT:

| Escenario | Ancho del contenedor | Fila disponible |
|---|---|---|
| Sin `force-compact` | 716px (shrink-to-fit) | 811px |
| Con `force-compact` | **778px** (fila completa − padding) | 811px |

`aplicaOverride: true`. **Antes del fix este mismo probe no producía ningún cambio**, porque el
selector no matcheaba ningún elemento del DOM.

⚠️ El probe **no discrimina en cualquier hero**: en heroes donde el bloque RIGHT ya llena la fila
naturalmente (ej. `/app/admin/dashboard`), `width: 100%` coincide con el ancho natural y ambos
valores dan igual. Hay que medirlo en un hero con back-link + chips, donde el bloque es más
angosto que la fila. Anotado por si alguien reintenta la verificación y cree que falló.

- `tsc --noEmit` limpio · `lint:arch` exit 0 (0 errores).
- Sin tests: el cambio es CSS + un atributo, sin lógica.

## Nota de proceso

**Caí dos veces en la misma trampa en esta sesión**: backticks dentro de un comentario de un
template literal. La primera en el `template` (`secretaria-ex-alumnos`, spec 0038-b) y la segunda
acá, en el **`styles[]`** — que también es un template literal, cosa que la regla de
`visual-system.md` no dice explícitamente (habla solo de `template`). En ambos casos el síntoma
fue el mismo y confunde: errores de `tsc` en líneas que no tienen nada que ver con la edición.

Candidato a mejora del harness: extender la advertencia de `visual-system.md` a `styles[]`, o
directamente un guardrail que detecte backticks dentro de comentarios en cualquier template
literal de un componente.
