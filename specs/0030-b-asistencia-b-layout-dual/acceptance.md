# Acceptance 0030-b — Asistencia B: layout dual (fill-screen desktop / scroll móvil) + densidad adaptativa

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-07-12 (2 rondas de feedback visual del owner el 2026-07-13: alertas compactas + redistribución a 2 columnas)
> **Verifier:** Claude (Fable 5) — QA en vivo con Claude in Chrome sobre `ng serve`

---

## Resumen

- AC totales: 8 + 5 edge cases (13)
- AC cumplidos: 13
- AC fallidos: 0
- AC con evidencia: 13

**Veredicto final:** ✅ PASA — con una **limitación de entorno documentada** en AC1/AC3 (ver nota global).

> **Nota global de entorno:** el monitor de la sesión de QA entrega un viewport CSS máximo de 1031px, por lo que el contenedor `layoutmain` (`<main>`, ~781px con sidebar) **nunca alcanza físicamente los 1024px** del breakpoint desktop. Para los ACs de modo fill se inyectó por `<style>` el bloque idéntico al `@container layoutmain (min-width:1024px)` de `_bento-grid.scss` (SCSS que esta spec NO modifica — AC4 — y que ya está probado en producción por 0028/0029). El lado móvil/tablet del container query sí se ejercitó REAL (contain: none medido a 781px y 598px). Adicional: con la ventana de Chrome ocluida, el navegador suspende `requestAnimationFrame` → las animaciones GSAP de entrada quedan congeladas y el router registra `InvalidStateError: Transition was aborted` (View Transitions API). Se verificó empíricamente (0 callbacks rAF en 600ms, `visibilityState: hidden`) que es un artefacto del entorno de automatización, no de este cambio.

---

## Verificación por AC

### AC1 — Desktop tab Prácticas: fill-screen, sin scroll de página

- **Estado:** ✅ cumplido (geometría verificada con emulación del container query — ver nota global)
- **Evidencia:**
  - QA en vivo (admin): `shell-content` scrollHeight 841 == clientHeight 841 (`noPageScroll: true`); grid 798px (= 918 viewport − 120); `.bento-fill` 536px con `contain: size`; el scroll vive en el wrapper interno de la tabla (50px viewport / 183px contenido, scrolleable).
  - Template: `asistencia-clase-b-content.component.ts` — `[class.bento-grid--fill-screen-kpi]="activeTab() === 'practicas'"` + celda `.bento-banner.bento-fill` hija directa del grid.

### AC2 — Desktop tab Ciclos: scroll natural, sin modificador

- **Estado:** ✅ cumplido
- **Evidencia:** QA en vivo — al click en tab Ciclos: `gridHasModifier: false` y la celda fill desaparece del DOM; al volver a Prácticas: `gridHasModifier: true`. Ciclos scrollea con la página (sin height fijo).

### AC3 — Alertas pinned + thead sticky

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Alertas pinned: sección `shrink-0` fuera del wrapper de scroll; con el seed real de **20 alertas** se activó la mitigación prevista en plan §8: `max-h-[45%] overflow-y-auto` (alertas capadas a 239px con scroll interno propio, tabla conserva 269px).
  - thead sticky: `position: sticky` computado; scroll interno a 120px → `theadRect.top == scrollerRect.top` (thead anclado al scrollport).

### AC4 — `_bento-grid.scss` sin cambios

- **Estado:** ✅ cumplido
- **Evidencia:** `git diff --stat` = solo 4 archivos (`asistencia-clase-b-content.component.ts` + `.spec.ts`, `admin-asistencia.component.ts`, `secretaria-asistencia.component.ts`). Cero SCSS tocado.

### AC5 — Móvil: presupuesto 6 + "Cargar más"

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Unit: `asistencia-clase-b-content.component.spec.ts` — "con maxVisible=6 recorta a 6 filas y ofrece Cargar más" / "incrementa en pasos del presupuesto hasta el tope" (13/13 verdes).
  - QA en vivo: seed insuficiente (máx 2 clases el 2026-07-10 — mismo gap declarado en 0029) → se inyectaron 15 filas sintéticas en el signal del facade vía `window.ng` (sin tocar BD): 6 visibles + botón "Cargar más (9 restantes)"; click → 12 + "(3 restantes)".

