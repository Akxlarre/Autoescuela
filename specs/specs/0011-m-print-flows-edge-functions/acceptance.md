# Acceptance 0011 — Migrar flujos de impresión client-side a Edge Function

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-23
> **Verifier:** m (Claude Code) + QA manual real del owner (m)

---

## Resumen

- AC totales: 8 (AC1-AC8) + 3 edge cases (AC-E1/E2/E3)
- AC cumplidos: 11 / 11
- AC fallidos: 0
- AC con evidencia: 11 / 11 (código + tests + QA manual real del usuario en 2 de los 3 flujos)

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Ficha Técnica invoca Edge Function y abre PDF solo cuando está listo

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `supabase/functions/generate-ficha-tecnica-pdf/index.ts`,
    `src/app/core/services/ui/ficha-tecnica-print.service.ts`
  - Test: `ficha-tecnica-print.service.spec.ts` (3 casos: éxito, error de Edge Function,
    popup bloqueado)
  - QA manual real: el usuario probó el botón "Imprimir Informe" en su ambiente real, pidió
    explícitamente el ajuste de no abrir la pestaña en blanco antes de tener el PDF listo
    (evitar flash de `about:blank`), se implementó y confirmó "quedó perfecto".
- **Notas:** el diseño original de la spec (ventana síncrona antes del `await`, para evitar
  el bloqueador de popups) se corrigió a pedido del usuario tras ver el comportamiento real
  — trade-off aceptado y documentado en el AC y en `tasks.md`.

### AC2 — Contenido de Ficha Técnica idéntico al HTML anterior

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: la Edge Function replica la query de `AdminAlumnoDetalleFacade._clasesPracticas`
    (`class_b_sessions` + `class_b_practice_attendance`) y el mismo set de columnas
    (número/fecha-hora/instructor/kilometraje/estado/observaciones/validación) que
    `buildFichaTecnicaPrintHtml`.
  - Smoke test aislado con datos de 4 estados reales (completada, ausente sin justificar,
    ausente justificada, cancelada) + 8 pendientes — contenido verificado visualmente.

### AC3 — Route Sheet: iframe carga PDF vía `src`, no HTML vía `srcdoc`

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `route-sheet-drawer.component.ts` (`[src]="pdfUrl() | safe:'resourceUrl'"`),
    `generate-route-sheet-pdf/index.ts`, `FlotaDetalleFacade.generateRouteSheetPdf()`
  - QA manual real: el usuario abrió el drawer en su ambiente real con un vehículo/instructor
    real (patente ABCD43, Kia Morning, instructor Juan Carlos González) y confirmó "quedo
    perfecto".

### AC4 — Botón "Imprimir" sigue funcionando sin popup blocker

- **Estado:** ✅ cumplido
- **Evidencia:** mismo mecanismo `contentWindow.print()` acotado al iframe, sin cambios de
  patrón respecto a fix-134-b. Confirmado en la misma QA manual real de AC3.

### AC5 — EPQ invoca Edge Function y abre PDF solo cuando está listo

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `generate-epq-pdf/index.ts`, `epq-print.service.ts`
  - Test: `epq-print.service.spec.ts` (3 casos, mismo patrón que Ficha Técnica)
  - QA manual real: el usuario pre-inscribió un alumno de prueba real y probó el botón
    "Descargar / imprimir test" end-to-end en su ambiente real. Encontró 2 bugs visuales
    reales en el PDF (línea separadora pegada al texto de la pregunta siguiente; tamaño de
    fuente demasiado chico para imprimir), corregidos en dos rondas — la primera corrección
    de la línea seguía insuficiente (el offset no descontaba la altura del ascendente del
    glifo), corregido en una segunda ronda. Confirmó "ahora está perfecto".
  - Se aplicó el mismo ajuste de UX que AC1 (no abrir ventana en blanco antes del `await`) a
    pedido explícito del usuario, con spinner nuevo (`isPrintingBlankTest`) en
    `AdminPreInscritoDrawerComponent`.

### AC6 — EPQ_QUESTIONS accesible desde Deno sin duplicación silenciosa

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Código: `supabase/functions/_shared/epq-questions.ts` (espejo exacto)
  - Test: `src/app/core/utils/epq-questions.parity.spec.ts` — verificado que detecta
    divergencia (se rompió el array a propósito, el test falló, se revirtió).

### AC7 — 3 Edge Functions separadas, reutilizan `_shared/pdf-utils.ts`

- **Estado:** ✅ cumplido
- **Evidencia:** las 3 (`generate-route-sheet-pdf`, `generate-epq-pdf`,
  `generate-ficha-tecnica-pdf`) importan `escapePdfWinAnsi`, `assemblePdf`, `wrapLines` y/o
  `textWidth` de `_shared/pdf-utils.ts` — sin reimplementar el ensamblado PDF 1.4.

