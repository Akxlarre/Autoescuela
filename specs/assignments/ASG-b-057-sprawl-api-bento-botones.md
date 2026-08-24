# Asignación ASG-b-057 — Sprawl de la API pública del DS: 30+ clases bento y 9 variantes de botón

> **status:** completada
> **owner:** b
> **tipo_sugerido:** spec
> **priority:** P3
> **created:** 2026-07-31
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-31
> **resulting_track:** fix-084-b-sprawl-api-ds-nivel1

---

## Contexto / Objetivo

La API pública del DS creció por acumulación, no por diseño. Nadie la rediseñó nunca —
cada spec agregó lo que necesitaba y ninguna quitó nada. Hoy la superficie que un dev (o
un agente) tiene que aprender para usar el sistema es desproporcionada respecto a lo que
el sistema realmente hace.

### Síntoma 1 — El grid tiene 30+ clases, con alias duplicados

Según el auto-index de `indices/STYLES.md`, `.bento-*` expone hoy 33 clases, incluyendo
**pares que son lo mismo con dos nombres**: `bento-square`/`bento-1x1`,
`bento-wide`/`bento-2x1`, `bento-tall`/`bento-2x2`, `bento-feature`/`bento-3x2`. Conviven
dos convenciones de nombre (semántica vs. dimensional) sin que ninguna esté deprecada.

Sumado a 6 modificadores de grid (`--fill-screen`, `--fill-screen-2`, `--fill-screen-kpi`,
`--forms`, `--four-equal`, `--hero-fit`, `--rows-fit`, `--wizard`), la pregunta "¿qué
clase uso para esta celda?" no tiene respuesta obvia. Un sistema de grillas con 33 clases
no es un sistema — es un montón.

### Síntoma 2 — 9 variantes de botón sin eje ortogonal

`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-outline`, `btn-warning-soft`,
`btn-success-soft`, `btn-danger-ghost`, `btn-danger-solid`, `btn-neutral` (+ `btn-sm`).

No hay un eje: `-soft` y `-ghost` y `-solid` describen *intensidad*, `warning`/`success`/
`danger` describen *tono*, y `primary`/`secondary`/`neutral` describen *jerarquía* — pero
las tres dimensiones están aplanadas en un solo nombre, así que las combinaciones que
faltan (¿`btn-info-soft`? ¿`btn-success-solid`?) hay que inventarlas cada vez.
`btn-sm` (fix-086-m) hizo lo correcto — un modificador componible en vez de 9 variantes
nuevas de tamaño. Este track es aplicar ese mismo criterio a tono e intensidad.

### Síntoma 3 — La doc necesita advertencias para desambiguar

`indices/STYLES.md:155` tiene un cuadro literal:

> **⚠️ Distinción clave:** `.kpi-label` ≠ `.section-eyebrow`.

Cuando la documentación de un DS necesita una advertencia para que no confundas dos
clases, el problema no se arregla con más documentación — el naming falló. Mismo caso
probable con `.overline` si sale de ASG-b-053 sin coordinar (por eso ese track dice
explícitamente que si `.overline` y `.kpi-label` resultan ser lo mismo, se fusionan).

## Alcance sugerido

⚠️ **Este es el track más caro y el menos urgente de los 6.** Nada de esto se *ve* roto
en pantalla: es coste de aprendizaje y de deriva futura, no un defecto visible. Dos
niveles posibles, elegir explícitamente al reclamar:

**Nivel 1 — barato, sin refactor (recomendado como piso):**
1. Elegir la convención ganadora de cada par de alias y **deprecar** la otra en la doc
   (sin borrar CSS): una nota "usar X, `Y` es alias legacy" en `indices/STYLES.md` y en
   `_bento-grid.README.md`.
2. Documentar el árbol de decisión que hoy no existe: "¿qué celda bento uso?" y "¿qué
   `btn-*` uso?" como una tabla de 5 líneas, no como 33 filas de referencia.
3. Guardrail que impida **agregar** clases bento nuevas sin revisión.

**Nivel 2 — refactor real (solo si el equipo lo quiere pagar):**
4. Migrar los usos de los alias legacy y borrar el CSS duplicado.
5. Rediseñar los botones a ejes ortogonales (`btn` + tono + intensidad), con un período de
   compatibilidad. Blast radius: toda la app.

## Referencias

- `indices/STYLES.md` §"Bento Grid — Clases de celda disponibles" (33 clases, auto-generado)
  y §"Component Utility Classes" (los 9 botones).
- `src/styles/layout/_bento-grid.scss` + `_bento-grid.README.md`.
- `src/tailwind.css` — las `@utility btn-*`.
- `docs/BACKLOG-DEUDA-TECNICA.md` — precedente de `btn-sm` (fix-086-m / ASG-b-008): la
  decisión de "modificador componible, NO variante por tipo" ya está tomada y es el
  criterio a extender.
- `.claude/rules/visual-system.md` §"Patrón App-like" — documenta por qué existen varios
  de los modificadores `--fill-screen*`; **leerlo antes de proponer fusionarlos**, cada
  uno salió de una spec peleada (0028-0031).

## Notas para quien la reclame

- **No empieces por el nivel 2.** El nivel 1 captura la mayor parte del valor (dejar de
  enseñar dos formas de hacer lo mismo) por una fracción del costo y sin riesgo de
  regresión visual.
- Los modificadores `--fill-screen*` **parecen** redundantes y no lo son: cada uno
  resuelve un layout distinto y `--fill-screen-kpi` además arregla el shift de tabs por
  el scrollbar de Windows (spec 0031). No los toques sin leer esas specs.
- Si ASG-b-053 está en curso, coordinar: ese track puede crear `.overline` y este track
  puede querer fusionarlo con `.kpi-label`. Decidirlo una sola vez, no dos.
