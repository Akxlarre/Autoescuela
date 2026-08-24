# Spec 0011 — Migrar flujos de impresión client-side a Edge Function

> **Status:** done
> **Created:** 2026-08-23
> **Closed:** 2026-08-23
> **Owner:** m
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-i-002` (creada por i, 2026-08-20). El alcance original de la
Asignación era amplio ("auditar toda lógica de negocio sensible ejecutada client-side"), pero
el dueño del negocio corrigió el alcance el 2026-08-21 a algo mucho más acotado: encontrar
instancias de "Exportar como PDF/Excel" que generan el archivo como HTML en el cliente en vez
de vía Edge Function.

Una auditoría preliminar (documentada en la Asignación) confirmó que los 8 botones "Exportar"
literales del sistema ya usan Edge Function (`export-students`, `generate-financial-report`,
`generate-cash-history-report`, `generate-audit-report`, `generate-class-book-pdf`,
`generate-enrollment-sheet`, `generate-contract-pdf`, y el de servicios especiales) — ninguno
pendiente ahí.

El hallazgo real son **3 flujos de impresión** (no "exportación", aunque el mismo anti-patrón)
que arman HTML client-side y lo imprimen vía `window.open()` + `window.print()` en vez de
Edge Function:

1. `core/utils/ficha-tecnica-print.util.ts` + `FichaTecnicaPrintService` — informe de clases
   prácticas de un alumno real (botón "Imprimir Informe", `admin-ficha-tecnica-drawer`). Este
   tiene dato de negocio real del alumno.
2. `core/utils/route-sheet-print.util.ts` — Hoja de Ruta Diaria de un vehículo (RF-091,
   planilla en blanco para llenar a mano).
3. `core/utils/epq-print.util.ts` + `EpqPrintService` — cuestionario EPQ en blanco (81
   preguntas) para responder en papel.

El dueño confirmó que los tres deben migrarse a Edge Function, aunque dos sean formularios en
blanco sin dato de negocio y ninguno se llame literalmente "Exportar" — el criterio es "no usar
HTML client-side para generar el documento", sin excepción.

**Persona afectada:** Admin/Secretaria (imprime ficha técnica de alumno e Instructor
Hoja de Ruta de vehículo), Instructor (imprime EPQ en blanco para hacer responder al alumno).

**Problema que resuelve:** lógica de generación de documento (aunque en 2 de los 3 casos sea
solo un formato en blanco) vive en el bundle del cliente en vez de server-side, inconsistente
con el resto del sistema donde toda generación de PDF/documento ya pasa por Edge Function.

**Hipótesis de valor:** cerrar el último foco de generación de documentos client-side deja al
sistema 100% consistente en su patrón de generación de PDFs (todo vía Edge Function), sin
excepciones que alguien tenga que recordar o justificar caso a caso.

---

## 2. User Stories

- **US1**: Como Admin/Secretaria en `admin-ficha-tecnica-drawer`, quiero que el botón
  "Imprimir Informe" genere el documento server-side, para que el dato real de clases
  prácticas del alumno deje de armarse como HTML en el bundle del cliente.
- **US2**: Como Admin/Secretaria en el drawer de Hoja de Ruta (`route-sheet-drawer`, ya
  migrado en fix-134-b de `window.open()` a un iframe interno), quiero que el documento que
  se previsualiza e imprime sea el PDF generado por Edge Function, para cerrar el último
  punto donde ese flujo sigue armando HTML en el cliente (`buildRouteSheetHtml`).
- **US3**: Como Instructor/Secretaria imprimiendo el test EPQ en blanco para un alumno que
  no lo respondió online, quiero que el documento se genere server-side, para que las 81
  preguntas dejen de vivir como HTML armado en el cliente.
- **US4**: Como usuario de cualquiera de los 3 flujos, quiero que la experiencia de
  imprimir (botón → diálogo de impresión del navegador) no cambie perceptiblemente, para no
  tener que reaprender un flujo que ya conozco.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given un Admin/Secretaria en `admin-ficha-tecnica-drawer`, When hace clic en
  "Imprimir Informe", Then el frontend invoca una nueva Edge Function
  (`generate-ficha-tecnica-pdf`) con el `enrollment_id`/alumno correspondiente, recibe el PDF
  como binario (`application/pdf`, sin almacenar — mismo patrón que
  `generate-enrollment-sheet`: siempre refleja el estado actual) y **solo entonces** abre una
  pestaña nueva vía blob URL, desde donde el usuario imprime con el visor nativo del
  navegador. **Corrección de UX (2026-08-23, decisión del usuario tras probar el flujo
  real):** la pestaña NO se abre en blanco antes del `await` — el botón muestra estado de
  carga (`printing`) mientras espera, evitando el flash de `about:blank` que tenía el patrón
  original.
- **AC2**: Given el mismo flujo, When la Edge Function arma el documento, Then el contenido
  (número/fecha/instructor/kilometraje/estado/validación por clase) es idéntico en
  información al que hoy produce `buildFichaTecnicaPrintHtml` — la migración no cambia qué
  datos se muestran, solo dónde se generan.
- **AC3**: Given un Admin/Secretaria en `route-sheet-drawer`, When abre el drawer, Then el
  iframe ya no recibe `srcdoc` con HTML armado por `buildRouteSheetHtml` — en su lugar carga
  (vía `src`, no `srcdoc`) el PDF binario devuelto por una nueva Edge Function
  (`generate-route-sheet-pdf`), invocada con los mismos datos que hoy arma
  `RouteSheetDrawerComponent.html()` (patente, vehículo, instructor, sede resuelta con
  `both_branches`).
- **AC4**: Given el mismo drawer, When el usuario hace clic en "Imprimir", Then
  `contentWindow.print()` sigue funcionando igual que hoy (acotado al iframe), ahora sobre el
  visor de PDF nativo del navegador en vez de sobre el HTML renderizado — sin reintroducir el
  bloqueador de popups que fix-134-b eliminó.
- **AC5**: Given un Instructor/Secretaria que necesita imprimir el EPQ en blanco, When
  dispara la acción, Then el frontend invoca una nueva Edge Function
  (`generate-epq-pdf`), recibe el PDF binario y **solo entonces** lo abre en pestaña nueva
  vía blob URL — el truco de `win.history.pushState(...)` que usaba `EpqPrintService` para
  fijar la URL del footer de impresión deja de ser necesario (ya no es `about:blank` con HTML
  inyectado). **Corrección de UX (2026-08-23, mismo ajuste que AC1):** tampoco se abre la
  ventana en blanco antes del `await` — el botón "Descargar / imprimir test" muestra estado
  de carga (`isPrintingBlankTest`) mientras espera.
- **AC6**: Given las 81 preguntas del EPQ (`EPQ_QUESTIONS` en `core/utils/epq-questions.const.ts`),
  Then esa fuente de verdad se mueve o se referencia desde el lado del Edge Function (Deno no
  puede importar `core/utils/` de Angular) — sin duplicar manualmente el array en dos lugares
  que puedan desincronizarse silenciosamente.
- **AC7**: Given las 3 nuevas Edge Functions, Then reutilizan las primitivas de bajo nivel ya
  existentes en `supabase/functions/_shared/pdf-utils.ts` (texto, fuentes, tablas) en vez de
  reimplementar el ensamblado de PDF 1.4 desde cero — son 3 funciones separadas (una por
  documento, mismo patrón que `generate-class-book-pdf`/`generate-contract-pdf`/etc.), no una
  función genérica compartida, porque los 3 layouts son suficientemente distintos (tabla de
  clases vs. grilla horaria vs. 81 preguntas) para que forzarlos a un solo handler agregue
  complejidad condicional sin ahorrar código real.
- **AC8**: Given `core/utils/ficha-tecnica-print.util.ts`, `core/utils/route-sheet-print.util.ts`
  y `core/utils/epq-print.util.ts` (los 3 `build*Html` que arman el documento como HTML
  client-side), Then se eliminan una vez migrado cada flujo — no quedan como código muerto ni
  como fallback.

### Edge cases obligatorios

- **AC-E1**: Given que ninguna de las 3 Edge Functions requiere `service_role` real por sí
  misma (los datos ya son visibles al rol que los pide vía RLS normal: alumno propio,
  vehículo de su sede, formulario en blanco sin dato de alumno), Then evaluar en `plan.md`
  si conviene invocarlas con el JWT del usuario autenticado (RLS aplica normalmente) en vez
  de `service_role` — a diferencia de `generate-enrollment-sheet`, que sí necesita
  `service_role` porque cruza tablas fuera del alcance RLS del rol que la invoca.
- **AC-E2**: Given el flujo de Ficha Técnica (único de los 3 con dato real de alumno), When
  la Edge Function falla (alumno sin clases, `enrollment_id` inválido, error de red), Then
  el usuario ve un error claro en vez de una pestaña en blanco o un PDF corrupto — mismo
  criterio de manejo de error que ya usa `EnrollmentFacade.generateContract()` con
  `functions.invoke()`.
- **AC-E3**: Given el iframe de `route-sheet-drawer` con `[srcdoc]` hoy usa
  `SafePipe: 'html'` para confiar el HTML armado client-side, Then al cambiar a `[src]` con
  un blob URL de PDF, el pipe se mantiene pero cambia de tipo a `SafePipe: 'resourceUrl'`
  (Angular sanitiza `iframe[src]` como contexto `RESOURCE_URL` — un blob URL sin bypass
  explícito sigue lanzando error en runtime, no es un caso que deje de necesitar
  sanitización).

---

## 4. Out of scope

- ❌ Los 8 flujos "Exportar" ya migrados a Edge Function — no están en alcance, ya cumplen el
  patrón.
- ❌ Auditoría amplia de "toda lógica de negocio sensible client-side" — ese fue el alcance
  original de `ASG-i-002` antes de la corrección del dueño; el alcance vigente son
  exclusivamente los 3 flujos de impresión listados arriba.

---

## 5. Dependencias

### Specs previas
- Ninguna directa — precedente de patrón: `fix-114-m-race-condition-pending-balance-pagos`
  (motivó la Asignación original, aunque terminó fuera del alcance corregido).

### Capacidades del proyecto que se asumen existentes
- Edge Functions ya existentes que generan PDF/documento server-side (`generate-class-book-pdf`,
  `generate-enrollment-sheet`, `generate-contract-pdf`, etc.) — sirven de referencia de patrón
  para las nuevas.

### Capacidades nuevas requeridas
- 3 Edge Functions nuevas: `generate-ficha-tecnica-pdf`, `generate-route-sheet-pdf`,
  `generate-epq-pdf` (ver AC7 — separadas, no una compartida; reutilizan
  `_shared/pdf-utils.ts`).
- Migrar `EPQ_QUESTIONS` (81 preguntas) a un lugar accesible desde Deno (ver AC6).

---

## 6. Datos y modelo (preliminar)

- Sin cambios de esquema esperados — los 3 flujos ya leen datos existentes (alumno, vehículo,
  formulario EPQ en blanco). A confirmar en `plan.md` si alguno requiere una tabla de auditoría
  de impresión (no mencionado en la Asignación).

---

## 7. UX y flujos (preliminar)

- Pantallas afectadas: `admin-ficha-tecnica-drawer` (botón "Imprimir Informe"),
  `route-sheet-drawer` en Flota/vehículo (Hoja de Ruta Diaria, RF-091), pantalla donde se
  imprime el EPQ en blanco.
- Ficha Técnica y EPQ: mismo patrón (blob URL en pestaña nueva vía visor de PDF nativo del
  navegador) — el botón sigue disparando una sola acción, ahora async (espera la respuesta
  de la Edge Function antes de abrir la pestaña).
- Hoja de Ruta: mismo drawer con iframe interno de fix-134-b (sin popup), cambia `srcdoc`
  (HTML) por `src` (blob URL de PDF); el botón "Imprimir" sigue siendo
  `contentWindow.print()`.
- El comportamiento visible al usuario (botón "Imprimir" → documento listo para imprimir) no
  cambia de fondo — el cambio es dónde se genera el documento, no la experiencia de
  impresión. Único cambio perceptible: una espera breve (llamada de red) entre el clic y la
  apertura del documento, donde antes era instantáneo (HTML armado en memoria).

---

## 8. Métricas de éxito post-launch

- Cero flujos de generación de documento/impresión ejecutándose client-side (HTML armado en
  Angular + `window.print()`) — el sistema queda 100% consistente en Edge Function para esto.

---

## 9. Notas / decisiones abiertas

- [x] Edge Function compartida vs. 3 separadas — resuelto en AC7: 3 separadas (mismo patrón
  que el resto del sistema), reutilizando `_shared/pdf-utils.ts`.
- [x] UX de los 2 formularios en blanco (Hoja de Ruta, EPQ) tras la migración — resuelto en
  sección 7: se mantiene visualmente igual (iframe / pestaña nueva), solo cambia el origen
  del documento (PDF de Edge Function en vez de HTML client-side).
- [ ] AC-E1 (JWT de usuario vs. `service_role` para las 3 nuevas Edge Functions) — a
  confirmar en `plan.md` con detalle de las policies RLS involucradas.
- Originado de Asignación ASG-i-002 (specs/assignments/ASG-i-002-funciones-de-negocio-a-edge-functions.md)

---

## Changelog

- 2026-08-23 — draft inicial por m, a partir de ASG-i-002 (alcance ya corregido por el dueño el
  2026-08-21 a los 3 flujos de impresión).
- 2026-08-23 — approved: US1-US4 y AC1-AC8 + 3 edge cases redactados tras revisar el código
  actual de los 3 flujos (`ficha-tecnica-print.util.ts`, `route-sheet-print.util.ts` +
  `route-sheet-drawer.component.ts` ya migrado a iframe en fix-134-b, `epq-print.util.ts`) y
  el precedente de `generate-enrollment-sheet` (PDF on-demand sin storage) y
  `_shared/pdf-utils.ts` (primitivas compartidas). Decisiones abiertas de la Asignación
  resueltas: 3 Edge Functions separadas, UX visual sin cambios perceptibles.
- 2026-08-23 — done: 3 Edge Functions implementadas y verificadas por el usuario en QA
  manual real (pre-inscripción de prueba real para EPQ). 2 bugs heredados del código
  original encontrados y corregidos dentro del mismo track (grilla horaria de Hoja de Ruta
  no coincidía con el horario real de clases; centrado de las horas). 2 bugs nuevos del PDF
  EPQ encontrados y corregidos en 2 rondas de QA (línea separadora pegada al texto, tamaño
  de fuente muy chico para imprimir). Ajuste de UX no planeado originalmente, pedido por el
  usuario: Ficha Técnica y EPQ ya no abren la pestaña en blanco antes de tener el PDF listo.
  11/11 AC cumplidos, ver `acceptance.md`.
