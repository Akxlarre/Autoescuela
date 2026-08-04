# Fix: vocabulario tipográfico — promover los clusters repetidos a clases del DS
> id: fix-078-b-vocabulario-tipografico-ds
> refs: ASG-b-053
> status: done
> closed: 2026-07-31
> created: 2026-07-31

## Root Cause

**[Heredado de ASG-b-053, a confirmar]:** el DS tiene tokens de color blindados (ARCH-11 a
ARCH-18) pero **no tiene vocabulario tipográfico**. La misma intención visual se escribe de N
formas distintas, con tamaños, pesos y trackings que divergen — no porque alguien eligiera esas
diferencias, sino por copiar del componente de al lado.

Medido por el auto-index de `indices/STYLES.md`:

- **Micro-label overline** — 81 instancias en 5 formas (2 tamaños, 2 pesos, 3 trackings).
- **Título de fila/ítem** — 136 instancias en 5 formas, oscilando entre `semibold` y `bold`
  para el mismo rol semántico.

Es el mismo problema que `.kpi-value`/`.kpi-label` ya resolvieron para los datos numéricos —
solo que para el resto de la tipografía nunca se hizo.

## ACs Afectados

Ninguno — fix autónomo, sin AC de spec previa.
Referencia: `specs/assignments/ASG-b-053-vocabulario-tipografico-clusters.md`.

## Archivos involucrados

- `src/styles/tokens/_variables.scss` — donde viven `.kpi-value`/`.kpi-label`/`.section-eyebrow`;
  las clases nuevas van al lado
- ~40+ componentes en `src/app` (la lista exacta sale del codemod en modo `--dry`)
- `scripts/` — el ratchet nuevo
- `indices/STYLES.md` — registrar las clases nuevas

## Decisión de diseño (paso 1 — BLOQUEA al resto) — CERRADA

### Hallazgo que reformuló la decisión

La Asignación proponía crear `.overline` / `.item-title` / `.item-meta`. Al medir la
distribución real (script en scratchpad, análisis por *combinación* de clases y no por string
literal, para no depender del orden) apareció algo que el auto-index no mostraba:

- El overline no son **81 instancias en 5 formas**, son **221 en 25 variantes**.
- **14 archivos contienen más de una variante**; `admin-pagos.component.ts` y
  `secretaria-pagos.component.ts` tienen **4 cada uno en el mismo archivo**. Prueba de que la
  divergencia es deriva por copiar, no elección de diseño.
- **`.kpi-label` YA ERA el overline**: `text-xs` + `uppercase` + `text-muted` +
  `letter-spacing: 0.06em`. La clase existía desde siempre.

**La causa raíz real no era una clase faltante, sino una restricción de alcance mal puesta.**
`visual-system.md` documentaba `.kpi-label` como *"**Solo** etiquetas de datos numéricos. NUNCA
para contexto de sección"*. Quien necesitaba un micro-label fuera de un KPI tenía prohibida la
única clase que hacía exactamente eso → la recomponía a mano. 25 veces.

Crear `.overline` como clase nueva (lo que pedía la Asignación) habría dejado **tres** clases
casi idénticas (`kpi-label`, `section-eyebrow`, `overline`), empeorando el problema de naming
que ASG-b-057 ya registró.

### Decisiones tomadas (confirmadas por el usuario)

1. **`.kpi-label` se renombra a `.overline`**, quedando `.kpi-label` como alias deprecado
   (selector por coma, mismo bloque). Un solo nombre para "micro-label uppercase"; el uso en
   KPIs pasa a ser un caso más, no el dueño de la clase.
2. **Peso `font-semibold`** (600), no el `font-medium` (500) que tenía `.kpi-label`. De las 221
   ad-hoc, **172 usan semibold o bold y solo 28 medium** — adoptar `medium` habría aligerado 193
   lugares de golpe, que es un rediseño y no una migración. Contrapartida aceptada: los 30 usos
   actuales de `.kpi-label` suben 500→600.
3. **`.item-title`** (`text-sm` + `font-semibold` + `text-text-primary`): 166 instancias, 106
   semibold vs 60 bold → gana semibold por mayoría y por coherencia con el punto 2.
4. **`.item-meta` NO se crea.** La Asignación la proponía, pero no hay ninguna medición que la
   justifique. No se agregan clases al DS por simetría.

### Alcance de la migración — decisión de riesgo

De las 221 instancias de overline, **68 usan `text-2xs` (10px)** y el resto `text-xs` (12px).
Migrarlas todas a `.overline` subiría esas 68 de 10px a 12px — un cambio de densidad visible,
en su mayoría dentro de tablas. **Se migra ahora solo la familia `text-xs`** (sin cambio de
tamaño, solo normalización de peso/tracking). La familia `text-2xs` queda como decisión
explícita pendiente: puede ser densidad deliberada en tablas, y no se toca a ciegas.

## Cambio

### 1. Clases canónicas (`src/styles/tokens/_variables.scss`)

- `.kpi-label` → renombrada a **`.overline`**, con `.kpi-label` conservada como alias deprecado
  en el mismo selector por coma. Peso subido `--font-medium` → `--font-semibold`.
- Nueva **`.item-title`**: `text-sm` + `font-semibold` + `text-primary` + `leading-snug`.
- Comentario extenso en el archivo explicando **por qué** el peso es semibold y por qué la
  restricción de alcance anterior fue la causa raíz — para que no se "corrija" de vuelta.

