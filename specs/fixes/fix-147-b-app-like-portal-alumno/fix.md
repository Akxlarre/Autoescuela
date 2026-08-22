# Fix: App-like: portal alumno (`clases`, `pagos`, `pruebas-online`, `pagar`)
> id: fix-147-b-app-like-portal-alumno
> refs: ASG-b-079
> status: in_progress
> created: 2026-08-22

## Root Cause

[Heredado de ASG-b-079, a confirmar]: Paso 12 del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`) — 4 páginas del portal alumno que hoy no siguen el patrón
app-like (fill-screen desktop / scroll interno). El portal se usa mayoritariamente en mobile,
donde el patrón no aporta, así que es prioridad menor que el resto del rollout, pero de
esfuerzo bajo-medio. `alumno/horario` y `alumno/dashboard` no entran acá — son ASG-b-070 y
ASG-b-083 respectivamente, ambas ya cerradas.

Diagnóstico por página (verificado en el audit del 2026-08-02, a re-confirmar contra el código
actual antes de tocar — precedente `fix-133-b`, donde el toolbar que describía la asignación ya
no existía en el archivo):

- **`/alumno/clases`** (`AlumnoClasesComponent`, 489 líneas): hero + selector-matrícula
  (opcional) + 1 card con TABS INTERNAS (Prácticas/Teoría, signal `activeTab`) + banner final
  condicional (probablemente empty-state).
- **`/alumno/pagos`** (`AlumnoPagosComponent`, 324 líneas): hero + selector-matrícula (opcional)
  + banner de estado (opcional, 1 de 2 variantes mutuamente excluyentes: aviso saldo pendiente
  Profesional / "matrícula al día") + "Historial de pagos" (siempre, salvo error). Mismo problema
  que `alumno/horario`: selector + banner-estado pueden coexistir = 2 filas auto antes del fill.
- **`/alumno/pruebas-online`** (`AlumnoPruebasOnlineComponent`, 204 líneas): hero + banner con
  grid anidado de `bento-square` (stats) + banner con grid anidado de `bento-wide` (lista de
  simuladores) — encaja directo como KPI-row + contenido.
- **`/alumno/pagar`** (`AlumnoPagarComponent`, 317 líneas): stepper hand-rolled (no PrimeNG),
  3 pasos (resumen de saldo, confirmación, pago Webpay). Contenido corto por paso — **posible
  exención, no implementación** (ver decisión de alcance abajo).

## ACs Afectados

Ninguno — fix autónomo (rollout de layout, no cambia contrato de negocio).

## Decisión de alcance tomada al reclamar (2026-08-22)

`/alumno/pagar` entra al track como **decisión con evidencia, no como implementación
garantizada**. Primer paso obligatorio: medir el alto real de los 3 pasos del stepper.

- Si ningún paso desborda → califica por el **criterio #1** de
  `.claude/rules/visual-system.md` §"Cuándo NO aplica el patrón" ("contenido genuinamente corto
  que nunca produce overflow"). Se deja la página sin tocar y se documenta la excepción
  justificada en `indices/APP-LIKE-ROLLOUT.md`.
- Si desborda → se le aplica el patrón full-height custom de wizard ya validado en
  `secretaria-matricula.component.scss` (`:host { display:flex }` +
  `@container layoutmain (min-width:1024px) { height: calc(100vh - Npx) }`), **no** un
  `--fill-screen-*` del canon bento.

Descartadas explícitamente: excluir `pagar` de entrada sin medir (grabaría una decisión sin
evidencia) e implementarla sí o sí (tocaría una página que quizás no lo pide).

## Cambio

**Patrón único aplicado a las 3 páginas tocadas:** root `--fill-screen-kpi --rows-fit`, un
wrapper-agrupador SIEMPRE presente en la fila 2 (los `@if` adentro) y una única celda
`.bento-fill` con su propio scroller interno. `--rows-fit` no es decorativo: sin él, el wrapper
agrupador cuando queda vacío hereda el piso `--bento-row-min` (120px) en móvil, donde no hay
`grid-template-rows` explícito, y deja una franja vacía.

### 1. `/alumno/clases`
- **Archivo:** `src/app/features/alumno/clases/alumno-clases.component.ts`
- **Incógnita heredada RESUELTA — el banner final SÍ se suma como 4ta fila.** El panel
  principal (`bento-banner card`) **no tiene `@if`**: se renderiza siempre. La alerta "Sin
  matrícula activa" (`!loading() && !facade.data()`) por lo tanto no lo reemplaza, coexiste con
  él. Confirmado leyendo el componente, no asumido.
- **Qué cambia:** root → `--fill-screen-kpi --rows-fit`. Selector-matrícula + alerta
  "Sin matrícula" agrupados en un wrapper `.bento-banner flex flex-col gap-3` siempre presente
  (la alerta **sube** por encima del panel a propósito: explica por qué el panel de abajo está
  vacío). Panel de tabs → `.bento-fill`; las tabs quedan `shrink-0` **fuera** del scroller (no
  se pierden al bajar el listado) y todo el `@if/@else if/@else` de contenido pasa a un único
  `<div class="flex-1 min-h-0 overflow-y-auto">`.

### 2. `/alumno/pagos`
- **Archivo:** `src/app/features/alumno/pagos/alumno-pagos.component.ts`
- **Qué cambia:** root → `--fill-screen-kpi --rows-fit`. Selector + banner-de-estado + banner de
  error agrupados en el wrapper siempre presente; el `@if (error) {...} @else {...}` se aplanó a
  `@if (error) … @else if (enrollment) … @else if (…)`, preservando exactamente las mismas
  condiciones. Historial → `.bento-fill` con `<h2>` `shrink-0` y scroller propio.
- **Comportamiento preservado a propósito:** el historial sigue **oculto ante error**
  (`@if (!facade.error())`). En ese estado no se renderiza celda `.bento-fill` alguna, así que
  la fila fill queda simplemente vacía — no hay nada que `contain:size` pueda colapsar.
- **Estado vacío centrado:** "Aún no se han registrado pagos" pasó a
  `flex-1 flex flex-col items-center justify-center` por la regla de `visual-system.md`
  (dentro de un `.bento-fill` la celda mide el resto del viewport y el mensaje quedaría arriba
  con un hueco enorme debajo). El skeleton se dejó alineado arriba a propósito: representa una
  lista que también empieza arriba.
- **`style="padding-bottom: 5rem"` inline eliminado del root.** No es un patrón compartido —
  existía solo en `pagos` y `pagar`, y no hay bottom-nav en `layout/` que lo justifique. Con
  `--fill-screen-kpi` el root pasa a `height: calc(100vh - 120px)` y esos 80px se comían del
  alto fijo, dejando una franja muerta al pie: exactamente lo contrario del patrón.

### 3. `/alumno/pruebas-online`
- **Archivo:** `src/app/features/alumno/pruebas-online/alumno-pruebas-online.component.ts`
- **Riesgo heredado CONFIRMADO como real, resuelto sin lógica nueva.** El banner de stats es
  `@if (!isProfessional())`: un alumno Profesional no tiene fila KPI, que es justo el caso que
  en `fix-133-b` mandaba la celda `.bento-fill` a la fila `auto` y la colapsaba a ~0px.
- **Resuelto con el wrapper siempre presente** (precedente `fix-127-b`) en vez del `computed()`
  que alterna el modificador del root (precedente `fix-133-b`). Ambos sirven; se eligió el
  wrapper porque **no introduce lógica de densidad nueva** y por lo tanto no obliga a un
  `.spec.ts` nuevo, manteniendo el checklist del rollout como estaba previsto. El `computed()`
  de `vehicle-maintenances` sigue siendo la opción correcta cuando la fila KPI depende de datos
  de red (0..N ítems); acá depende de un `computed()` estable del tipo de licencia.
- **Qué cambia:** root → `--fill-screen-kpi --rows-fit`; stats en wrapper siempre presente;
  banner de simuladores → `.bento-fill` con el grid anidado como scroller
  (`flex-1 min-h-0 overflow-y-auto`) y el encabezado `shrink-0`.

### 4. `/alumno/pagar`
- **Archivo:** `src/app/features/alumno/pagar/alumno-pagar.component.ts`
- **Qué cambia:** a determinar por medición (ver "Decisión de alcance" arriba). El resultado
  esperado por defecto es **no tocar el archivo** y documentar la excepción.
- Nota para cuando se mida: el stepper real tiene **2 nodos, no 3** (`steps()` = Resumen → Pago,
  con `facadeStep` 1 y 3). La descripción heredada de "3 pasos" viene del audit; el paso 2 ya no
  existe desde fix-017 (las 12 clases se agendan en la matrícula, el alumno no elige horarios).

## Test de Regresión

### Verificado ✅

- [x] **Sin `.spec.ts` nuevo** — el wrapper-siempre-presente resuelve el colapso de
      `pruebas-online` sin introducir lógica de densidad, así que no hay decisión nueva que
      testear (ver §Cambio 3 para por qué se prefirió al `computed()` de `fix-133-b`).
- [x] `npx tsc --noEmit` — exit 0, sin errores.
- [x] `npm run test:ci` — **177 test files, 2210 tests, 0 fallos** (2 files / 5 tests skipped,
      preexistentes).
- [x] `npm run lint:arch` — exit 0, 0 errores. Los warnings son **byte-idénticos** a los del
      baseline sin este cambio, comprobado stasheando los 3 archivos y difeando el conteo por
      regla. En particular **ARCH-19 (9 casos vs cuota 7) es deuda preexistente, no de este
      fix** — su ejemplo vive en `matricula-steps/confirmation`, que este track no toca.
- [x] **Compilación real de los 3 templates en el dev server** (`ng serve`, Angular 21/Vite).
      Vale la pena registrarlo porque **`tsc --noEmit` NO valida templates de Angular**: un
      estado intermedio de `alumno-clases` disparó `NG5002: Unexpected closing tag "section"`
      visible solo en el navegador. Tras el rebuild el error desaparece y el balance del
      template es 31/31 `<div>` y 1/1 `<section>`. Lección: en este rollout, `tsc` verde no
      es evidencia de que el template compile.

### 🚫 BLOQUEADO por la red del entorno — pendiente de correr en una máquina con acceso

El `/verify` real y la medición de `pagar` **no se pudieron ejecutar en el contenedor remoto**:
el navegador resuelve `https://skvekggejikzxhzsjmkz.supabase.co/auth/v1/token` con
`net::ERR_TUNNEL_CONNECTION_FAILED` (política de red del sandbox). Sin login no hay sesión, y
todo `/app/**` está detrás del guard de autenticación.

