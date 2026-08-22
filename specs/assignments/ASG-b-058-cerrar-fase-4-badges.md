# Asignación ASG-b-058 — Cerrar la fase 4 del roadmap de badges (los 4 residuos)

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-31
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-31
> **resulting_track:** fix-083-b-cerrar-fase-4-badges

---

## Contexto / Objetivo

La fase 4 del roadmap de botones/badges (`docs/BACKLOG-DEUDA-TECNICA.md`) llegó al 95%:
seis tracks (fix-036 a fix-044-m) bajaron el baseline de **122 → 36 pills** y de
**49 → 28 archivos**, y de los 36 restantes todos están revisados y documentados como
exclusión legítima. Lo que queda son **4 residuos concretos**, ninguno grande, que llevan
abiertos desde el 2026-07-09 porque cada uno es demasiado chico para su propio track.

Esta asignación los agrupa para cerrarlos de una vez y poder declarar la fase 4 terminada.

### Residuo 1 — `alumnos-list-content.component.ts` (2 pills)

El único archivo con backlog "fresco" sin migrar. Quedó fuera de fix-044-m porque una
sesión paralela tenía cambios sin commitear ahí. **Verificar primero que el archivo esté
libre** — si sigue tomado, este punto se salta y el resto del track sigue siendo válido.

### Residuo 2 — Decisión de diseño: pill "tipo" SENCE/Particular

Tres archivos de contabilidad-cursos (`admin-contabilidad-cursos`,
`admin-curso-singular-detalle-drawer`, `admin-curso-singular-cobro-drawer`) usan
`var(--color-purple)` — **token que no existe**. Es la tercera ocurrencia confirmada del
mismo bug latente (fallback silencioso: el pill renderiza sin el color esperado).

**La pregunta:** ¿se agrega un variant `purple` a `app-badge`, o el eje SENCE/Particular
se resuelve con los 6 variants que ya existen? Ojo con la regla 3-2-1 de marca antes de
sumar un color nuevo al vocabulario solo para una distinción de contabilidad.

### Residuo 3 — Decisión de diseño: el "tab count"

El contador numérico dentro de `<app-tab>` (`tabs.component.ts`) **no es semánticamente un
badge de estado** — es un conteo. Hoy ARCH-15 lo marca como pill ad-hoc. ¿Merece su propia
utilidad `.tab-count`, o se documenta como excepción del heurístico?

### Residuo 4 — Refinar el heurístico ARCH-15

Van **6 falsos positivos confirmados** entre fix-043-m y fix-044-m: `<button>` con
`(click)` que visualmente parecen pills pero son controles interactivos, no badges de
estado (filtro en `asistencia-clase-b-content`, 2 en `public-context-banner`, etc.).
El heurístico debería excluir `<button>` con handler de click.

> Este es el más valioso de los 4: mientras el ratchet tenga 6 falsos positivos, el
> baseline miente y nadie confía en el número.

## Alcance sugerido

1. Migrar `alumnos-list-content.component.ts` (si está libre).
2. Resolver el residuo 2 — decisión + aplicar a los 3 archivos. Corrige un bug real de
   paso (el token inexistente).
3. Resolver el residuo 3 — decisión + implementar o documentar la excepción.
4. Refinar ARCH-15 para excluir `<button>` con `(click)`, y re-baselinear:
   `npm run lint:arch -- --update-ds-baseline`.
5. Marcar la fase 4 como cerrada en `docs/BACKLOG-DEUDA-TECNICA.md`.

## Referencias

- `docs/BACKLOG-DEUDA-TECNICA.md` §"Fase 4 — Consolidar `app-badge`" — los 4 ítems sin
  tachar al final de la sección son exactamente estos.
- `indices/ANTI-PATTERNS.md` §AP-012 — la regla y el guardrail ARCH-15.
- `src/app/shared/components/badge/` — los 6 variants actuales.
- `scripts/lib/class-discipline.baseline.json` — baseline del ratchet.
- Historial: fix-036-m, fix-038-m, fix-039-m, fix-040-m, fix-042-m, fix-043-m, fix-044-m.

## Archivos involucrados

- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts`
- `src/app/features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts`
- `src/app/features/admin/contabilidad-cursos/admin-curso-singular-detalle-drawer.component.ts`
- `src/app/features/admin/contabilidad-cursos/admin-curso-singular-cobro-drawer.component.ts`
- `src/app/shared/components/tabs/tabs.component.ts`
- `scripts/` — el chequeo ARCH-15

## Notas para quien la reclame

- Los puntos 2 y 3 son **decisiones de diseño chicas pero reales** — no las resuelvas por
  inercia agregando un variant. Con 6 variants ya existentes, sumar el 7º tiene que
  justificarse.
- El punto 4 es independiente de los otros y se puede hacer solo.
- ⚠️ **Trampa conocida de Tailwind v4** (descubierta en fix-036-m): `'badge-' + variant()`
  NO genera CSS — las `@utility` se podan por contenido escaneado. Usar `computed()` +
  `switch` con strings literales. Si agregas un variant nuevo, esto aplica.
