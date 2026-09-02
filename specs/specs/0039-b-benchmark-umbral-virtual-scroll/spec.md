# Spec 0039-b — Benchmark empírico del umbral de virtual scroll

> **Status:** done
> **Created:** 2026-09-01
> **Owner:** Akxlarre
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** `ASG-b-088` (`specs/assignments/ASG-b-088-investigacion-virtual-scroll-umbral.md`),
derivada de `docs/research/listas-grandes-virtual-scroll.md` §5.2 y del estrés-test del 2026-08-03.

**Persona afectada:** Admin y Secretaria, sobre las 2 listas que quedaron clasificadas como
**Categoría B** (acumulativas reales) tras el estrés-test: ex-alumnos (Clase B y Profesional) e
historial de ventas de servicios especiales.

**Problema que resuelve:**
La investigación de 2026-08-03 propuso **300 filas filtradas** como umbral de activación de
`[virtualScroll]`, pero lo dejó explícitamente marcado como *"un punto de partida defendible con
los datos de negocio disponibles hoy"*, no como un número medido (§4). El equipo decidió
explícitamente **no** dejarlo en modo "esperar a que pase en producción": se puede y se debe
simular ahora, con entregable concreto.

Esta spec es esa medición. Su resultado puede ser perfectamente **"no implementar nada"** — el
alcance de la asignación lo dice sin ambigüedad: *"Si el benchmark NO muestra jank real ni siquiera
en el peor caso simulado, documentarlo y cerrar sin implementar nada — no construir infraestructura
para un problema que no existe."*

**Hipótesis de valor:**
Un dato empírico sobre hardware representativo reemplaza al 300 estimado, y decide con evidencia si
hace falta construir virtual scroll o si el filtro de período que ya existe es suficiente.

### 1.1 Deriva del contexto desde que se escribió la asignación (verificado 2026-09-01)

La asignación es del 2026-08-03. Dos cosas cambiaron desde entonces y **mueven la línea base del
benchmark**. Ninguna invalida la asignación, pero sí redefinen qué se mide:

1. **`ASG-b-087` ya está cerrada** como spec `0038-b` (2026-08-22, ✅ PASA). El filtro de período
   de 12 meses existe, implementado como función pura `applyPeriodWindow`
   (`core/utils/period-window.utils.ts`) + Dumb compartido `<app-period-selector>`, consumido por
   **4 superficies**. Consecuencia directa: el benchmark **ya no mide el estado "sin techo"**. El
   browse por defecto está acotado a 12 meses, así que el caso peligroso pasó a ser el escape
   hatch **"Todo el historial"** — que es lo que hay que medir, no la vista por defecto.
2. **`ex-alumnos` Clase B se consolidó** (`0007-i`, ASG-b-096, cerrada 2026-08-31): la ruta
   `features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` que declara la asignación en
   "Archivos involucrados" **ya no es la fuente de verdad** — ahora es
   `shared/components/ex-alumnos-content/`. La lista de archivos de la asignación quedó stale y se
   corrige en el plan.

### 1.2 El alcance real cayó de 3 superficies a 1 (leído en código, 2026-09-01)

La investigación de 2026-08-03 clasificó ex-alumnos e historial de ventas como *"mostrar todo +
scroll interno"*, es decir DOM sin techo (§3 de `listas-grandes-virtual-scroll.md`). **Leído hoy el
código, eso ya no es cierto para 2 de las 3 superficies:**

| Superficie | Render desktop | Render mobile | ¿DOM sin techo? |
|---|---|---|---|
| `ex-alumnos-content` (Clase B) | `<p-table [paginator]="true" [rows]="10">` (:162-172) | `sliceByBudget` + "Cargar más" (`CARDS_STEP=6`) | **No** — techo de 10 |
| `ex-alumnos-profesional-content` | `<p-table [paginator]="true" [rows]="10">` (:156-159) | `sliceByBudget` + "Cargar más" | **No** — techo de 10 |
| `servicios-especiales-content` (historial) | `<table>` a mano, `@for (venta of ventasFiltradas())` (:274) | `@for` sobre **la misma** lista (:330) | **Sí** — sin techo |