### AC6 — Filtros/fecha/tab operan sobre el total y resetean el contador

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Unit: casos de reset por filtro de estado, instructor, fecha y roundtrip de tab; "contadores de filtros sobre el total".
  - QA en vivo: con contador en 12 → click pill "Pendiente" → 6 visibles de 10 filtradas ("(4 restantes)"); roundtrip Prácticas→Ciclos→Prácticas → 6. Los contadores de las pills muestran totales (15/5/10), no lo visible.

### AC7 — Drawer lateral abierto compacta la densidad sin recarga

- **Estado:** ✅ cumplido
- **Evidencia:** QA en vivo — con drawer "Iniciar Clase" abierto, el contenido compactó (pills con contadores en layout compacto, screenshot dark). Verificación mecánica adicional: `main` forzado a 598px → `LayoutService.tier()` reacciona y `smart.maxVisible()` = 6 sin recarga (ResizeObserver por contenedor, canon 0028).

### AC8 — Dumb sin LayoutService; ambos Smarts idénticos

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: el Dumb solo agrega `maxVisible = input<number|null>(null)`; el wiring (`inject(LayoutService)` + computed `null|6`) vive en `admin-asistencia.component.ts` y `secretaria-asistencia.component.ts` (idéntico, patrón `admin-tareas`).
  - QA en vivo en AMBAS rutas (login secretaria vía SPA, canon 0029): `/app/secretaria/asistencia` → `maxVisible: 6`, `contain: size`, sin scroll de página, 6 filas + "Cargar más (9 restantes)", thead sticky — igual que admin.

### AC-E1 — Cero filas → mensaje vacío sin "Cargar más"

- **Estado:** ✅ cumplido — unit ("con cero filas no ofrece Cargar más") + QA en vivo (domingo 12/07 sin clases: mensaje "No hay registros…", sin botón).

### AC-E2 — Menos filas que presupuesto → sin "Cargar más"

- **Estado:** ✅ cumplido — unit ("con menos filas que el presupuesto…") + QA en vivo (10/07 con 2 filas reales: sin botón).

### AC-E3 — Skeletons acotados sin romper el fill

- **Estado:** ✅ cumplido — `skeletonIndexes = computed(() => maxVisible() ?? 5)`; el skeleton vive dentro del card fill (misma celda), no altera la estructura de 3 filas del grid.

### AC-E4 — Móvil: alertas + tabla apilan con scroll nativo

- **Estado:** ✅ cumplido — QA en vivo con contenedor 598px (container query real): `contain: none`, página scrollea (3571px de contenido), las 20 alertas fluyen SIN cap (el `max-h` porcentual es inerte con altura indefinida — comportamiento dual confirmado) y la tabla apila debajo. Screenshot capturado.

### AC-E5 — Modal justificación y drawers intactos

- **Estado:** ✅ cumplido — QA en vivo: modal "Justificar Inasistencia" abre y cierra; drawer "Iniciar Clase — QA Alumno 1" abre desde la fila y cierra desde su X.

---

## Out-of-scope respetado

- ❌ Rediseño del tab Ciclos (master-detail/fill) — confirmado: no entró; Ciclos intacto.
- ❌ Cards móviles / poda de columnas por tier — confirmado: la tabla mantiene `overflow-x-auto`.
- ❌ Paginación server-side en `AsistenciaClaseBFacade` — confirmado: facade sin cambios.
- ❌ Cambios de BD/RLS/DTOs — confirmado: cero migraciones, cero modelos.
- ❌ Cambios funcionales a acciones — confirmado: solo se movieron de sitio en el template.
- ❌ Limpieza de `.bento-banner` muertas en `ciclos-teoricos-content` — confirmado: no se tocó.

---

## Deuda técnica detectada

- ~~Bug preexistente de datos: `formatIsoDate()` destrozaba timestamps ISO completos~~ → **RESUELTO 2026-07-13** (ver "Revisión post-cierre" abajo).
- **Seed de QA sin volumen de clases prácticas** (heredado de 0029): ninguna fecha reciente con >6 clases; "Cargar más" se ejercitó con inyección sintética client-side. → propuesta: seed de QA con un día de 10+ prácticas. (Sigue abierto.)
- Entrada GSAP congelada con ventana ocluida (rAF suspendido) — comportamiento del navegador, afecta a todas las páginas por igual; solo relevante para QA automatizado. (Sigue abierto, no crítico.)

---

## Revisión post-cierre (2026-07-13) — feedback visual del owner

El owner reportó, viendo la implementación en su propio navegador: **"todo esta muy apretado... las alertas estan raras en esa distribución"**. Evaluación honesta: tenía razón. Causa raíz identificada:

