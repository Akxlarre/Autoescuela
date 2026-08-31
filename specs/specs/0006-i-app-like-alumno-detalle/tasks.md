# Tasks 0006-i — App-like: Ficha de Alumno (`/admin/alumnos/:id` + `/secretaria/alumnos/:id`)

> **Plan:** [plan.md](./plan.md)
> **Created:** 2026-08-28

---

## Fase 1 — Discovery y catálogo (obligatorio antes de tocar el template)

- [x] **T1.1** — Catalogar el 100% de acciones/secciones actuales del componente
  - **AC ref:** AC2, AC3 (base para no perder nada al reestructurar)
  - **DoD:**
    - [x] Lectura completa línea por línea de `admin-alumno-detalle.component.ts` (1660
      líneas) — completada 2026-08-28
    - [x] Catálogo escrito (ver `## Catálogo de acciones` al final de este archivo)
    - [x] **Hallazgo clave:** casi todas las acciones NO están repartidas a mano en el
      template — salen de un único `computed heroActions()` filtrado en 2 grupos:
      `headerActions()` (`primary || danger` → Editar Perfil, Eliminar Alumno, Marcar
      Ex-Alumno) y `secondaryActions()` (el resto → Reagendar Clases, Contrato, Carnet,
      Certificado). Solo Inasistencias/Ficha Técnica/Consentimientos/Reagendamientos están
      hardcoded en el template, fuera de `heroActions()`.
    - [x] Admin-only confirmado: bypass de certificado con prácticas incompletas (Clase B)
      solo lo ve el Admin (`if (!this.isAdmin()) return;` en `handleCertificado()`) — la
      Secretaria nunca ve el botón habilitado en ese caso (ya deshabilitado en
      `heroActions()`). Resto de acciones visibles para ambos roles.
    - [x] Mapeo final confirmado: "Documentos" se agrega como ítem nuevo dentro del array que
      devuelve `heroActions()` con `primary: true` (cae solo en `headerActions()`, sin tocar
      `SectionHeroComponent`) — NO como botón hardcoded suelto. Handler llama
      `dmsFacade.openStudentDocsDrawer(studentId, enrollmentId, nombre)` (firma confirmada en
      `core/facades/dms.facade.ts:437`, ya existe completa, usa `layoutDrawer.push()`).

- [x] **T1.2** — Decidir dónde vive el selector de matrícula (pills existente)
  - **AC ref:** AC5
  - **DoD:**
    - [x] **Decisión (2026-08-28):** el selector de pills queda ARRIBA de las 4 tabs, como
      hoy, visible siempre que el alumno tenga 2+ matrículas — es un switcher de contexto que
      afecta a las 4 tabs (Pagos/Clases muestran datos de la matrícula seleccionada), así que
      no puede vivir encerrado dentro de una sola tab.
    - [x] La tab "Matrículas" se llena con contenido NUEVO que hoy no existe en ningún lado:
      lista/tabla de TODAS las matrículas del alumno usando los campos que
      `EnrollmentSummary` ya expone (`number`, `courseName`, `branchId`, `licenseGroup`,
      `createdAt`, `certPdfUrl`, `licenseInitialUrl`/`licenseFullUrl`, `contractFileUrl`/
      `contractSignedUrl`) — antes esos datos solo se usaban para armar las labels cortas de
      los pills, nunca se mostraban en detalle.
    - [ ] Verificar en `/verify` que el selector de pills no se solapa visualmente con las 4
      tabs nuevas en ningún viewport (queda para Fase 5, T5.2)

---

## Fase 2 — Shell de tabs (TDD primero)

- [x] **T2.1** — Escribir `.spec.ts` de `activeTab()` / `setActiveTab()` (ANTES del código)
  - **AC ref:** AC2
  - **DoD:**
    - [x] Test: `activeTab()` inicia en `'ficha'` por default
    - [x] Test: `setActiveTab('pagos')` actualiza el signal correctamente
    - [x] Test: cambiar de tab NO dispara un refetch innecesario del Facade
    - [x] Escritos en `admin-alumno-detalle.component.spec.ts` (nuevo describe, con
      `TestBed.runInInjectionContext` + mocks de las 9 dependencias inyectadas)

