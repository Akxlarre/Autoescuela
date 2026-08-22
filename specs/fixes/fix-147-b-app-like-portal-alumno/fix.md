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

<!-- A completar durante la implementación, una entrada por página tocada. -->

### 1. `/alumno/clases`
- **Archivo:** `src/app/features/alumno/clases/alumno-clases.component.ts`
- **Plan heredado:** `--fill-screen-kpi` — hero=auto, selector=auto, card-de-tabs=fill
  (`bento-fill flex flex-col h-full`).
- **A verificar al implementar:** si el banner final (≈línea 265 del componente actual) es
  mutuamente excluyente con el contenido o se suma como 4ta fila. Si se suma, agrupar en un
  wrapper único como en `alumno/horario`.
- **Parte no mecánica del track:** es la única de las 4 con tabs internas dentro de la celda que
  crece. La combinación tabs + `.bento-fill` + scroll interno es lo que hay que resolver bien;
  el resto es portar patrón conocido.

### 2. `/alumno/pagos`
- **Archivo:** `src/app/features/alumno/pagos/alumno-pagos.component.ts`
- **Plan heredado:** agrupar selector-matrícula + banner-de-estado en un wrapper único (para que
  sean siempre 1 sola fila auto, con los `@if` adentro), historial-de-pagos como única celda
  `.bento-fill` en `--fill-screen-kpi`.
- **Precedente a copiar literal:** el wrapper-agrupador de
  `fix-127-b-app-like-familia-horario` (ASG-b-070) — mismo problema de N filas auto variables
  antes del fill. No rediseñarlo.

### 3. `/alumno/pruebas-online`
- **Archivo:** `src/app/features/alumno/pruebas-online/alumno-pruebas-online.component.ts`
- **Plan heredado:** `--fill-screen-kpi` — banner de stats=auto (fila KPI), banner de
  simuladores=fill.
- **Riesgo conocido (precedente `fix-133-b`):** si el grid de stats puede venir con 0 ítems, el
  auto-placement de CSS Grid ubica el contenido en la fila `auto` en vez de la `fill` y
  `.bento-fill` lo colapsa a ~0px con `contain:size`. Verificar el caso 0 y, si existe, alternar
  el modificador del root vía `computed()` como en `vehicle-maintenances`.

### 4. `/alumno/pagar`
- **Archivo:** `src/app/features/alumno/pagar/alumno-pagar.component.ts`
- **Qué cambia:** a determinar por medición (ver "Decisión de alcance" arriba). El resultado
  esperado por defecto es **no tocar el archivo** y documentar la excepción.

## Test de Regresión

<!-- A completar. Checklist de cierre heredado del rollout app-like (aplica a las 4): -->

- [ ] `force-compact` verificado con drawer abierto en cada página que sí se toque
- [ ] Sin `.spec.ts` nuevo obligatorio — salvo que aparezca lógica de densidad nueva (ej. el
      `computed()` que alterna el modificador del root en el caso "0 stats" de `pruebas-online`)
- [ ] `npx tsc --noEmit` sin errores
- [ ] `npm run test:ci` sin fallos
- [ ] `npm run lint:arch` exit 0
- [ ] `/verify` en 390×844, 1440×900 y 1440×768, cada página tocada
- [ ] Si `pagar` queda exenta: excepción documentada en `indices/APP-LIKE-ROLLOUT.md` con el
      criterio (#1) y la medición que la justifica

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas de las 4 páginas, sección "Alumno" (líneas 106-111);
  paso 12 del orden de rollout
- `.claude/rules/visual-system.md` §"Patrón App-like" y §"Cuándo NO aplica el patrón"
- `specs/fixes/fix-127-b-app-like-familia-horario/fix.md` — precedente del wrapper-agrupador
  (aplica a `pagos`)
- `specs/fixes/fix-133-b-app-like-piezas-sueltas/fix.md` — precedente del colapso por
  auto-placement con 0 ítems en la fila KPI (aplica a `pruebas-online`)
- Originado de Asignación ASG-b-079 (`specs/assignments/ASG-b-079-app-like-portal-alumno.md`)