Las dos de ex-alumnos ya están acotadas por el paginador de PrimeNG: el DOM nunca supera 10 filas
sin importar cuántos egresados haya. Virtualizarlas no puede mejorar nada, porque no hay DOM que
recortar. Queda **una sola** superficie candidata real.

**Y esa única superficie tiene un amplificador que la investigación no registró:** sus dos vistas
(tabla desktop y tarjetas mobile) **coexisten en el DOM** — se alternan por CSS
(`@container svc-historial (min-width: 640px)` con `display:none`), no por `@if`. Con N ventas,
Angular crea y mantiene **2N** vistas embebidas, no N. Es el factor que más puede acercar el jank,
y es específico de esta superficie: `ex-alumnos-content` alterna con las mismas clases, pero su
lado desktop está paginado y nunca pasa de 10.

---

## 2. User Stories

- **US1**: Como equipo, queremos un **número medido** en vez del 300 estimado, para decidir con
  evidencia si construir virtual scroll o no construir nada.
- **US2**: Como Admin/Secretaria, quiero que el historial de ventas siga respondiendo al filtrar
  aunque tenga años de registros acumulados y elija "Todo el historial".
- **US3**: Como desarrollador, quiero que si el umbral se implementa, viva como **una constante
  compartida** y no como un número mágico repetido por página.
- **US4**: Como equipo, quiero que el resultado quede documentado aunque sea "no hace falta", para
  que nadie vuelva a abrir esta investigación desde cero dentro de seis meses.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un volumen sintético de **≥ 1.000 ventas** en `servicios-especiales-content`,
  When se mide el re-render con el escape hatch "Todo el historial" activo, Then queda registrado
  el tiempo medido y el nivel de **CPU throttling declarado explícitamente**.
- **AC2**: Given la medición de AC1, Then el informe concluye una de tres cosas sobre el umbral de
  300 filas: **confirmado**, **ajustado a N**, o **refutado** — con el número que la sustenta.
- **AC3**: Given el resultado de AC2, When el re-render medido se mantiene **por debajo de 200 ms**
  (frontera de "needs improvement" de INP) en el peor caso simulado, Then **no se implementa
  virtual scroll** y el track cierra documentando eso. No construir infraestructura para un
  problema que no se midió.
- **AC4**: Given que el re-render **supera** 200 ms, When se implementa, Then el historial de
  ventas queda con **techo de DOM constante**, alineado con el patrón que ya usan sus dos
  superficies hermanas: `<p-table [paginator]="true" [rows]="10">` en la vista de tabla y
  `sliceByBudget` + "Cargar más" en la vista de tarjetas. **Ambas** vistas deben quedar acotadas
  — paginar solo la tabla dejaría el costo intacto, porque las tarjetas se construyen igual
  (ver AC-E1).

  > ⚠️ **Este AC decía otra cosa hasta la medición.** Redactado antes de medir, exigía
  > `[virtualScroll]` sobre `LIST_VIRTUAL_SCROLL_THRESHOLD`. Dos datos empíricos lo tumbaron:
  > (1) el costo se reparte 50/50 entre una vista visible y otra que nadie mira (AC-E1), así que
  > virtualizar solo la tabla dejaba la mitad del problema; y (2) la vista de tarjetas no puede
  > usar `p-table [virtualScroll]` — necesitaría `cdk-virtual-scroll-viewport`, que la propia
  > investigación descartó (§3: *"el proyecto no lo usa hoy en ningún lado"*).
  >
  > La investigación (§3) había **rechazado** paginar por contradecir la UX de "ver todo lo
  > filtrado de un vistazo" (specs 0028-0031). Ese rechazo ya no describe al código: las dos
  > listas históricas hermanas (`ex-alumnos` B y Profesional) **están paginadas hoy**.
  > `servicios-especiales` es la excepción que nunca recibió ese tratamiento, no el estándar que
  > las otras abandonaron. Decisión del owner, 2026-09-01.
  >
  > Corolario: **`LIST_VIRTUAL_SCROLL_THRESHOLD` no se crea.** Un umbral configurable solo tiene
  > sentido si hay dos regímenes de render entre los cuales alternar; con techo constante no hay
  > nada que alternar. La constante habría sido una pieza de infraestructura sin usuario.