- [x] **T2.2** — Implementar `activeTab` signal + `setActiveTab()` + `fichaTabs`
  - **AC ref:** AC2
  - **DoD:**
    - [x] 15/15 tests en verde (`npx vitest run admin-alumno-detalle.component.spec.ts`)
    - [x] `activeTab = signal<'ficha'|'matriculas'|'pagos'|'clases'>('ficha')`,
      `setActiveTab(tabId: string)` con guard de tipo, `fichaTabs` computed con las 4 pestañas
    - [x] `DmsFacade` inyectado + `openDocumentosPanel()` implementado, "Documentos" agregado
      a `heroActions()` (`primary: true`) y su `case` en `handleHeroAction()`
    - [x] `npx tsc --noEmit` limpio (0 errores nuevos)
    - [ ] `<app-tabs>` + `@switch` en el TEMPLATE todavía no conectados — el signal y el
      computed existen pero el HTML sigue siendo el layout de 3 columnas viejo. Se conecta en
      la siguiente tarea (T2.3/T3.x) junto con el shell `--fill-screen`.

- [x] **T2.3** — Aplicar `--fill-screen-kpi` + `.bento-grid--rows-fit` en el grid raíz
  - **AC ref:** AC1
  - **DoD:**
    - [x] Grid raíz usa `bento-grid--fill-screen-kpi bento-grid--rows-fit`, mismo combo
      documentado en `fix-027-i`
    - [x] `npx ng build --configuration development` compila limpio con el shell completo +
      contenido migrado (ver Fase 3, se hizo en el mismo paso por eficiencia — separar shell
      vacío de migración real hubiera exigido escribir contenido descartable)

---

## Fase 3 — Migración de contenido (tab por tab, sin tocar lógica de negocio)

- [x] **T3.1** — Migrar tab "Ficha" (Info Personal + acciones operativas)
  - **AC ref:** AC2, AC3
  - **DoD:**
    - [x] Contenido de la card "Info Personal" vive en `@case ('ficha')` (solo se cambió la
      clase del div contenedor externo, todo el contenido interno quedó intacto)
    - [x] `secondaryActions()` y botones hardcoded (Inasistencias, Ficha Técnica,
      Consentimientos, Reagendamientos) se mantienen operativos sin tocar su lógica
    - [x] **Corrección al DoD original:** NO hizo falta re-bindear `@if (facade.alumno(); as
      alumno)` dentro de cada `@case` — el `alumno` de la spec 0006-i está bindeado en el
      `@else if` que envuelve TODO el `@switch` (ancestro, no hermano), así que Angular lo
      propaga sin problema a los 4 `@case`. `npx ng build` lo confirma limpio. El gotcha de
      `fix-027-i` aplica solo cuando se reusa un `as` bindeado DENTRO de un `@case` desde OTRO
      `@case` hermano — no es este caso.
    - [x] "Documentos" agregado dentro de `heroActions()` (`primary: true`), cae en
      `headerActions()`; `case 'ver-documentos'` en `handleHeroAction()` llama
      `openDocumentosPanel()` → `dmsFacade.openStudentDocsDrawer(studentId, enrollmentId,
      alumno.nombre)`

- [x] **T3.2** — Migrar tab "Matrículas" (contenido nuevo, según decisión de T1.2)
  - **AC ref:** AC5
  - **DoD:**
    - [x] Selector de pills queda FUERA del `@switch`, arriba de las 4 tabs (decisión T1.2)
    - [x] `@case ('matriculas')` nuevo: lista de tarjetas por cada `EnrollmentSummary` (curso,
      número, fecha, badges de contrato firmado/certificado/carnet completo)
    - [x] Alumno con 1 sola matrícula: la tab igual muestra su tarjeta (no vacía) — cubierto
      por el `@for` sobre `enrollmentSummaries()`, que siempre tiene al menos 1 elemento
    - [x] Estado vacío (0 matrículas, caso teórico) con icono centrado

