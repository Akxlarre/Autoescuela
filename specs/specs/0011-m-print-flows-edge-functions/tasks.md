# Tasks 0011 — Migrar flujos de impresión client-side a Edge Function

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-23

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.
- Orden de implementación (plan.md §9): Hoja de Ruta → EPQ → Ficha Técnica (de menor a mayor
  riesgo — la última es la única con dato real de alumno).

---

## Fase 1 — Dato compartido (EPQ_QUESTIONS cross-runtime)

- [x] **T1.1** — Crear `supabase/functions/_shared/epq-questions.ts` con copia exacta de
  `EPQ_QUESTIONS`
  - **AC ref:** AC6
  - **DoD:**
    - [x] Array idéntico (81 ítems, mismo orden y texto) al de
      `src/app/core/utils/epq-questions.const.ts`
    - [x] Comentario en ambos archivos apuntando al otro ("mantener sincronizado con X — ver
      test de paridad en Y")

- [x] **T1.2** — Escribir test de paridad entre ambos arrays
  - **AC ref:** AC6
  - **DoD:**
    - [x] Test (Vitest en `src/`) importa/lee ambos archivos y compara byte a byte
      (`src/app/core/utils/epq-questions.parity.spec.ts`)
    - [x] Test FALLA si alguien edita uno sin el otro (verificado rompiendo
      `_shared/epq-questions.ts` a propósito — el test detectó la divergencia — y revertido)
    - [x] Corre como parte de `npm run test:ci`

---

## Fase 2 — Edge Functions

- [x] **T2.1** — Crear `supabase/functions/generate-route-sheet-pdf/index.ts`
  - **AC ref:** AC3, AC7, AC-E1
  - **DoD:**
    - [x] Recibe `vehicle_id` (mismo identificador que ya usa `FlotaDetalleFacade`)
    - [x] Query de patente/marca/modelo/instructor/sede replica exactamente los datos que
      hoy arma `RouteSheetDrawerComponent.html()` (incluye resolución de `both_branches` →
      "Ambas")
    - [x] Invocado con JWT del usuario (no `service_role`), vía header `Authorization`
      reenviado al cliente Supabase — confirmar en QA manual contra RLS real de
      `select_vehicles`
    - [x] Arma el PDF (grilla 08:00–18:00 en blanco, encabezado sede/instructor/patente) con
      `_shared/pdf-utils.ts` (`escapePdfWinAnsi`, `assemblePdf`)
    - [x] Retorna binario `application/pdf` sin almacenar (mismo patrón que
      `generate-enrollment-sheet`)
    - [~] Probado localmente con `npx supabase functions serve` + `curl` — **no disponible en
      este entorno** (requiere `supabase start`, stack Postgres+Docker completo, fuera del
      sandbox actual). Verificado en su lugar de forma aislada: se extrajo la función
      `buildRouteSheetPdf` a un script standalone (Node/tsx) con datos de prueba, se generó
      el PDF, se detectó y corrigió un bug real (fila de encabezado de la tabla se rellenaba
      de negro sólido con texto invisible — faltaba `setGray`/`resetColor` antes del `re f`)
      y se verificó visualmente el PDF corregido. **Pendiente: probar la función completa
      (incluida la query a Supabase) contra una instancia real antes de dar por cerrada la
      tarea — dejar explícito en QA manual (Fase 4).**

- [x] **T2.2** — Crear `supabase/functions/generate-epq-pdf/index.ts`
  - **AC ref:** AC5, AC6, AC7, AC-E1
  - **DoD:**
    - [x] Recibe `studentName?`, `rut?`, `licencia?` opcionales (mismo contrato que
      `EpqPrintOptions`)
    - [x] Importa las 81 preguntas desde `_shared/epq-questions.ts` (T1.1), no las duplica
    - [x] Arma el PDF (encabezado + tabla de 81 preguntas con casillas Sí/No, paginado
      automáticamente cuando no caben en una página) con `_shared/pdf-utils.ts`
      (`escapePdfWinAnsi`, `wrapLines`, `assemblePdf`)
    - [x] Retorna binario `application/pdf` sin almacenar
    - [x] Verificado con smoke test aislado (Node/tsx): 81 preguntas completas en 2 páginas,
      checkboxes Sí/No correctos. Se detectó y corrigió un bug real (línea separadora de
      cada fila atravesaba el texto de la fila siguiente por espaciado insuficiente —
      `rowH` muy ajustado + línea dibujada con offset relativo a la posición ya
      decrementada). **Pendiente igual que T2.1: prueba de invocación real contra Supabase
      local no disponible en este sandbox — queda para QA manual (Fase 4).**

- [x] **T2.3** — Crear `supabase/functions/generate-ficha-tecnica-pdf/index.ts`
  - **AC ref:** AC1, AC2, AC7, AC-E1, AC-E2
  - **DoD:**
    - [x] Recibe `enrollment_id`, replica la query de
      `AdminAlumnoDetalleFacade._clasesPracticas` (`class_b_sessions` +
      `class_b_practice_attendance`, cantidad de clases derivada de
      `classCountFromPracticalHours` con fallback 12)
    - [x] Query/mapeo replica los mismos datos que hoy consume
      `buildFichaTecnicaPrintHtml` (número, fecha/hora, instructor, kilometraje, estado
      —ausente/justificada/cancelada/pendiente—, observaciones, validación firma
      alumno/instructor)
    - [x] Invocado con JWT del usuario (header `Authorization` reenviado) — confirmar en QA
      manual contra RLS real
    - [x] Arma el PDF con `_shared/pdf-utils.ts`, con paginación propia (`flushPage()` /
      `startNewPage()`, encabezado de tabla repetido en cada página)
    - [x] `enrollment_id` inválido o inexistente devuelve 400/404 con mensaje, no un PDF
      vacío silencioso
    - [x] Retorna binario `application/pdf` sin almacenar
    - [x] Verificado con smoke test aislado (Node/tsx) usando 12 clases con los 4 estados
      reales (completada con firma, ausente sin justificar, ausente justificada, cancelada)
      + 8 pendientes. Se detectaron y corrigieron 2 bugs reales durante la verificación: (1)
      código muerto (un loop `for` sin efecto) y una llamada `newPage()` incondicional al
      final que duplicaba el encabezado de tabla en una página extra vacía — se separó en
      `flushPage()`/`startNewPage()`; (2) filas de una sola línea con `rowH` mínimo (16)
      insuficiente para el bloque fecha+hora apilado, la línea separadora atravesaba la
      hora — subido a 22. **Pendiente igual que T2.1/T2.2: prueba de invocación real contra
      Supabase local no disponible en este sandbox — queda para QA manual (Fase 4).**

---

## Fase 3 — Capa Angular (wiring por flujo)

- [x] **T3.1** — Migrar `route-sheet-drawer.component.ts` a consumir el PDF
  - **AC ref:** AC3, AC4, AC-E3
  - **DoD:**
    - [x] `html` (computed síncrono) reemplazado por signals `pdfUrl`/`isLoading`, poblados
      desde `FlotaDetalleFacade.generateRouteSheetPdf()` (nuevo método del Facade —
      componentes no invocan `functions.invoke` directo, regla `facades.md`)
    - [x] `<iframe [srcdoc]="html() | safe:'html'">` → `<iframe [src]="pdfUrl() | safe:
      'resourceUrl'">` — **corrección sobre el DoD original**: `SafePipe` NO se retira,
      solo cambia de tipo (`'html'` → `'resourceUrl'`) — `iframe[src]` sigue siendo
      contexto `RESOURCE_URL` en Angular y lanza en runtime sin bypass explícito. Ver
      AC-E3 corregida en spec.md.
    - [x] Blob URL anterior se revoca (`URL.revokeObjectURL`) antes de generar uno nuevo y en
      `DestroyRef.onDestroy`
    - [x] Botón "Imprimir" (`data-llm-action="print-route-sheet"`) sigue disparando
      `contentWindow.print()`, deshabilitado mientras carga o si no hay PDF
    - [x] Estado de carga visible (`loader-circle` + `animate-spin`) mientras se espera la
      Edge Function
    - [x] `npx tsc --noEmit` limpio para este archivo; verificación en browser real
      pendiente para QA manual (Fase 4) — no hay `ng serve` corriendo en este sandbox

- [x] **T3.2** — Eliminar `route-sheet-print.util.ts` + `route-sheet-print.util.spec.ts`
  - **AC ref:** AC8
  - **DoD:**
    - [x] Archivos borrados
    - [x] Ninguna referencia rota (`grep` limpio — solo quedan menciones en comentarios/docs)
    - [x] `npm run test:ci` sigue verde (177 archivos, 2207 tests, 5 skipped preexistentes)

- [x] **T3.3** — Migrar `EpqPrintService.printTest()` a async
  - **AC ref:** AC5
  - **DoD:**
    - [x] `printTest(opts): Promise<boolean>` abre la ventana SÍNCRONAMENTE (antes del
      `await`, para no disparar el bloqueador de popups), invoca `generate-epq-pdf`, arma
      blob URL, navega `win.location.href` al blob
    - [x] `win.history.pushState(...)` retirado (ya no aplica — no es más `about:blank`)
    - [x] `epq-print.service.spec.ts` reescrito con `TestBed` + mock de
      `SupabaseService.client.functions.invoke` (3 casos: popup bloqueado, éxito, error de
      Edge Function)
    - [x] Tests PASAN (3/3)

- [x] **T3.4** — Propagar el cambio a async en `AdminPreInscritosFacade.printBlankTest()`
  - **AC ref:** AC5, AC-E2
  - **DoD:**
    - [x] `printBlankTest()` pasa a `async`, retorna `Promise<boolean>` en vez de
      fire-and-forget
    - [x] Error de red/Edge Function visible al usuario (`ToastService.error()`, nuevo
      `inject(ToastService)` en el Facade)
    - [x] `admin-pre-inscritos.facade.spec.ts` actualizado (mock `printTest` async +
      `ToastService`) y en verde (12/12, incluye caso de toast de error)

- [x] **T3.5** — Eliminar `epq-print.util.ts` (+ spec si existe)
  - **AC ref:** AC8
  - **DoD:**
    - [x] Archivo(s) borrados
    - [x] Ninguna referencia rota (solo queda una mención en comentario histórico)
    - [x] `npm run test:ci` — pendiente de correr la suite completa al final de la Fase 3
      (se corrió y quedó verde tras T3.2; se re-confirma en Fase 4)

- [x] **T3.6** — Migrar `FichaTecnicaPrintService.printFichaTecnica()` a async
  - **AC ref:** AC1, AC2, AC-E2
  - **DoD:**
    - [x] `printFichaTecnica(enrollmentId): Promise<boolean>` invoca
      `generate-ficha-tecnica-pdf`, arma blob URL, navega la ventana ya abierta
      síncronamente. **Cambio de firma respecto al DoD original**: ya no recibe
      `clases`/`opts` — la Edge Function repite la query completa a partir de
      `enrollment_id` (igual que `generate-route-sheet-pdf`/`generate-epq-pdf` no reciben
      datos ya cargados en el cliente). Se documenta como desviación intencional, no un
      olvido.
    - [x] Error de la Edge Function (chequear `error` de la respuesta explícitamente, patrón
      de `EnrollmentFacade.generateContract()`) se propaga como `false`
    - [x] `ficha-tecnica-print.service.spec.ts` reescrito con `TestBed` + mock de
      `SupabaseService.client.functions.invoke` (mismo patrón que `epq-print.service.spec.ts`)
    - [x] Tests PASAN (3/3)

- [x] **T3.7** — Wire-up del estado de carga/error en
  `admin-ficha-tecnica-drawer.component.ts`
  - **AC ref:** AC1, AC-E2
  - **DoD:**
    - [x] Botón "Imprimir Informe" espera la promesa; se agregó input `printing` nuevo a
      `AdminFichaTecnicaComponent` (Dumb) para mostrar `loader-circle` + deshabilitar el
      botón mientras carga — no estaba en el plan original, descubierto al implementar
      (ver "Tareas descubiertas" al final)
    - [x] Error visible al usuario vía `ToastService.error()` si la Edge Function falla
    - [x] `npx tsc --noEmit` limpio; verificación visual en browser real pendiente para QA
      manual (Fase 4) — no hay `ng serve` corriendo en este sandbox

- [x] **T3.8** — Eliminar `ficha-tecnica-print.util.ts` (+ spec si existe)
  - **AC ref:** AC8
  - **DoD:**
    - [x] Archivo(s) borrados
    - [x] Ninguna referencia rota (solo comentario histórico)
    - [x] `npm run test:ci` sigue verde (175 archivos, 2197 tests, 5 skipped preexistentes —
      2 archivos menos que antes, esperado: los `.util.spec.ts` eliminados junto a T3.2/T3.5)

---

## Fase 4 — Validación

- [x] **T4.1** — `npm run lint:arch` corre limpio
  - Exit code 0. Todos los warnings pre-existen o son de archivos no tocados en este track
    (`public-enrollment.facade.ts`, `precios-cursos-drawer.component.ts`, etc.), salvo uno
    nuevo: `admin-pre-inscritos.facade.ts` pasó de 5 a 6 llamadas a `inject()` (ARCH-10,
    advisory, no bloqueante) al agregar `ToastService` para el toast de error de T3.4 —
    aceptado como trade-off, extraer lógica a un servicio adicional está fuera de alcance de
    esta spec.
- [x] **T4.2** — `npm run test:ci` corre verde (incluye specs nuevos/reescritos de T1.2,
  T3.3, T3.4, T3.6) — 175 archivos, 2197 tests, 5 skipped preexistentes, 0 fallos
- [x] **T4.3** — `/verify` (Playwright) en los 3 flujos: Hoja de Ruta (drawer), EPQ (pestaña
  nueva), Ficha Técnica (pestaña nueva) — consola limpia, sin 4xx, PDF visible
  - **DoD:** Cada AC (AC1-AC8, AC-E1/E2/E3) marcado con evidencia en `acceptance.md`
  - **BLOQUEADO en este sandbox**: no hay `ng serve` corriendo ni Playwright MCP activo
    (memoria del proyecto: "Playwright MCP inactivo" en jun-2026, sin confirmación reciente
    de que cambió). Verificación sustituta en sandbox: smoke tests aislados (Node/tsx) de la
    lógica de generación de PDF de las 3 Edge Functions (T2.1-T2.3, inspección visual de los
    PDFs resultantes), `npx tsc --noEmit` limpio, `npm run test:ci` verde.
    **Resuelto (2026-08-23): el usuario hizo QA manual real en su ambiente** — pre-inscribió
    un alumno de prueba y probó los 3 flujos en producción/staging real (no simulado):
    - Hoja de Ruta: confirmó "quedo perfecto" tras el fix de centrado.
    - Ficha Técnica: confirmó que el ajuste de UX (sin flash de `about:blank`) funcionó.
    - EPQ: probó el botón end-to-end, encontró 2 bugs visuales reales en el PDF (línea
      separadora pegada al texto, tamaño de fuente muy chico para imprimir) en dos rondas
      sucesivas, ambos corregidos y re-verificados hasta que confirmó "ahora está perfecto".
    Este ciclo de QA manual real —con bugs genuinos encontrados y corregidos— cubre la
    intención de T4.3 con más rigor que un `/verify` automatizado habría dado en un sandbox
    sin datos reales.
- [x] **T4.4** — Ejecutar `/spec-verify`
  - **DoD:** AC Verifier devuelve `{ok: true}` o tickets restantes resueltos
  - Verificación manual de los 8 AC + 3 edge cases contra el estado final del código: todos
    cumplidos (ver `acceptance.md`). `npx tsc --noEmit`, `npm run test:ci` (175 archivos,
    2197 tests) y `npm run lint:arch` (exit 0) verdes en el estado final.

---

## Fase 5 — Cierre

- [x] **T5.1** — Actualizar `indices/SERVICES.md` (entradas de `EpqPrintService`,
  `FichaTecnicaPrintService` + 3 Edge Functions nuevas), `indices/UTILS.md` (quitar los 3
  `build*Html` eliminados), `indices/COMPONENTS.md` (`RouteSheetDrawerComponent`,
  `AdminFichaTecnicaDrawerComponent`) e `indices/FACADES.md` (`FlotaDetalleFacade`,
  `AdminPreInscritosFacade`) — hecho tras feedback del Stop hook de sync-check
- [x] **T5.2** — Marcar spec `0011-m-print-flows-edge-functions` como `done` en
  `specs/ROADMAP.md` (movida de Backlog a Done, con resumen de los 4 bugs reales encontrados
  en QA + el ajuste de UX) y en `spec.md` (frontmatter `Status: done` + `Closed:`)
- [x] **T5.3** — Limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [x] Input `printing` nuevo en `AdminFichaTecnicaComponent` (Dumb) para reflejar el estado
  de carga del botón "Imprimir Informe" mientras se espera la Edge Function — no estaba en
  el plan original (que no anticipó cambios en el Dumb component), necesario porque el flujo
  pasó de síncrono a async con latencia de red real (ver riesgo "latencia percibida" en
  plan.md §8).
- [x] `FichaTecnicaPrintService.printFichaTecnica()` cambió de firma (`clases[], opts` →
  `enrollmentId: number`) — no estaba explícito en plan.md/tasks.md original, pero es
  consistente con el resto del diseño (las 3 Edge Functions ya reciben solo un identificador
  y repiten su propia query, no datos pre-cargados en el cliente).
- [x] **Bug real encontrado por el usuario en QA manual (2026-08-23), corregido dentro del
  mismo track**: `generate-route-sheet-pdf` heredó del util original una grilla horaria fija
  de 11 horas en punto (08:00–18:00) que nunca coincidió con el horario real de clases Clase
  B — 13 bloques exactos de 45 min con pausas (08:30-09:15 … 20:00-20:45), definidos en
  `courses.schedule_blocks` (`20260513000001_class_b_schedule_exact_slots.sql`). Corregido:
  la Edge Function ahora consulta `schedule_blocks` de cualquier curso `class_b` activo
  (uniforme entre cursos/sedes) y arma las 13 filas reales; si no hay curso activo (BD sin
  seed), cae a un respaldo hardcodeado que replica el mismo DEFAULT de la columna (no una
  grilla inventada aparte). Verificado con smoke test aislado — las 13 filas caben en una
  sola página A4 sin desbordar. Fuera del alcance original de la spec (que solo pedía migrar
  la generación, no corregir el contenido), pero se trató como fix dentro del mismo track por
  ser un bug heredado descubierto durante la migración, no una feature nueva.
- [x] **Bug de centrado encontrado por el usuario en QA visual (2026-08-23), corregido en el
  mismo track**: la etiqueta de hora (`HH:MM-HH:MM`) en la columna HORA quedaba pegada al
  borde izquierdo de la celda (padding fijo `M+3`) en vez de centrada. Corregido calculando
  el offset horizontal con `textWidth(horaLabel, 8, true)` de `_shared/pdf-utils.ts` —
  `horaX = M + (cols[0] - textWidth(...)) / 2`. Verificado con smoke test aislado
  (antes/después comparados visualmente).
- [x] **Ajuste de UX pedido por el usuario tras probar el flujo real (2026-08-23)**: en Ficha
  Técnica, el botón "Imprimir Informe" abría una pestaña en blanco (`about:blank`) de
  inmediato y la navegaba al PDF una vez listo — se sentía como un flash de contenido roto.
  Corregido: `FichaTecnicaPrintService.printFichaTecnica()` ya NO abre la ventana antes del
  `await` — espera el PDF completo y recién entonces hace `window.open(url, '_blank')`. El
  estado de carga vive enteramente en el botón (`printing`, ya implementado en T3.7). Se
  aceptó el trade-off de riesgo de bloqueador de popups en llamadas lentas (activación
  transitoria del navegador puede expirar) — se propaga como `false`/toast de error igual
  que cualquier otro fallo. `ficha-tecnica-print.service.spec.ts` reescrito (3 tests, verde).
- [x] **Mismo ajuste de UX aplicado a `EpqPrintService`** (pedido explícito del usuario,
  2026-08-23): `printTest()` ya no abre la ventana antes del `await` — espera el PDF
  completo y recién entonces `window.open(url, '_blank')`. Se agregó signal
  `isPrintingBlankTest` en `AdminPreInscritoDrawerComponent` (no existía estado de carga
  para este botón antes) — spinner `loader-circle` + botón deshabilitado mientras carga,
  mismo patrón que `isGeneratingContract` ya usado en el mismo componente para el flujo de
  contrato. `epq-print.service.spec.ts` reescrito (3 tests, verde). `npx tsc --noEmit` y
  `npm run test:ci` (175 archivos, 2197 tests) verdes tras el cambio.
- [x] **2 bugs de diseño del PDF EPQ encontrados por el usuario en QA visual real
  (2026-08-23), corregidos en el mismo track**: (1) el separador entre preguntas se dibujaba
  a solo 6pt del texto de la pregunta siguiente — casi la altura de un ascendente a 8pt bold
  (ej. "¿") — por eso la línea quedaba visualmente pegada arriba de cada pregunta en vez de
  centrada entre ellas; (2) 8pt de fuente con 11pt de interlineado es demasiado chico para un
  cuestionario que se responde a mano en papel impreso. Corregido junto, ya que agrandar la
  fuente resuelve ambos: `QUESTION_SIZE` 8→9pt, `LINE_HEIGHT` 11→13pt, `ROW_PADDING` fijo en
  16pt con el separador dibujado en el punto medio (8pt de aire a cada lado, holgado incluso
  para ascendentes). Resultado: 81 preguntas pasan de ~2 a 4 páginas A4 — aceptado a
  propósito, un formulario psicológico impreso prioriza legibilidad sobre compresión.
  Verificado con smoke test aislado (primera y última página revisadas visualmente, cierra
  limpio en la pregunta 81 sin filas huérfanas).
- [x] **Segunda ronda de QA visual (2026-08-23): la primera corrección seguía insuficiente**
  — el usuario reportó con capturas de cerca que la línea seguía "muy pegada arriba de cada
  pregunta". Causa raíz real: el offset de 8pt (mitad del `ROW_PADDING=16`) se midió desde el
  borde de la celda, pero un ascendente a 9pt (ej. "¿", "d", "l") sube ~6.5pt sobre su propia
  baseline — el aire REAL era `offset - ascenderHeight = 8 - 6.5 = 1.5pt`, prácticamente
  nada. Corregido restando explícitamente `ASCENDER_HEIGHT=6.5` al calcular `GAP_BELOW_LINE`
  (offset real = 13.5pt, aire visible ≈7pt tras descontar el ascendente); `GAP_ABOVE_LINE=10`
  para el lado de arriba. `ROW_PADDING` sube de 16 a 23.5, empujando el total de páginas de
  4 a 5 — aceptado, prioridad es legibilidad. Verificado con smoke test aislado enfocado en
  las preguntas 1-6 (incluye la #6, de 2 líneas, el caso más exigente) — separación pareja
  y clara en todas.
