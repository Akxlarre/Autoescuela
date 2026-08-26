# Acceptance 0005-i — App-like: `/admin/libro-de-clases` + `/secretaria/libro-de-clases`

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-26
> **Verifier:** ac-verifier (Haiku) · validado por i, con QA visual real vía Playwright MCP
> (admin, `ng serve` real, datos reales)

---

## Resumen

- AC totales: 9 (AC1-AC5, AC-E1 a AC-E4)
- AC cumplidos: 8
- AC no aplicables: 1 (AC-E1)

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Documento no scrollea en desktop (fill-screen)

✅ **Cumplido.** `bento-grid--fill-screen-4` aplicado al root. Verificado con
`document.scrollHeight <= document.clientHeight` en las 7 secciones a 1280×800 — `false` en
todas (no scrollea). Confirmado también a 1440×768.

### AC2 — Scroll interno en la card de la sección, nunca en el documento

✅ **Cumplido.** Las 7 secciones comparten el wrapper `bento-banner bento-fill card p-0 flex
flex-col min-h-0`, header `shrink-0` + contenido en `flex-1 min-h-0 overflow-y-auto`. Confirmado
con `getBoundingClientRect`/`scrollHeight` en "Calendario de Clases" (30 clases de datos reales):
la card scrollea internamente, el documento no.

### AC3 — Paginación de "Control de Asistencia (Firma Diaria)" por semana

✅ **Cumplido.** Reemplazado el `@for` que apilaba las 6 semanas por `visibleWeek()` (una
semana a la vez) + stepper prev/next con label "Semana X de Y". Confirmado con click real en
Playwright: "Semana 1 (24/08 – 29/08)" → clic en "siguiente" → "Semana 2 (31/08 – 05/09)",
label actualizado a "SEMANA 2 DE 6". El paginador solo se renderiza si `totalWeeks() > 1`.
4 tests unitarios cubren semana correcta por índice, 0 semanas, bordes de navegación, y reset al
cambiar de curso/promoción.

### AC4 — "Calendario de Clases" con el mismo tratamiento que el resto

✅ **Cumplido.** Era la única de las 7 sin ningún `overflow` acotado (crecía libre con el
documento). Ahora usa el mismo wrapper `.bento-fill` que las demás — confirmado con 30 clases de
datos reales, scroll interno funcional, documento sin scrollear.

### AC5 — Consistencia entre las 7 secciones

✅ **Cumplido.** Las 7 (`cabecera`, `profesores`, `alumnos`, `asistencia`, `calendario`,
`evaluaciones`, `resumen`) usan exactamente el mismo wrapper y el mismo criterio de scroll
interno — verificado leyendo el código final (ningún `p-6` suelto ni `overflow-x-auto` sin
`.bento-fill` sobreviviente) y confirmado visualmente navegando las 7 en `/verify`.

---

## Verificación de edge cases

### AC-E1 — `force-compact` con drawer abierto

❌ **No aplicable — corrección de alcance descubierta en implementación.** El AC asumía
(heredado del checklist genérico de la ASG) que esta página abre un Drawer propio como
`cuadratura-content` u otras páginas del rollout. **Verificado en el código: no es el caso** —
`LibroDeClasesComponent` no inyecta `LayoutDrawerFacadeService`, no tiene ningún botón que abra
un Drawer, y no bindea `[class.force-compact]` en ningún lugar del template. Es una página de
solo-lectura + edición inline (SENCE/Horario) + exportar PDF, sin flujos de Drawer. El AC no
tiene forma de fallar ni de pasar porque el mecanismo que prueba no existe en esta página —
marcado no aplicable en vez de forzado a "pasa" sin evidencia real.

### AC-E2 — Mobile: scroll nativo

✅ **Cumplido.** Confirmado a 390×844: el fill-screen no se fuerza (mobile revierte a scroll
nativo por diseño del modificador `--fill-screen-4`), subnav y contenido usables sin recortes.

### AC-E3 — Contenido corto sin scrollbar/hueco forzado

✅ **Cumplido.** "Lista de Clase" con 1 solo alumno (dataset de prueba) no muestra scrollbar
interno — el contenido se ve en su alto natural dentro de la card, sin espacio muerto forzado
por un `min-height` artificial.

### AC-E4 — 768px de alto

✅ **Cumplido.** Confirmado a 1440×768: layout usable en las 7 secciones, subnav con labels
completos visibles (a este ancho no cae a modo comprimido), paginador de Asistencia alcanzable.

---

## Fuera de alcance respetado

- ❌ Fix del skeleton gap (fix-074) — confirmado que **ya estaba resuelto** antes de esta spec
  (commit `4df36216`); no se tocó su lógica, solo se leyó el comentario explicativo ya presente
  en el código para no reimplementarlo por error.
- ❌ Rediseño del mecanismo de navegación del subnav — confirmado que **ya era show/hide real**
  (no scroll-to-anchor); no se tocó `app-libro-de-clases-subnav` ni su integración.

Sin scope creep detectado.

---

## Deuda técnica / seguimientos menores (no bloqueantes)