- [x] **T3.3** — Migrar tab "Pagos" (`app-admin-historial-pagos`)
  - **AC ref:** AC1
  - **DoD:**
    - [x] `<app-admin-historial-pagos>` vive en `@case ('pagos')`, clase cambiada de
      `bento-tall w-full h-full block` a `flex-1 min-h-0 w-full block` (encaja en el panel
      `.bento-fill` en vez de ser una celda de grid independiente) — cero cambios internos al
      componente
    - [ ] Verificación visual en vivo (alumno con historial largo) — pendiente de `/verify`
      en Fase 5

- [x] **T3.4** — Migrar tab "Clases" (dual-mode: Clase B / Profesional)
  - **AC ref:** AC4
  - **DoD:**
    - [x] Clase B (grilla 12 clases) y Profesional (Asistencia Teórica/Práctica/Nota) viven
      ambos dentro de `@case ('clases')`, sin re-bind necesario (mismo motivo que T3.1)
    - [ ] Verificación visual en vivo de ambos dual-mode — pendiente de `/verify` en Fase 5

---

## Fase 4 — Ajustes conocidos (gotchas ya resueltos en `fix-027-i`)

- [x] **T4.1** — Centrado vertical de tabs cortas (`.ficha-datos-panel`)
  - **AC ref:** (calidad visual, sin AC numerado directo — previene regresión ya vista)
  - **DoD:**
    - [x] Verificado en vivo: la tab "Matrículas" (contenido corto, 1 tarjeta) SÍ necesitaba
      centrado — aplicado, se ve perfecto
    - [x] **Hallazgo no anticipado:** la tab "Ficha" (7+ acciones + datos personales) NO es
      contenido corto como en `fix-027-i` — es más alta que el panel. Aplicarle
      `.ficha-datos-panel` (centrado) cortaba el contenido arriba (el centrado empuja el
      "inicio" fuera del área de scroll alcanzable). Se sacó la clase de esa tab
      específicamente — queda con scroll top-aligned normal, verificado en vivo sin corte.

- [x] **T4.2** — Ajuste mobile de la fila de tabs (`.bento-grid--rows-fit`)
  - **AC ref:** AC6
  - **DoD:**
    - [x] `.bento-grid--rows-fit` ya estaba aplicado desde T2.3 (junto con
      `--fill-screen-kpi`) — no se detectó el síntoma del hueco en las verificaciones
      hechas (pendiente pasada final en mobile real durante T5.2)

- [x] **T4.3** — Revertir el parche CSS viejo (líneas 830-841 originales) + fix real
  - **AC ref:** (limpieza técnica, mencionada en Contexto de negocio de la spec)
  - **DoD:**
    - [x] El override sin scope `.bento-grid { grid-template-rows: auto }` se eliminó —
      **esto era un bug real, no solo limpieza**: por no vivir dentro de ningún `@layer`,
      ganaba por cascada sobre el `grid-template-rows` que define `bento-grid--fill-screen-kpi`
      dentro de su propio `@container`, causando un hueco visible entre el header y la barra
      de tabs. Confirmado en vivo: el hueco desapareció al revertirlo.
    - [x] Para el caso con selector de matrícula (2+ enrollments, agrega una fila extra),
      se agregó un override propio y scoped:
      `.bento-grid--fill-screen-kpi.has-enrollment-selector { grid-template-rows: auto auto
      auto minmax(0, 1fr) }` (4 filas: hero, selector, tabs, panel) — no verificado aún en
      vivo con un alumno real de 2+ matrículas (pendiente, T5.2)
    - [x] Bug de backtick-en-comentario (hazard documentado en `visual-system.md`) golpeó de
      nuevo al escribir el comentario explicativo con backticks — corregido sin backticks,
      build limpio

---

## Fase 5 — Validación