### AC8 — Los 3 `build*Html` eliminados sin dejar código muerto

- **Estado:** ✅ cumplido
- **Evidencia:** `ficha-tecnica-print.util.ts`, `route-sheet-print.util.ts`,
  `epq-print.util.ts` (+ sus `.spec.ts`) eliminados. `grep` confirmó cero referencias activas
  (solo menciones en comentarios históricos). `npm run test:ci` pasó de 177 a 175 archivos de
  test, consistente con la eliminación.

### AC-E1 — JWT de usuario vs. `service_role`

- **Estado:** ✅ cumplido
- **Evidencia:** las 3 Edge Functions se invocan con el JWT del usuario (header
  `Authorization` reenviado al cliente Supabase), no `service_role` — código verificado en
  las 3 (`generate-route-sheet-pdf`, `generate-epq-pdf` no requiere auth de datos de alumno
  real, `generate-ficha-tecnica-pdf`). RLS real no verificable en este sandbox sin Supabase
  local, pero la QA manual real del usuario (logueado como admin/secretaria real) ejecutó
  los 3 flujos exitosamente contra las policies reales de producción — evidencia indirecta
  de que el JWT del usuario alcanza.

### AC-E2 — Manejo de error en Ficha Técnica

- **Estado:** ✅ cumplido
- **Evidencia:** `printFichaTecnica()` retorna `false` si `error` o `!data`;
  `AdminFichaTecnicaDrawerComponent.imprimirFicha()` muestra `ToastService.error()` si falla,
  cubierto por test (`ficha-tecnica-print.service.spec.ts`, caso "Edge Function falla").

### AC-E3 — `SafePipe` cambia de tipo, no se retira

- **Estado:** ✅ cumplido
- **Evidencia:** `route-sheet-drawer.component.ts` usa `pdfUrl() | safe:'resourceUrl'` en el
  binding `[src]` del iframe — corrección aplicada sobre el AC original (que asumía
  incorrectamente que `SafePipe` se retiraba por completo).

---

## Out-of-scope respetado

- ❌ Los 8 flujos "Exportar" ya migrados — no se tocaron.
- ❌ Auditoría amplia de lógica de negocio client-side — no se abordó, se mantuvo el alcance
  acotado a los 3 flujos de impresión.

---

## Deuda técnica detectada

- Ninguna deuda nueva bloqueante. Nota menor: `admin-pre-inscritos.facade.ts` cruzó de 5 a 6
  llamadas a `inject()` (ARCH-10, advisory) al agregar `ToastService` — aceptado, extraer a
  un servicio adicional está fuera de alcance de esta spec.

---

## Cambios en índices

- `indices/SERVICES.md` — `EpqPrintService`, `FichaTecnicaPrintService` actualizados; 3 Edge
  Functions nuevas agregadas; entradas de los 3 `build*Html` eliminados reemplazadas por nota
  de migración.
- `indices/UTILS.md` — 3 entradas eliminadas (`epq-print.util.ts`, `ficha-tecnica-print.util.ts`,
  `route-sheet-print.util.ts`); nota de sincronización agregada a `epq-questions.const.ts`.
- `indices/COMPONENTS.md` — `RouteSheetDrawerComponent`, `AdminFichaTecnicaDrawerComponent`,
  `AdminPreInscritoDrawerComponent` actualizados.
- `indices/FACADES.md` — `FlotaDetalleFacade` (nuevo método `generateRouteSheetPdf`),
  `AdminPreInscritosFacade` (dependencia `ToastService`).

---

## Post-mortem

- **Qué salió mejor de lo esperado:** los smoke tests aislados (Node/tsx, sin Supabase local)
  detectaron 3 bugs reales de layout PDF antes de que el usuario los viera — inspeccionar el
  PDF renderizado (no solo leer el código de generación de operadores PDF) fue clave, ya que
  los bugs de espaciado/centrado son invisibles en el código fuente.
- **Qué fricciones encontramos:** el sandbox no tiene Supabase local (`supabase start`)
  disponible, así que la verificación de invocación real (RLS, datos reales) dependió
  enteramente del usuario probando en su ambiente — funcionó bien, pero significó 3 rondas
  de ida y vuelta (Hoja de Ruta → Ficha Técnica → EPQ) en vez de una sola verificación
  exhaustiva.
- **Qué cambiaríamos:** para la próxima spec con Edge Functions de PDF, vale la pena
  invertir en el smoke test aislado desde el principio de cada función (no solo al final)
  para atrapar bugs de layout antes de la primera ronda de QA del usuario.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (175 archivos, 2197 tests, 5 skipped preexistentes)
- [x] `lint:arch` limpio (exit 0)
- [x] Sin deuda crítica abierta

**Cerrado por:** m
**Fecha:** 2026-08-23