### 2. Migración (`scripts/migrate-typography-vocabulary.mjs`, nuevo)

**304 reemplazos en 100 archivos**: 138 `.overline` + 166 `.item-title`.

El script es **idempotente y re-ejecutable** (verificado: segunda corrida = 0 cambios), a
diferencia de `migrate-color-mix-t4.mjs`, cuyo diseño de una-sola-corrida es exactamente lo que
permitió el drift que documentó ASG-b-034. Tiene modo `--dry`.

Efecto colateral positivo: limpió duplicados que el codemod detectó de paso (ej.
`task-card.component.ts` tenía `text-text-primary` repetido dos veces en el mismo `class`).

### 3. Ratchet ARCH-19 (`scripts/lib/class-discipline.js`)

- Detector `findAdhocTypography()` + whitelist `isTypographyWhitelisted()`. Analiza por
  **combinación** de clases, no por string literal → inmune al orden en que estén escritas
  (que es como se escondían las 25 variantes del auto-index).
- 11 casos nuevos en la micro-suite (`class-discipline.test.mjs`), todos verdes.
- ⚠️ **NO cableado al linter todavía, a propósito.** Requiere editar `scripts/architect.js`, que
  está **protegido por el File Protector** y necesita autorización humana explícita. Además,
  agregar `'ARCH-19'` a `DS_RULES` sin regenerar el baseline **rompería `lint:arch`**:
  `architect.js:290` hace `baseline.rules[r].total` sin guarda contra `undefined`. El orden
  correcto quedó documentado en el propio archivo.

### 4. Documentación

- `.claude/rules/visual-system.md` — la sección "Tipografía de Datos — KPI" pasó a
  **"Vocabulario tipográfico"** con las 4 clases en tabla, y se **eliminó la restricción que
  causó el problema** ("kpi-label SOLO para datos numéricos"), dejando registrado que fue la
  causa raíz.
- `indices/STYLES.md` — `.overline` e `.item-title` en la tabla de clases semánticas,
  `.kpi-label` marcada como alias deprecado, y la nota "⚠️ Distinción clave" reescrita para
  contrastar `.overline` vs `.section-eyebrow` (que es la distinción que sí importa).

### 5. Addendum post-cierre — regresión propia detectada y corregida

Al correr `npm run indices:sync` tras cerrar el track, `.overline` y `.kpi-label`
**desaparecieron** de la tabla "Clases semánticas" de `indices/STYLES.md` (pasó de 10 a 10
clases, perdiendo las 2 y sumando `.item-title`). Causa: `scripts/indices-sync.js:527` exigía
`/^(\.[\w-]+)\s*\{/` — el nombre de clase pegado a la llave en la misma línea. El selector por
coma con comentario inline que introdujo este fix no matchea **ninguna** de sus dos líneas.

Falla silenciosa: sin error, sin warning — el índice simplemente reportaba de menos (168 usos
invisibles). Corregido el regex para aceptar las 3 formas reales (`{`, `,` y comentario inline
antes de la llave). Verificado: 12 clases, `.overline` 138 usos, `.kpi-label` 25.

`scripts/` es path exento del Spec Gate, así que no requirió track propio.

### Fuera de alcance (deliberado)

- **`.item-meta` NO se creó** — la Asignación la proponía, sin ninguna medición que la respalde.
- **68 overlines de la familia `text-2xs` sin migrar** — subirlos a `.overline` cambiaría
  10px→12px, densidad visible en tablas. Verificado en vivo: los 19 restos que quedan en
  `/app/admin/pagos` son **todos** de esa familia, ninguno de la `text-xs`. Requiere decisión
  aparte, coordinada con ASG-b-055 (que ya trata el piso de legibilidad).

## Test de Regresión

- `npm run lint:arch` → **exit 0**, 0 errores. `.overline`/`.item-title` no disparan ARCH-11
  (son clases SCSS globales, no tokens del `@theme` — no aplica la whitelist derivada).
- `npx ng build` → **exit 0**. Único warning: bundle budget, preexistente.
- `node scripts/lib/class-discipline.test.mjs` → todos los casos verdes (11 nuevos de ARCH-19,
  incluyendo orden alternativo de clases e idempotencia).
- `npm run test:ci` → **1651 passed, 3 skipped (pre-existentes), 0 failed, exit 0** (136/137
  archivos, 223s). Idéntico al baseline — 304 reemplazos en 100 archivos sin una sola regresión,
  lo esperable en un cambio puramente de clases CSS que no toca lógica.
- **Verificación visual real (Browser MCP, `ng serve` en vivo)** — la parte que importa en este
  track, porque el riesgo es que una clase no aplique y el texto herede el color/peso del padre
  (el modo de fallo clásico de AP-011):
  - Probe sintético: `.overline` y `.kpi-label` computan **idéntico** (12px / 600 / uppercase /
    `letter-spacing: 0.72px` = 0.06em × 12px) → el alias funciona. `.item-title` computa 14px /
    600 / sin uppercase / color primary.
  - Elementos **reales** en `/app/admin/pagos`: 7 `.overline` (cabeceras de columna) y 17
    `.item-title` (nombres de alumno) con los valores computados correctos.
  - `/app/admin/dashboard`: 2 `.item-title` correctos y **0 restos ad-hoc** de la familia
    `text-xs`.