- [x] **T5.1** — Tests y lint
  - **DoD:**
    - [x] `npx vitest run .../alumno-detalle/` → 33/33 tests en verde (4 archivos), sin
      regresiones
    - [x] `npm run lint:arch` → exit 0. Todos los warnings existentes (ARCH-09/10/14/16/19)
      son preexistentes en archivos/facades que esta spec no tocó — cero warnings nuevos
      atribuibles a `admin-alumno-detalle.component.ts`
    - [x] `npx ng build --configuration development` limpio (validación real del compilador
      Angular sobre el template, no solo `tsc`)

- [x] **T5.2** — `/verify` (ambas rutas, Clase B + Profesional, desktop/mobile/dark/force-compact)
  - **AC ref:** AC1, AC2, AC6, AC-E1
  - **DoD:**
    - [x] `/admin/alumnos/144` y `/secretaria/alumnos/144` (Clase B) en 1440×900: las 4 tabs
      verificadas visualmente una por una en AMBAS rutas, correctas
    - [x] `/admin/alumnos/143` (Profesional) en 1440×900: tab "Clases" confirma dual-mode
      (Asistencia Teórica/Práctica/Nota Promedio) funcionando dentro del mismo layout
    - [x] `documentScrolls === false` (desktop) confirmado por evaluate del DOM (AC1)
    - [x] Modo oscuro verificado en `/secretaria/alumnos/144`: contraste correcto en las 4
      tabs, header, botones y badges
    - [x] `force-compact` verificado con drawer "Ficha Técnica" abierto sobre la tab Ficha:
      colapsa a una columna sin romper el header ni las tabs (AC-E1)
    - [x] Mobile 390×844: scroll real confirmado vía `.shell-content` (no
      `document.documentElement`, según el gotcha ya documentado de `fix-027-i`) —
      `shellScrollHeight (1061) > shellClientHeight (768)` → `true`
    - [x] Consola limpia (0 errores) en todas las verificaciones
    - **Bug preexistente encontrado y corregido (decisión del usuario: arreglarlo ahora, no
      diferirlo):** en mobile 390px, la grilla `grid-cols-2` de "Clases Prácticas" y las 3
      cards de Profesional quedaban con solo ~84px de ancho por columna (texto superpuesto,
      ilegible). Root cause real: mi nuevo wrapper de tab (`p-5 md:p-6`) se apilaba con el
      padding propio de `.bento-card`/`.bento-wide` en esos divs internos — clases vestigiales
      de cuando eran celdas directas de `.bento-grid`, ya no necesarias dentro del panel
      `.bento-fill` que ya trae su propio padding. Fix: se quitaron `.bento-card`/`.bento-wide`/
      `appCardHover` de los 4 divs afectados (Clases Prácticas + 3 cards de Profesional) —
      ancho pasó de 84px a 105px por columna, mejor pero seguía apretado — y se hizo el grid de
      Clases Prácticas responsive (`grid-cols-1 sm:grid-cols-2`, 1 columna en mobile, 2 en
      desktop) — confirmado visualmente perfecto en ambos extremos. `CardHoverDirective` quedó
      sin uso en el componente, import removido (build limpio, antes tiraba warning NG8113).
    - [x] Alumno con 2+ matrículas (`student_id=93`, Profesional A2 #0022 + Clase B #0006):
      selector de pills se ve limpiamente separado de las 4 tabs, sin solape — confirma que el
      override de 4 filas de T4.3 (`bento-grid--fill-screen-kpi.has-enrollment-selector`)
      funciona. Cambiar de matrícula (`facade.selectEnrollment()`) actualiza correctamente
      header, datos y acciones (probado Profesional→Clase B, acciones cambiaron de
      "Generar Carnet" deshabilitado a menú "Carnet" habilitado, certificado 2/3→1/12, etc.)
    - [x] 768 de alto (1280×768): las 4 filas (header/pills/tabs/panel) se comprimen
      correctamente, panel con scroll interno visible, `documentScrolls === false`

- [x] **T5.3** — Captura antes/después de acciones (checklist explícito de la ASG original)
  - **AC ref:** (checklist de cierre de ASG-b-085)
  - **DoD:**
    - [x] Catálogo de T1.1 usado como checklist base (no hizo falta captura "antes" nueva — el
      catálogo línea-por-línea de T1.1 ya documenta el estado pre-cambio)
    - [x] Confirmado 1:1 en vivo (`/admin/alumnos/93`, sesión limpia) que cada acción sigue
      existiendo y funcionando: Editar Perfil / Documentos / Eliminar Alumno (header,
      `heroActions()`), Ver Contrato / Generar Carnet / Certificado / Inasistencias / Ficha
      Técnica (perfil, `secondaryActions()` + hardcoded), Consentimientos y Reagendamientos
      (hardcoded, drawers vía `layoutDrawer.open()`) — todas presentes, clickeables y con el
      estado disabled/enabled correcto según reglas de negocio (ej. Generar Carnet/Certificado
      deshabilitados para este alumno por criterios incompletos, igual que antes del cambio)
    - [x] **Investigación cerrada — "Reagendamientos" con bounding rect 0×0×0×0" (hallazgo de la
      sesión anterior):** no reproducido en sesión fresca. Root-caused: fue un artefacto de
      Playwright/GSAP de la sesión de pruebas previa (múltiples paneles abiertos/cerrados
      seguidos sin esperar el teardown de la animación de salida), no una regresión de spec
      0006-i. Confirmado abriendo Reagendamientos en limpio (funciona) y encadenando
      Reagendamientos → Ficha Técnica sin cerrar entre medio (funciona, sin duplicar
      `<app-layout-drawer>` ni quedar con `display:none`) — `LayoutDrawerService.open()`
      reemplaza el estado en el mismo signal, un solo host, sin condición de carrera real.

