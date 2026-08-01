# Asignación ASG-b-056 — Alinear las fuentes de verdad del DS (la doc contradice al código)

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-31
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-31
> **resulting_track:** fix-077-b-alinear-fuentes-verdad-ds

---

## Contexto / Objetivo

El DS tiene **cuatro** fuentes de verdad para las mismas reglas — `indices/STYLES.md`,
`.claude/rules/architecture.md`, `.claude/rules/visual-system.md` y la skill global
`~/.claude/skills/design-system/` — y hoy **se contradicen entre sí y con el código**.

Esto no es cosmético: es la doc que leen tanto los humanos como los agentes en el paso
1 del flujo obligatorio (DESCUBRIR). Un agente que hace lo que la doc dice, hoy escribe
código mal. Tres contradicciones verificadas (2026-07-31):

### 1. `indices/STYLES.md:88-93` describe una implementación que ya no existe

La tabla dice que `btn-danger-ghost`, `btn-danger-solid` y `btn-neutral` *"usan valores
`theme()` de Tailwind, no `var(--)` tokens, por lo que **no son afectados** por los
overrides de `.surface-hero`. Usar estos cuando el botón debe mantener su color
independientemente del contexto."*

**Falso desde `fix-031-m`.** Hoy en `_variables.scss:284-290`:

```
--btn-danger-solid-bg: var(--state-error-strong);
--btn-neutral-bg:      var(--bg-subtle);
--btn-neutral-text:    var(--text-primary);
```

Y `.surface-hero` **sí** sobrescribe `--bg-subtle` (→ `rgba(255,255,255,0.10)`) y
`--text-primary` (→ `#fff`). O sea que `btn-neutral` dentro de un hero renderiza como
glass blanco con texto blanco — exactamente lo contrario de lo que la doc promete.

> **No es un bug vivo:** hay 1 solo uso de `btn-neutral` (`eliminar-alumno-modal`), en un
> modal, sin `surface-hero` alrededor. Es una **trampa latente**: la próxima persona que
> lea esa tabla y ponga un `btn-neutral` en un hero se va a comer un botón invisible.

### 2. `architecture.md` y `visual-system.md` se contradicen sobre skeletons

- `.claude/rules/architecture.md:45` → *"**Skeleton colocated**: Cada Dumb que recibe data
  async tiene su `{nombre}-skeleton.component.ts` al lado"*
- `.claude/rules/visual-system.md:91` → *"**PROHIBIDO** crear componentes duplicados tipo
  `*-skeleton.component.ts`"*

Una obliga lo que la otra prohíbe. **La práctica sigue a `visual-system.md`**: el único
componente de skeleton en todo `src/app` es `shared/components/skeleton-block/`. O sea
que `architecture.md:45` es ley muerta que nadie aplica — pero sigue ahí para que un
agente la lea y cree el componente duplicado que el hook después va a rechazar.

> Ojo: la misma línea muerta está duplicada en el `architecture.md` **global** del usuario
> (`~/.claude/rules/architecture.md:44`), no solo en el del repo.

### 3. La skill global `design-system` enseña clases muertas

`~/.claude/skills/design-system/SKILL.md` documenta `text-secondary` (en los ejemplos de
`.surface-glass` y `.indicator-live`) y `app-kpi-card-skeleton`. La primera es
**exactamente la clase que `AP-015` prohíbe y que `fix-033-m` tuvo que revertir**; el
segundo es el patrón que `visual-system.md:91` prohíbe. La skill se escribió antes de
fix-030/033 y nunca se actualizó.

## Alcance sugerido

1. Corregir `indices/STYLES.md:88-93` — describir el comportamiento real (tokenizado,
   afectado por el cascade) y, si el equipo **quiere** que exista un botón inmune al
   cascade, resolverlo de verdad: o `.surface-hero` deja de tocar esos tokens, o se crea
   un token `--btn-neutral-*` propio que no derive de `--bg-subtle`. La doc no puede
   seguir prometiendo una garantía que el CSS no da.
2. Resolver la contradicción de skeletons: borrar `architecture.md:45` (repo **y** global)
   y dejar `visual-system.md` como única fuente. Verificar de paso que el Architect Guard
   no esté validando la regla vieja.
3. Actualizar la skill global `design-system`: `text-secondary` → `text-text-secondary`,
   quitar `app-kpi-card-skeleton`, y revisar el resto contra el canon actual.
4. **Lo de fondo:** decidir cuál de las cuatro fuentes es la canónica y hacer que las
   otras la referencien en vez de duplicarla. Mientras haya cuatro copias del mismo
   contrato, van a volver a divergir — este track solo las sincroniza *hoy*.

## Referencias

- `indices/STYLES.md:88-93` (tabla de botones + "Nota cascade") y §"Token Cascade en `.surface-hero`".
- `src/styles/tokens/_variables.scss:279-296` (tokens de botón) y el bloque `.surface-hero`.
- `src/tailwind.css:348-440` (`@utility btn-danger-solid` / `btn-neutral`).
- `indices/ANTI-PATTERNS.md` §AP-015 — por qué `text-secondary` está prohibida.
- `.claude/rules/architecture.md:45` ↔ `.claude/rules/visual-system.md:91`.
- `docs/BACKLOG-DEUDA-TECNICA.md` §"Infraestructura de guardrails" — el Architect Guard
  ya está registrado como desalineado de ARCH-11 v2; encaja acá.

## Notas para quien la reclame

- **Es la más barata de las 6 y debería ir primero.** Las otras cinco construyen sobre
  esta doc; arreglarla después es escribir dos veces.
- Los puntos 1-3 son casi todo edición de `.md` — pero el punto 1 puede derivar en un
  cambio real de tokens si el equipo decide que sí quiere el botón inmune al cascade.
- `.claude/hooks/` está protegido (requiere autorización humana) — si el punto 2 toca el
  Architect Guard, hay que pedirla explícitamente.
