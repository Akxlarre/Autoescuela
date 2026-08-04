# Fix: alinear las fuentes de verdad del DS (la doc contradice al código)
> id: fix-077-b-alinear-fuentes-verdad-ds
> refs: ASG-b-056
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-056, a confirmar]:** el DS tiene **cuatro** fuentes de verdad para las
mismas reglas — `indices/STYLES.md`, `.claude/rules/architecture.md`,
`.claude/rules/visual-system.md` y la skill global `~/.claude/skills/design-system/` — y hoy se
contradicen entre sí y con el código.

No es cosmético: es la doc que se lee en el paso 1 del flujo obligatorio (DESCUBRIR), tanto por
humanos como por agentes. Quien haga lo que la doc dice, hoy escribe código mal.

Tres contradicciones verificadas (2026-07-31):

1. **`indices/STYLES.md:88-93` describe una implementación que ya no existe.** La tabla afirma
   que `btn-danger-ghost`, `btn-danger-solid` y `btn-neutral` usan valores `theme()` y por eso
   *"no son afectados por los overrides de `.surface-hero`"*. Falso desde `fix-031-m`: hoy son
   `--btn-neutral-bg: var(--bg-subtle)` y `--btn-neutral-text: var(--text-primary)`
   (`_variables.scss:284-290`), y `.surface-hero` **sí** sobrescribe ambos tokens. Trampa
   latente, no bug vivo (1 solo uso de `btn-neutral`, en un modal sin hero).
2. **`architecture.md:45` obliga lo que `visual-system.md:91` prohíbe** (componentes
   `*-skeleton.component.ts` colocados). La práctica sigue a `visual-system.md` — el único
   skeleton en `src/app` es `shared/components/skeleton-block/` — así que `architecture.md:45`
   es ley muerta. Duplicada además en el `architecture.md` global del usuario.
3. **La skill global `design-system` enseña clases muertas**: usa `text-secondary` (prohibida
   por AP-015, revertida en `fix-033-m`) y `app-kpi-card-skeleton` (prohibido por
   `visual-system.md:91`). Se escribió antes de fix-030/033 y nunca se actualizó.

## ACs Afectados

Ninguno — fix autónomo, sin AC de spec previa.
Referencia: `specs/assignments/ASG-b-056-alinear-fuentes-de-verdad-ds.md`.

## Archivos involucrados

- `indices/STYLES.md` — tabla de botones + "Nota cascade" (punto 1)
- `.claude/rules/architecture.md` y `~/.claude/rules/architecture.md` — línea de skeletons (punto 2)
- `~/.claude/skills/design-system/SKILL.md` — clases muertas (punto 3)
- Posible: `src/styles/tokens/_variables.scss` si se decide crear un botón realmente inmune al cascade

## Cambio

**Cero código de producción tocado** — el track es íntegramente documentación/reglas.

### Punto 1 — `indices/STYLES.md`: tabla de botones + "Nota cascade"

Antes de escribir, se enumeraron los **22 overrides reales** de `.surface-hero` y se cruzó cada
`btn-*` contra esa lista. Resultado: la doc estaba mal en el **mecanismo** para los 3 botones, y
mal en la **conclusión** para 1 de 3.

| Utilidad | Decía la doc | Realidad verificada |
|---|---|---|
| `btn-danger-ghost` | "usa `theme()`", inmune | Tokens (`--bg-surface`, `--state-error*`); **sí es inmune**, pero porque el hero no toca esos tokens |
| `btn-danger-solid` | "usa `theme()`", inmune | Token `--state-error-strong`; **sí es inmune**, mismo motivo |
| `btn-neutral` | "usa `theme()`", inmune, *"usar cuando el botón debe mantener su color independientemente del contexto"* | Tokens `--bg-subtle` + `--text-primary`, **ambos sobrescritos por el hero** → **NO es inmune**; dentro de un hero renderiza glass blanco sobre blanco |

- Reescritas las 3 filas con los tokens reales (ya no describen colores Tailwind que no existen
  en el CSS: "gris-100", "rojo-300", "blanco puro").
- Reescrita la "Nota cascade" con la tabla de inmunidad real, y añadido lo que **ninguna versión
  de la doc decía**: la inmunidad de los dos `danger` es **incidental, no contractual** — se
  sostiene solo mientras `.surface-hero` no agregue `--bg-surface`/`--state-error*` a sus
  overrides. Hoy no existe un botón con inmunidad garantizada.