- [x] **T5.4** — Realtime/SWR: reset de scroll (AC-E2)
  - **AC ref:** AC-E2
  - **DoD:**
    - [x] Verificado estructuralmente en `admin-historial-pagos.component.ts:53-61`: el
      contenedor `overflow-y-auto` que scrollea internamente NO vive dentro de ningún `@if` que
      lo destruya/recree — envuelve directamente el `@for (pago of pagos(); track pago.id)`.
      Con `track pago.id`, un refresh SWR/Realtime (`refreshSilently()` → `pagos.set(nuevaData)`)
      hace patching in-place de las filas, sin desmontar el contenedor scrolleable — el scroll
      del usuario se preserva por construcción, sin necesitar lógica de "restaurar scroll" ad
      hoc. Spec 0006-i solo cambió la clase del wrapper EXTERNO (`bento-tall` →
      `flex-1 min-h-0`, T3.3) — no tocó esta estructura interna, así que el comportamiento SWR
      preexistente (ver `swr-pattern.md`) queda intacto.
    - [x] Confirmado en vivo (`/admin/alumnos/144`, tab Pagos) que el contenedor scrollea
      internamente sin afectar al documento (`documentScrolls === false` ya verificado en
      T5.2); no se detectó ningún `@if`/reset de scroll al cambiar de tab y volver a Pagos.