1. La card de alerta original (avatar 32px + nombre + hasta 3 líneas de texto + botón largo, con fondo coloreado completo) estaba dimensionada para 2-3 items, pero el seed real tiene **20 alertas**. Capada a 45% de una celda ya angosta, mostraba solo 2-3 antes de scrollear y dominaba visualmente la vista con color de "advertencia urgente" aunque fueran items de rutina.
2. Doble scroll anidado (alertas + tabla, ambas dentro de una celda de altura fija) — patrón que casi siempre se siente apretado.

**Decisión de diseño** (elegida por el owner entre 3 alternativas — filas compactas / tira horizontal tipo `live-classes-panel` / resumen+drawer): **filas compactas de 1 línea**, manteniendo el modo fill-screen (no se abandonó AC1).

**Cambios aplicados:**
- Card pesada → fila delgada: avatar 20px (`text-2xs`, piso del DS — NO `text-[9px]`, eso disparó ARCH-17 y se corrigió), nombre+conteo en una sola línea, botón corto ("Eliminar"/"Reactivar"/"Recordar" en vez de "Eliminar Horario"/etc). Header de sección también compactado (`text-xs uppercase` con contador, ícono 14px).
- El detalle que antes ocupaba 2 líneas extra (última falta, política) se movió al atributo `title` (tooltip nativo) vía el nuevo método `alertaTooltip()` — no se pierde información, solo deja de competir por espacio vertical siempre.
- **Bug real encontrado y corregido de paso:** `formatIsoDate()` esperaba `YYYY-MM-DD` pero el origen real (`recorded_at`/`scheduled_at` en el facade) es `timestamptz` de Supabase — producía texto roto tipo "07T09:33:41.902234+00:00-07-2026". Ahora trunca a los primeros 10 caracteres antes de parsear. Verificado en vivo: tooltip real muestra "Última falta: 14-07-2026" correctamente.
- 4 tests nuevos (`formatIsoDate` con timestamp completo y date-only, `alertaTooltip` danger/warning) — 17/17 verdes en el componente, 1289/1289 en la suite completa.

**Resultado medido en vivo** (viewport real sin ocluir, 1568×751): sección de alertas pasó de ~3 cards pesadas visibles a **4-5 filas compactas visibles** (fila ~34px vs. ~80px antes) con scroll interno para el resto de las 19-20; tabla con notablemente más aire debajo. Verificado en modo claro y oscuro.

**AC afectados por esta revisión:** AC3 (alertas pinned) y AC-E4 (apilado móvil) siguen cumplidos con el nuevo diseño — ningún AC de la spec original quedó invalidado, es un refinamiento visual dentro del mismo contrato.

---

## Revisión post-cierre #2 (2026-07-13) — redistribución a 2 columnas

Tras las filas compactas, el owner señaló un problema **de distribución, no de tamaño**: *"el importante es el componente de asistencia del día... la distribución no es la correcta"* + *"no tuvimos en cuenta el otro tab"*, pidiendo análisis visual previo.

**Análisis visual (ambos tabs, viewport real 1728×1000):**
- **Tab Prácticas:** medido en vivo — alertas (19) apiladas ARRIBA ocupaban ~204px (45% del alto), tabla "Asistencia del Día" (la protagonista) comprimida debajo con ~225px + espacio muerto al fondo. Como las alertas eran full-width, cada fila tenía un hueco enorme entre nombre y botón → ancho desperdiciado. Jerarquía invertida confirmada.
- **Tab Ciclos Teóricos:** ya usa un layout de 2 columnas (clases | roster) que aprovecha el ancho y scrollea natural. Funciona bien → **se deja como está** (decisión del owner). Fue la pista de la solución.

**Diagnóstico:** el tab Prácticas apilaba todo verticalmente en una pantalla mucho más ancha que alta. Solución elegida por el owner (entre 2col / colapsable / resumen+drawer): **2 columnas** — tabla protagonista ancha + alertas en rail lateral.