Lo que quedó fuera de alcance verificable acá — **no asumir ninguno como cumplido**:

- [ ] `/verify` en 390×844, 1440×900 y 1440×768, en las 3 páginas tocadas
- [ ] `documentScrolls: false` en desktop y alto real (>0px, no colapsada) de cada `.bento-fill`
- [ ] El caso que motivó el wrapper en `pruebas-online`: alumno **Profesional** (sin fila de
      stats) — confirmar que los simuladores caen igual en la fila fill y no se colapsan
- [ ] El caso equivalente en `clases`: alumno **sin matrícula** (alerta + panel coexistiendo)
- [ ] `force-compact` con drawer abierto — ⚠️ ojo: ninguna de las 3 páginas inyecta
      `LayoutDrawerFacadeService` hoy, igual que `alumno/horario` (`fix-127-b`), así que
      probablemente este ítem del checklist **no aplique al portal alumno**. Confirmar en vez
      de agregar el binding a ciegas.
- [ ] **Medir el alto real de los 2 pasos de `/alumno/pagar`** y recién ahí decidir
      implementación vs excepción (§Decisión de alcance). Sigue abierta.
- [ ] Si `pagar` queda exenta: documentar la excepción en `indices/APP-LIKE-ROLLOUT.md` con el
      criterio (#1) y la medición que la justifica.

**Este fix NO debe cerrarse con `/fix-close` hasta completar esa lista.**

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas de las 4 páginas, sección "Alumno" (líneas 106-111);
  paso 12 del orden de rollout
- `.claude/rules/visual-system.md` §"Patrón App-like" y §"Cuándo NO aplica el patrón"
- `specs/fixes/fix-127-b-app-like-familia-horario/fix.md` — precedente del wrapper-agrupador
  (aplica a `pagos`)
- `specs/fixes/fix-133-b-app-like-piezas-sueltas/fix.md` — precedente del colapso por
  auto-placement con 0 ítems en la fila KPI (aplica a `pruebas-online`)
- Originado de Asignación ASG-b-079 (`specs/assignments/ASG-b-079-app-like-portal-alumno.md`)