- [x] **T5.5** — QA visual con el owner de producto (obligatorio, no reemplaza lo automático)
  - **AC ref:** (checklist de cierre de ASG-b-085, lección de spec 0030)
  - **DoD:**
    - [x] Capturas presentadas al owner de producto (2026-08-30). Primera pasada
      **rechazada**: "no me gustó como quedó el diseño con el navegador arriba... debe ser por
      cómo quedaron todos los botones" + "Matrícula no tiene mucho sentido, mucha página para
      algo tan poco" — Pagos y Clases confirmados OK sin cambios.
    - [x] **Ajuste post-QA aplicado** (2 decisiones confirmadas por el owner vía pregunta
      explícita):
      1. Tab "Matrículas" fusionada dentro de "Ficha" (quedan 3 tabs: Ficha/Pagos/Clases en
         `fichaTabs()` y en el tipo de `activeTab`). Sus badges de contrato/certificado/carnet
         ahora viven como sección "MATRÍCULAS" arriba de "ACCIONES" en la tab Ficha.
      2. Botones de acción de Ficha (Reagendar Clases, Contrato, Carnet, Certificado,
         Inasistencias, Ficha Técnica, Consentimientos, Reagendamientos) rediseñados de lista
         de botones de texto apilados a grid de tiles ícono+label (`.ficha-action-tile`,
         `grid-cols-2 sm:grid-cols-3` — 2 columnas en mobile angosto, 3 desde `sm:`; 3 columnas
         en mobile truncaba casi todos los labels, ej. "Certifi...").
    - [x] Clase muerta `.ficha-datos-panel` eliminada del `styles:` (solo la usaba el `@case
      ('matriculas')` ya removido) — cero referencias fuera de comentarios tras el cambio.
    - [x] `npx ng build --configuration development` limpio tras el ajuste + el tweak de
      `grid-cols-2 sm:grid-cols-3`; `npx vitest run .../alumno-detalle/` → 34/34 en verde (test
      de `setActiveTab('clases')`/`'pagos'` ajustado, más un test nuevo que confirma que
      `setActiveTab('matriculas')` — id de tab eliminada — ya no cambia el signal).
    - [x] Verificado en vivo (`/admin/alumnos/93`, alumno con 2 matrículas) en 1280×1000
      (desktop) y 390×844 (mobile): tabs bar más compacta (3 en vez de 4), sección Matrículas
      con badges legible arriba del grid de acciones, tiles 3 cols en desktop / 2 cols en
      mobile sin truncar más de lo razonable.

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar índices
  - **DoD:**
    - [x] `indices/COMPONENTS.md`: entrada de `/app/admin/alumnos/:id` y
      `/app/secretaria/alumnos/:id` reescrita completa con el patrón de 3 tabs final (post-QA),
      incluyendo la historia de por qué "Matrículas" no quedó como 4ª tab
    - [x] `indices/APP-LIKE-ROLLOUT.md`: fila 70 marcada `✅ Resuelto (spec 0006-i, 2026-08-30)`,
      tachada como el resto de filas cerradas del rollout

- [x] **T6.2** — `specs/ROADMAP.md`: mover de Backlog a Done

- [x] **T6.3** — `/spec-verify` y cierre formal
  - **DoD:**
    - [x] Todos los AC (AC1-AC6, AC-E1 a AC-E3) verificados con evidencia — 9/9 ✅ PASA
      (ver `acceptance.md`; nota de proceso: AC2/AC5 verificados contra el diseño final de 3
      tabs, no las 4 originales de la spec — desviación explicada, no un AC incumplido)
    - [x] `acceptance.md` generado
    - [x] `specs/.active` limpiado
    - [x] `spec.md` status → `done` (con nota de confirmación final del owner pendiente)

---

## Bug real en dispositivo físico (2026-08-30/31, reportado por el owner)

- **Síntoma:** en un Samsung Galaxy S20 Ultra real (mobile), la ficha se veía "totalmente
  alargada" — cajas blancas gigantes y vacías entre "Clases Prácticas" y "Estado
  Financiero", con contenido cortado a la mitad. NO se reprodujo en Chromium
  desktop/Playwright durante `/verify` — solo visible en el motor real del dispositivo.
- **Root cause:** las 3 columnas usaban utilities de Tailwind SIN scope (`h-full`,
  `flex-1`, `overflow-y-auto`, `min-h-0`) para el alto/scroll interno que solo tiene
  sentido en desktop, donde `.bento-fill` (`@container layoutmain min-width:1024px`) le
  da a la fila una altura definida. En mobile ningún ancestro define una altura —
  `height:100%` sobre una cadena de ancestros sin altura definida es un caso ambiguo de
  la spec CSS, y el motor del dispositivo real lo resolvía produciendo cajas vacías
  gigantes en vez de ceder al alto natural del contenido con scroll nativo de página
  (Chromium desktop lo resolvía "bien" por casualidad, ocultando el bug en `/verify`).