- **AC5**: Given el cierre del track, Then **ningún harness de benchmark queda en el código de
  producción** — ni ruta, ni componente, ni datos sintéticos, ni imports huérfanos.
- **AC6**: Given `ex-alumnos-content` y `ex-alumnos-profesional-content`, Then quedan documentadas
  como **fuera de riesgo con evidencia** (el paginador de 10 filas, citado con archivo y línea), no
  descartadas por asunción.

### Edge cases obligatorios

- **AC-E1**: Given las dos vistas del historial que coexisten en el DOM (§1.2), When se mide, Then
  la medición reporta el conteo **real** de nodos creados, sin asumir que la vista oculta es
  gratis.
- **AC-E2**: Given el filtro por tipo de servicio combinado con "Todo el historial", When se
  cambia el filtro, Then se mide **ese** re-render — es la interacción que recalcula
  `ventasFiltradas()` y reconstruye ambas listas, no la carga inicial.
- **AC-E3**: Given que el proyecto ya tiene `0038-b` en producción, Then la medición de la **vista
  por defecto** (12 meses) se reporta también, para dejar constancia de cuánto margen da el filtro
  que ya existe.

---

## 4. Out of scope

- Listas de **Categoría A** (instructores, secretarias, flota, mantenimientos): techo estructural
  de 10-60 filas. Decisión ya tomada en §2 de `docs/research/listas-grandes-virtual-scroll.md`.
- **`liquidaciones`**: reclasificada a Categoría A en el estrés-test — ya scopeada por mes.
- **`/admin/pagos` deudores**: ya resuelto con `.limit(200)` en `0038-b` (AC6).
- **`ex-alumnos` (Clase B y Profesional)**: fuera de riesgo por el paginador (§1.2). Se documentan
  en AC6, no se tocan.
- **Archivado de registros históricos** (mover ventas viejas a otra tabla): es una decisión de
  negocio, no de rendimiento. Fuera de alcance.

---

## 5. Notas / decisiones abiertas

1. **El resultado "no implementar" es un resultado válido y esperado**, no un fracaso del track.
   Con `0038-b` ya en producción acotando el browse a 12 meses, la probabilidad de que el
   benchmark justifique construir virtual scroll bajó respecto de cuando se escribió la
   investigación.
2. **Entorno de siembra — decisión pendiente y bloqueante.** La asignación exige
   *"dev/staging, nunca producción"*. Verificado hoy: `src/environments/environment.ts` tiene
   `production: true` y apunta a un **único** proyecto Supabase (`skvekggejikzxhzsjmkz`), que es
   además contra el que se está corriendo la UAT con el cliente. No existe un segundo proyecto
   remoto. El camino correcto es **Supabase local** (`npx supabase start`, `supabase/config.toml`
   presente), siguiendo el precedente ya establecido por `supabase/scripts/seed_dev_alumnos_*.sql`
   ("correr a mano después de `supabase start` / `supabase db reset`"). Ver riesgo en el plan:
   drift de migraciones documentado (99/139 migraciones remotas aplicadas fuera de `db push`)
   puede hacer que el esquema local no reproduzca fielmente al remoto.
3. **Hardware de referencia.** La asignación pide explícitamente *"no un dev con laptop potente"*.
   Sin acceso a una máquina de oficina real, la alternativa honesta es **CPU throttling** de
   DevTools (4×/6×) y declararlo como tal en el acceptance — nunca presentar un número de laptop
   de desarrollo como si fuera el de la secretaria.
4. **La medición correcta post-`0038-b` es el escape hatch**, no la vista por defecto (ver §1.1).
5. Originado de la Asignación `ASG-b-088` (`specs/assignments/ASG-b-088-investigacion-virtual-scroll-umbral.md`).