- **Ruta secretaria no verificada en vivo directamente**: `secretaria@test.com` (cuenta de
  prueba) fue redirigida por `professionalBranchGuard` (fix-029, guard pre-existente y no
  relacionado a esta spec — protege el acceso directo por URL de una secretaria sin grant
  profesional cuya sede no ofrece el programa). Como `LibroDeClasesComponent` es exactamente el
  mismo componente `shared` para ambas rutas (sin diferencias de template ni de lógica entre
  admin/secretaria), el fix de layout aplica por construcción — no hay ningún camino de código
  donde el layout se comporte distinto según el rol. No bloqueante; verificar con una cuenta de
  secretaria con grant si se quiere evidencia visual directa en el futuro.
- El fallo preexistente en `secretaria-contabilidad-cuadratura.component.spec.ts`
  (`openIngresoDrawer is not a function`) sigue sin corregir — no forma parte de esta spec, ya
  existía antes de esta sesión (documentado en sesiones anteriores del proyecto).

---

## Cambios en índices

- `indices/COMPONENTS.md` — entrada de `LibroDeClasesComponent` actualizada con la arquitectura
  fill-screen final (root `--fill-screen-4`, las 7 secciones con el wrapper `.bento-fill`
  uniforme, paginación de Asistencia).
- `indices/APP-LIKE-ROLLOUT.md` — fila de `/admin/libro-de-clases` + `/secretaria/libro-de-clases`
  marcada cerrada; paso 17/17 del rollout (**el rollout app-like queda completo**).

---

## Validación técnica

- `ng build --configuration development` → compila sin errores.
- `npm run lint:arch` → 0 errores, mismos 171 warnings del baseline (sin regresiones).
- `npx vitest run` (suite completa) → 2227 passed, 5 skipped, 1 failed (preexistente y no
  relacionado, confirmado que ya fallaba antes de tocar este código).
- `libro-de-clases.component.spec.ts` (nuevo) → 4/4 tests verdes, cubre AC3 completo.
- `/verify` (Playwright MCP, admin, datos reales): las 7 secciones confirmadas sin scroll de
  documento en desktop, paginación de Asistencia funcional con navegación real, 768px de alto y
  mobile verificados, consola sin errores en ningún viewport.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (8/9, 1 no aplicable justificado)
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (salvo el fallo preexistente no relacionado)
- [x] `lint:arch` limpio
- [x] Sin deuda crítica abierta (deuda menor documentada, no bloqueante)

**Cerrado por:** i — confirmado explícitamente por el usuario ("cierra la spec") tras verificar
visualmente el fix de la segunda iteración con datos reales (6 alumnos, 6 semanas de asistencia).
**Fecha:** 2026-08-26

---

## Segunda iteración (2026-08-26) — bug real: fila del subnav se estiraba a 1fr

El usuario reportó, con captura a una resolución ancha (~1700px), un hueco vacío enorme arriba y
abajo del subnav de secciones.

**Root cause:** `bento-grid--fill-screen-4` define `grid-template-rows: auto auto minmax(100px,
1fr) minmax(280px, 1fr)` — la fila 3 (`minmax(100px, 1fr)`) fue diseñada para una sección de
contenido variable que compite por el espacio sobrante (ese es su uso legítimo en `0003-i`,
donde "Categorías" sí necesita ese espacio). En esta página, el auto-flow del grid ubica el
**subnav** —un control corto de altura fija, no contenido variable— en esa misma fila 3. Con
`1fr`, CSS Grid reparte el espacio sobrante entre las filas 3 y 4 por igual, así que el subnav se
estiraba verticalmente mucho más allá de su alto natural, dejando el hueco reportado.

**Fix:** override local (scope por `ViewEncapsulation` de Angular, sin tocar el SCSS global de
`_bento-grid.scss` — no afecta a `0003-i` ni a ninguna otra página que reutilice el modificador)
que fija la fila 3 a `auto` puro (sin `fr`): `grid-template-rows: auto auto auto minmax(280px,
1fr)`. Esto saca al subnav de la repartición de espacio sobrante — todo el sobrante ahora va
íntegro a la card de la sección activa (fila 4), que es donde corresponde.

**Bug de sintaxis introducido y auto-corregido durante el fix:** el comentario explicativo del
override usaba backticks Markdown (`` `_bento-grid.scss` ``, `` `auto` ``) dentro de un
comentario `/* */` que vive en el string `styles:` (template literal) del componente — el
backtick cierra el string antes de tiempo, exactamente el hazard ya documentado en
`visual-system.md` §"Nunca backticks dentro de comentarios". Corregido reescribiendo el
comentario sin comillas invertidas; el build lo detectó de inmediato (`TS2304`/`TS1005`).

**Re-validación técnica:**
- `ng build --configuration development` → compila sin errores (tras corregir los backticks).
- `npm run lint:arch` → 0 errores, mismos 171 warnings del baseline.
- `npx vitest run` (libro-de-clases) → 4/4 tests verdes, sin cambios de comportamiento en la
  lógica de paginación.
- `/verify` (Playwright MCP, admin, misma resolución ~1700px que reportó el usuario): confirmado
  que el subnav ahora se ve a su alto natural, sin huecos; la card de "Calendario de Clases" (30
  clases) ahora aprovecha todo el espacio sobrante que antes se perdía en el subnav estirado —
  visiblemente más filas visibles antes de necesitar scroll. Documento sin scroll confirmado en
  1706×938 y 1440×768. Consola sin errores.

**Veredicto de la segunda iteración:** ✅ PASA — bug real corregido y verificado.