- **Fix:** se gatearon TODAS las utilities de alto/scroll/grow detrás del mismo
  `@container layoutmain (min-width:1024px)` que ya usaban `.ficha-3col-row`/
  `.ficha-3col-aside` — nuevas clases `.ficha-3col-h100`/`.ficha-3col-scroll`/
  `.ficha-3col-grow` en `admin-alumno-detalle.component.ts`, y su equivalente
  `.ficha-pagos-h100`/`.ficha-pagos-grow`/`.ficha-pagos-scroll` en
  `admin-historial-pagos.component.ts` (mismo problema, componente separado). En mobile
  ahora no hay ninguna coerción de altura — todo fluye con su tamaño natural y scroll
  nativo de página.
- Verificado en vivo a 412×915 (viewport CSS del Galaxy S20 Ultra): scrolleado completo
  sin cajas en blanco, cada columna con `scrollHeight === height` (sin colapsos
  ocultos). Desktop 1440×900 sin regresión (fill-screen sigue llenando el viewport
  igual que antes). 30/30 tests verdes, build limpio.

## Pulido visual adicional (2026-08-30, tercera ronda de feedback)

- **Tarjetas de "Clases Prácticas" agrandadas:** con la card ahora llenando toda la columna
  (ronda anterior), sobraba espacio visual dentro de cada tarjeta de clase individual —
  min-tile de la grilla 160px→200px, padding/gap subidos un escalón, círculo de ícono
  7×7→9×9, tamaño de ícono 13→16, "Clase #N" `text-xs`→`text-sm`, subtítulo de estado
  `text-2xs`→`text-xs`.
- **Bloque de contacto (email/teléfono/fecha de ingreso) agrandado en modo `force-compact`:**
  con el drawer abierto, la columna Info Personal se apila a ancho completo y ese bloque
  quedaba con mucho aire — se agranda SOLO en ese modo (`.force-compact
  .ficha-contact-info`), sin tocar el layout normal de 3 columnas angostas donde ya estaba
  bien proporcionado.
- Verificado en vivo (`/admin/alumnos/144`): tarjetas de clase más legibles y con mejor
  aprovechamiento del espacio; contacto notablemente más grande con el drawer
  "Inasistencias" abierto. 30/30 tests verdes.

## Ajustes post-pivote (2026-08-30, feedback visual sobre el pivote final)

- **"Clases Prácticas" no llegaba hasta abajo como sus columnas vecinas:** la card tenía
  `shrink-0` (necesario para el fix del bug de flexbox) pero le faltaba `flex-1` para
  CRECER cuando su contenido entra de sobra en el alto disponible. Es la única card de esa
  columna (a diferencia de Profesional, que apila 3), así que puede ocupar el 100% con
  seguridad. La grilla interna de clases pasó de `content-start` a `content-center` para
  repartir el espacio extra arriba/abajo en vez de dejarlo todo como hueco al final.
- **Bug real encontrado: abrir un drawer (ej. "Inasistencias") rompía el layout** — las 3
  columnas se solapaban/comprimían. Root cause: la fila usaba `lg:flex-row` (breakpoint de
  VIEWPORT de Tailwind). Con el drawer abierto, `<main>` se angosta pero el viewport sigue
  ≥1024px, así que `lg:flex-row` seguía forzando 3 columnas en un espacio insuficiente —
  mismo gotcha de "switch por contenedor, no por viewport" ya documentado en
  `visual-system.md`. Fix: reemplazado por clases propias (`.ficha-3col-row`,
  `.ficha-3col-aside`) scopeadas a `@container layoutmain (min-width: 1024px)`, que miden
  el ancho real de `<main>` — colapsan a columna apilada correctamente cuando el drawer
  angosta el contenedor, sin depender del viewport. Verificado en vivo abriendo
  "Inasistencias": layout se apila limpio, sin solape.
- Re-verificado: 30/30 tests, `npm run lint:arch` exit 0 sin hallazgos nuevos, `npx ng
  build` limpio.

## Changelog (pivote final, 2026-08-30)