- Añadida la guía que faltaba: para "cancelar" dentro de un hero, la elección correcta es
  `btn-secondary` (que el hero adapta a propósito), no `btn-neutral`.
- Documentado que `--state-error-strong` **no se redefine en dark** (queda `#dc2626` en ambos
  modos). Se verificó que es deliberado y cumple AA (blanco sobre `#dc2626`), y se dejó anotado
  para que nadie lo "arregle" creyendo que es un olvido de dark-mode.

### Punto 2 — Contradicción de skeletons

- `.claude/rules/architecture.md` (repo): la línea "Skeleton colocated" se reemplazó por la regla
  correcta (`@if (loading())` + `<app-skeleton-block>` dentro del mismo componente), citando a
  `visual-system.md` como fuente única y dejando nota de qué decía antes y por qué era ley muerta.
- `~/.claude/rules/architecture.md` (blueprint global): **NO se borró** — la Asignación pedía
  borrarla también acá, pero se verificó que en el blueprint global esa línea es la **única**
  guía sobre skeletons (el `visual-system.md` global no los menciona), así que borrarla dejaría
  a los demás proyectos sin regla. Se **acotó** en su lugar: se marca como default del blueprint,
  invertible por el proyecto, nombrando explícitamente el caso Autoescuela.

### Punto 3 — Clases muertas en la doc

Barrido de `text-secondary`/`text-muted`/`text-primary` cortas y de `app-kpi-card-skeleton` en
**todas** las fuentes, no solo donde se habían visto:

- `~/.claude/skills/design-system/SKILL.md` — 4 correcciones: `text-muted` → `text-text-muted`
  en el frontmatter `description` (el peor sitio posible: es lo que el modelo lee para decidir
  cómo aplicar la skill), 2 × `text-secondary` → `text-text-secondary`, y el ejemplo de
  `<app-kpi-card-skeleton />` reemplazado por `<app-skeleton-block>`.
- **`app-kpi-card-skeleton` no existe** — verificado: no está en `src/app` ni en `indices/`. Era
  un componente fantasma que solo vivía en la doc (y en la memoria del agente).
- `~/.claude/skills/design-system/BRAND_GUIDELINES.md` — la tabla de tokens tipográficos listaba
  las 3 formas **cortas** como canónicas. Reescrita a `text-text-*` con la columna del token CSS
  y la explicación de por qué el doble `text-` no es un typo.
- **`.claude/rules/visual-system.md:81`** — hallazgo no previsto por la Asignación: el archivo
  que **define** que `text-secondary` no renderiza la usaba en su propio ejemplo de
  `.indicator-live`. Corregido. Es la instancia más pura del problema: la regla se contradecía a
  sí misma dentro del mismo archivo.

### Punto 4 — Jerarquía de fuentes (la causa raíz)

Sincronizar las cuatro copias arregla el *hoy*; sin jerarquía vuelven a divergir. Se agregó a
`indices/STYLES.md` una sección **"Fuentes de verdad del DS — jerarquía"** que fija el orden de
autoridad (1 código → 2 reglas → 3 registro → 4 material didáctico), con tres reglas de
mantenimiento: actualizar el nivel 3 en el mismo commit que el nivel 1, prohibir que el nivel 4
reescriba reglas (debe citarlas), y verificar contra el código toda afirmación específica.

## Test de Regresión

- `npm run lint:arch` → **exit 0**. Warnings sin cambios respecto al baseline (ARCH-10
  complejidad de facades, ARCH-14 27 íconos sin uso, ARCH-11 16 clases muertas del backlog
  fix-030) — ninguno introducido por este track.
- `npm run test:ci` → **1651 passed, 3 skipped (pre-existentes), 0 failed, exit 0** (136/137
  archivos, 179s). Idéntico al baseline que dejó fix-076-b — sin regresiones, como corresponde a
  un track que no toca `src/`.
- **No se corrió `/verify` (Playwright) ni `ng build`**: el track no toca ni un archivo de
  `src/`, así que no hay superficie renderizada que pueda regresionar. Verificación proporcional
  al riesgo.
- Verificación real del contenido: cada afirmación corregida se cruzó contra el código fuente
  (`_variables.scss`, `tailwind.css`) antes de escribirla — el modo de fallo de este track sería
  reemplazar una afirmación falsa por otra falsa.