**Cambios aplicados:**
- Contenedor `.bento-fill`: de `flex-col` a fila en desktop. La tabla es `order-1 flex-1 min-w-0` (protagonista, izquierda/arriba); las alertas pasan de `<section>` a `<aside order-2>` con ancho `w-80` en desktop (rail, derecha). En móvil apila con la **tabla primero** (trabajo principal inmediato), alertas debajo.
- **Switch col/row por CONTENEDOR, no por viewport:** nuevo computed `isDesktopLayout = computed(() => maxVisible() === null)` (misma señal que activa fill-screen y compacta la densidad, vía `LayoutService.tier()` con ResizeObserver de `<main>`). Se usa en vez de `lg:` de Tailwind porque con el drawer lateral abierto el viewport sigue ancho pero `<main>` se angosta → debe apilar a 1 columna igual que la densidad se compacta. **Verificado en vivo:** con `<main>` forzado a 718px, `flex-direction` pasa de `row` a `column` y el rail pierde `w-80` (tabla y aside a ancho completo); con main ancho, tabla 1206px + rail 320px.
- Rail: header fijo (`shrink-0`) + listado `flex-1 min-h-0 overflow-y-auto` → scroll interno en desktop, altura natural en móvil (dual).
- Ya no se usa el cap `max-h-[45%]` (el rail llena el alto de la fila por diseño).

**Resultado medido:** tabla protagonista de **1206px** (vs. ~670px antes) + rail de alertas de **320px** mostrando **9 alertas** limpias con scroll (vs. 3-4 apiladas arriba). Jerarquía corregida: el trabajo (marcar asistencia) domina, las alertas son contexto lateral. Verificado claro/oscuro, 0 errores de consola nuevos (solo el `InvalidStateError` de View Transitions ya conocido).

**Nota de proceso (bug recurrente propio):** durante esta sesión introduje 4 veces un backtick dentro de comentarios HTML del `template: \`...\`` — cada uno rompía el template literal de TS. Uno de ellos (`` `lg:` ``) llegó a disco y el `ng serve` sirvió el último bundle bueno silenciosamente → mi "verificación desktop" inicial corrió sobre código stale (versión `lg:`), lo que de hecho reveló el bug de `lg:` que ya sospechaba. Lección: tras un cambio, confirmar que el bundle en vivo tiene el código nuevo (revisar `className` real en el DOM), no asumir que el watch recompiló.

**AC afectados:** AC1 (fill-screen desktop) intacto; AC3 (alertas visibles/accionables) se cumple mejor (rail lateral con 9 visibles); AC7 (reacción al drawer/tier por contenedor) ahora **también gobierna el layout de columnas**, no solo la densidad — más consistente. Ningún AC invalidado.

---

## Cambios en índices

- `indices/COMPONENTS.md` — actualizada entrada de `app-asistencia-clase-b-content` (input `maxVisible`, modo dual, alertas pinned) y eliminada la entrada duplicada obsoleta (línea con `clasesTeorias`/`viewAtendanceList`, de una versión anterior del componente).
- Resto de índices: sin cambios (no hubo servicios/facades/modelos/BD nuevos).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** reutilizar `--fill-screen-kpi` con la fila de tabs en el slot de KPIs funcionó a la primera; cero SCSS nuevo (la trampa de los dos bloques de 0029 quedó estructuralmente esquivada). El truco `max-h` porcentual (inerte sin altura definida) dio comportamiento dual para las alertas sin container queries adicionales.
- **Fricciones:** (1) los signal inputs no son escribibles en la infra vitest (JIT sin initializer-transform): ni `ComponentRef.setInput` ni bindings de host los propagan — se resolvió stubeándolos con `signal()` vía `Object.defineProperty`, patrón nuevo reutilizable; (2) el riesgo "muchas alertas" catalogado como Baja era en realidad el caso del seed (20 alertas) — la mitigación del plan se activó tal cual estaba prevista; (3) limitaciones físicas del entorno de QA (viewport 1031px, ventana ocluida) exigieron emulación del container query y limpieza manual del estado GSAP.
- **Qué cambiaríamos:** presupuestar datos de seed ANTES del QA (2 specs seguidas con el mismo gap).

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados (T5.1)
- [x] Tests pasando en CI (`npm run test:ci` 1289/1289; spec del componente 13/13 tras el cap de alertas)
- [x] `lint:arch` limpio (exit 0; warnings = backlog preexistente ajeno a estos archivos)
- [x] Sin deuda crítica abierta — 1 deuda NO crítica documentada arriba (seed de QA)
- [x] Visto bueno del owner — reportó feedback visual real, se corrigió (ver "Revisión post-cierre")

**Cerrado por:** Claude (Fable 5), con feedback visual aplicado de Akxlarre
**Fecha:** 2026-07-12 (revisado 2026-07-13)