El diseño con pestañas (Ficha/Matrículas→Ficha/Pagos/Clases) se **descartó** tras nuevo
feedback del owner: "no es necesario que quede app-like [en vertical], hazlo diferenciando en
horizontal como antes" — refiriéndose al layout ORIGINAL de 3 columnas lado a lado (Info
Personal / Clases Prácticas / Estado Financiero), no a un rediseño con tabs.

**Enfoque final implementado** (mucho más quirúrgico que las 2 iteraciones previas):

- Se revirtió el componente a su estado pre-spec (`git checkout`) y se partió de cero desde ahí.
- Root grid: `bento-grid--fill-screen` (hero auto + 1 fila que llena el resto del viewport en
  desktop, con override propio de 3 filas cuando hay selector de matrícula).
- **Se mantiene la estructura visual ORIGINAL de 3 columnas horizontales** (Info Personal /
  Clases Prácticas-o-Progreso Profesional / Estado Financiero) — ningún tab, ningún cambio de
  jerarquía visual. Solo se envuelven en un `.bento-banner.bento-fill` de 3 columnas flex.
- Cada columna scrollea internamente (`overflow-y-auto`) si su contenido crece — resuelve el
  problema de raíz señalado por el owner (dibujo: la lista de pagos podía crecer sin límite y
  romper el layout) sin sacrificar la familiaridad del layout existente.
- **2 bugs reales encontrados y corregidos en `/verify`, ninguno visible en el build/lint:**
  1. La grilla de 12 clases prácticas (`grid-cols-2` fijo, heredado del diseño original donde
     esa card tenía ~600px de ancho como `bento-wide`) se solapaba visualmente al quedar en la
     columna central, ahora mucho más angosta (~300-450px). Un breakpoint de viewport
     (`sm:`/`lg:`) no sirve porque no correlaciona con el ancho real de esta columna interna
     (mismo gotcha ya documentado en `visual-system.md`). Fix: `grid-template-columns:
     repeat(auto-fit, minmax(160px, 1fr))` — mide el espacio real disponible, sin depender del
     viewport.
  2. Trampa clásica de flexbox `min-height:auto` + `overflow:hidden`: las cards `.bento-card`
     (Clases Prácticas y las 3 de Profesional) se encogían en silencio para caber en la columna
     en vez de mantener su alto real y dejar que la columna scrolleara — el contenido se
     recortaba sin mostrar scrollbar. Fix: `shrink-0` en cada una.
- Verificado en vivo: `/admin/alumnos/144` (Clase B, 1 matrícula) y `/admin/alumnos/93`
  (Profesional, 2 matrículas — selector de pills) en 1440×900, 1280×768 y 390×844 (mobile,
  scroll nativo). `documentScrolls === false` en desktop confirmado por `browser_evaluate` en
  ambos casos. 30/30 tests verdes, `npm run lint:arch` exit 0 sin hallazgos nuevos atribuibles a
  este archivo, `npx ng build` limpio.
- **Nota de proceso:** este pivote reemplaza por completo las 2 iteraciones de diseño
  anteriores documentadas más abajo en este changelog (pestañas de 4, luego de 3). El
  `acceptance.md`/`spec.md` generados para el diseño con tabs quedan obsoletos — no se
  actualizaron línea por línea porque el diseño que describen ya no existe en el código; este
  bloque es la fuente de verdad de lo que realmente se implementó y quedó en el componente.

## Changelog

- 2026-08-28 — tasks inicial, 6 fases, 18 tareas atómicas
- 2026-08-30 — spec cerrada (Fase 6), pero el owner pidió un ajuste adicional tras el cierre:
  la tab "Ficha" volvió a diferenciación **horizontal** (grid 2 columnas desde `lg:` —
  identidad/contacto a la izquierda, matrículas+acciones a la derecha) en vez del apilado
  vertical único que había quedado tras el ajuste post-QA anterior ("no es necesario que
  quede app-like, hazlo diferenciando en horizontal como antes"). Mobile sigue apilando
  (`grid-cols-1`). Sin cambios en Pagos/Clases ni en el resto de la spec. 34/34 tests verdes,
  build limpio, verificado en vivo 1440×900 y 390×844.
