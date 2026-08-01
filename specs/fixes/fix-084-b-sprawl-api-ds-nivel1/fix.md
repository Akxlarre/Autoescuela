# Fix: sprawl de la API pública del DS — Nivel 1 (deprecar alias, documentar árbol de decisión)
> id: fix-084-b-sprawl-api-ds-nivel1
> refs: ASG-b-057
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-057, a confirmar]:** la API pública del DS creció por acumulación.
33 clases `.bento-*` (con pares alias: `bento-square`/`bento-1x1`, `bento-wide`/`bento-2x1`,
etc.) y 9 variantes de botón sin eje ortogonal (tono × intensidad × jerarquía aplanados en
un solo nombre). La propia doc necesita advertencias literales para desambiguar clases
(`indices/STYLES.md:155`, antes de fix-078-b), señal de que el naming falló.

**Alcance explícito de este track: SOLO Nivel 1** (recomendado por la propia Asignación
como piso, sin refactor). Nivel 2 (migrar usos + borrar CSS duplicado + rediseñar botones a
ejes ortogonales) queda deliberadamente fuera — es caro, de alto blast radius, y nada de
esto se ve roto en pantalla hoy.

## ACs Afectados

Ninguno — fix autónomo. Referencia: `specs/assignments/ASG-b-057-sprawl-api-bento-botones.md`.

## Archivos involucrados

- `scripts/indices-sync.js` — generador de la tabla bento en `indices/STYLES.md`
- `indices/STYLES.md` — árbol de decisión bento + botones (sección manual)
- `src/styles/layout/_bento-grid.README.md` — reforzar la sección "Legacy Aliases" existente
- `scripts/check-bento-classes.js` (nuevo) — guardrail standalone, ver nota de alcance

## Cambio

**Nivel 1 completo, los 3 puntos.** Nivel 2 (migrar usos + rediseño de botones a ejes
ortogonales) queda deliberadamente fuera de este track.

### 1. Deprecar alias, sin refactor

- **Verificado antes de decidir**: `grep -rohE "bento-(1x1|2x1|2x2|3x1|3x2|4x1)\b" src/app`
  → **0 usos reales**. La convención semántica (`bento-square`/`bento-wide`/`bento-tall`/
  `bento-feature`) ya ganó en la práctica — no hubo que elegir, el código ya había votado.
  `_bento-grid.scss` ya los agrupaba como "Legacy aliases" en un comentario interno; nunca
  se propagó a la documentación externa.
- `scripts/indices-sync.js` — el generador de la tabla bento de `indices/STYLES.md` ahora
  anota los 6 alias dimensionales como `⚠️ Legacy — usar .bento-X` en vez de `—`. Es una
  anotación en el **generador**, no una edición manual de la tabla auto-generada — sobrevive
  a cualquier `npm run indices:sync` futuro (a diferencia de escribir la nota a mano, que se
  habría perdido en el próximo sync).
- `_bento-grid.README.md` — reforzada la sección "Legacy Aliases" ya existente con el dato
  de 0 usos reales y "PROHIBIDO en código nuevo" explícito (antes decía solo
  "Recomendación", tono débil).

### 2. Árbol de decisión (bento + botones)

Nueva sección `indices/STYLES.md` § "Cómo elegir: bento + botones" — 2 tablas de 6-8 filas
("necesito X → uso Y"), en la zona **hand-maintained** del archivo (antes de
`<!-- AUTO-GENERATED:BEGIN -->`), no dentro del bloque auto-generado. Reemplaza tener que
leer las 34 filas de referencia bento + 9 de botones para decidir — esas tablas de detalle
siguen abajo para consulta puntual, esto es el atajo.

### 3. Guardrail contra sprawl futuro — `scripts/check-bento-classes.js` (nuevo)

Compara las clases `.bento-*` reales en `_bento-grid.scss` contra
`scripts/lib/bento-classes.allowlist.json` (snapshot de las 34 actuales) — falla si aparece
una clase nueva no revisada. Diseño Data-In/Data-Out (`extractBentoClasses`/
`diffBentoClasses` puras, exportadas, testeadas en `scripts/lib/bento-classes.test.mjs`,
7/7 verde) + un bloque CLI que solo corre si el archivo se ejecuta directamente.

**Bug real encontrado y corregido en el momento**: la primera versión de la detección
"¿me estoy ejecutando como CLI o como import?" comparaba `import.meta.url` (URL absoluta
`file:///C:/...`) contra `process.argv[1]` armado a mano con un `file://` pegado
(`file://scripts/check-bento-classes.js`, relativo) — nunca coincidían en Windows, así que
el bloque CLI **nunca corría**: `node scripts/check-bento-classes.js` daba `exit 0` sin
imprimir nada, silenciosamente inútil. Corregido con `pathToFileURL()` de `node:url` (la
forma robusta estándar, normaliza relativo/absoluto y separadores `\` vs `/`). Verificado
corriendo desde 2 cwd distintos después del fix.

**⚠️ NO cableado a `npm run lint:arch`** — requeriría editar `scripts/architect.js`
(protegido, requiere que el humano aplique el patch, mismo patrón que ARCH-19/20 en
fix-078-b/079-b). Patch preparado en
`specs/fixes/fix-084-b-sprawl-api-ds-nivel1/architect-js-patch.md` (ARCH-21), opcional —
el check funciona standalone sin aplicarlo.

Sí agregado (no protegido, aplicado directo): `npm run check:bento` en `package.json`,
para no depender de recordar el path del script.

## Test de Regresión

- `node scripts/lib/bento-classes.test.mjs` → **7/7 casos verdes** (extracción, sin
  cambios, clase nueva detectada, clase removida detectada como info-no-error).
- `node scripts/check-bento-classes.js` → `exit 0`, 34/34 clases en el allowlist.
  Verificado también que **sí falla** cuando corresponde: se probó con una clase sintética
  agregada a una copia temporal del SCSS, detectada correctamente como nueva.
- `npx tsc --noEmit` → sin errores.
- `npm run lint:arch` → **exit 0**, 0 errores (sin cambios de comportamiento — este track
  no toca ninguna regla existente).
- `npm run indices:sync` → corrido, `STYLES.md` regenerado con las anotaciones `⚠️ Legacy`
  correctas (verificado con grep sobre las 6 filas de alias).
- `npm run test:ci` → **1651 passed, 3 skipped (pre-existentes), 0 failed, exit 0**
  (136/137 archivos, 200s). Idéntico al baseline — sin regresiones.
