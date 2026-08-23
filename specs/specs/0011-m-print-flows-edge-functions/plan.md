# Plan 0011 — Migrar flujos de impresión client-side a Edge Function

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-08-23

---

## 1. Resumen ejecutivo

Se crean 3 Edge Functions nuevas (`generate-ficha-tecnica-pdf`, `generate-route-sheet-pdf`,
`generate-epq-pdf`) que reemplazan la generación HTML client-side de los 3 flujos de
impresión en alcance. Cada `*.service.ts`/componente que hoy construye el HTML localmente
pasa a invocar su Edge Function vía `functions.invoke()`, recibir el PDF como binario y
mostrarlo (pestaña nueva con blob URL para Ficha Técnica y EPQ; `src` del iframe existente
para Hoja de Ruta). Los 3 `build*Html` de `core/utils/` y sus specs se eliminan una vez
migrado cada flujo. Orden: Hoja de Ruta primero (ya aislada en un drawer, sin dato de
alumno — menor riesgo), luego EPQ (requiere migrar `EPQ_QUESTIONS` a Deno), y Ficha Técnica
al final (único con dato real de alumno y manejo de error más delicado).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `supabase/functions/generate-route-sheet-pdf/index.ts` | Edge Function | Genera el PDF de Hoja de Ruta Diaria (grilla 08:00–18:00 en blanco) server-side |
| `supabase/functions/generate-epq-pdf/index.ts` | Edge Function | Genera el PDF del cuestionario EPQ (81 preguntas) server-side |
| `supabase/functions/generate-ficha-tecnica-pdf/index.ts` | Edge Function | Genera el PDF de Ficha Técnica (clases prácticas reales de un alumno) server-side |
| `supabase/functions/_shared/epq-questions.ts` | Deno const | Copia de `EPQ_QUESTIONS` accesible desde Deno (Angular no se puede importar cross-runtime) |
| `supabase/functions/_shared/epq-questions.spec.ts` (o script en `scripts/`) | Test/paridad | Verifica que `_shared/epq-questions.ts` y `core/utils/epq-questions.const.ts` tengan el mismo contenido — evita que diverjan en silencio |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/features/admin/flota/route-sheet-drawer/route-sheet-drawer.component.ts` | `html` (computed, síncrono) → `pdfUrl` (signal, poblado async desde `functions.invoke`); `[srcdoc]` → `[src]`; retirar `SafePipe: 'html'`; revocar el blob URL anterior al generar uno nuevo o al destruirse (evitar leak de memoria) | AC3, AC4, AC-E3 |
| `src/app/core/services/ui/epq-print.service.ts` | `printTest()` pasa de sync a `async printTest(): Promise<boolean>`, invoca `generate-epq-pdf`, abre blob URL en pestaña nueva; retira `win.history.pushState(...)` | AC5 |
| `src/app/core/facades/admin-pre-inscritos.facade.ts` | `printBlankTest()` pasa a `async`, propaga el resultado (éxito/error) — hoy es fire-and-forget | AC5, AC-E2 |
| `src/app/core/services/ui/ficha-tecnica-print.service.ts` | `printFichaTecnica()` pasa a `async`, invoca `generate-ficha-tecnica-pdf`, abre blob URL en pestaña nueva; maneja error de red/función (AC-E2) | AC1, AC2 |
| `src/app/features/admin/alumno-detalle/ficha-tecnica-drawer/admin-ficha-tecnica-drawer.component.ts` | El botón "Imprimir Informe" pasa a esperar la promesa (estado de loading breve mientras se genera el PDF) | AC1, AC-E2 |
| `src/app/core/services/ui/epq-print.service.spec.ts` | Reescribir mocks: de `buildEpqTestHtml`/`window.open` sync a `functions.invoke` async | Consistencia con el nuevo servicio |
| `src/app/core/services/ui/ficha-tecnica-print.service.spec.ts` | Ídem | Consistencia |
| `src/app/core/utils/route-sheet-print.util.spec.ts` | Se elimina junto con el util (ver abajo) | — |
| `indices/SERVICES.md` | Actualizar entradas de `EpqPrintService`, `FichaTecnicaPrintService`, agregar las 3 Edge Functions nuevas | Sync obligatoria post-feature |
| `indices/UTILS.md` | Quitar entradas de los 3 `build*Html` eliminados | Sync obligatoria post-feature |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| `src/app/core/utils/ficha-tecnica-print.util.ts` (+ su `.spec.ts` si existe) | HTML ya no se arma client-side (AC8) |
| `src/app/core/utils/route-sheet-print.util.ts` + `route-sheet-print.util.spec.ts` | Ídem |
| `src/app/core/utils/epq-print.util.ts` (+ su `.spec.ts` si existe) | Ídem |

---

## 3. Reutilización (Discovery)

### Componentes/patrones existentes que reutilizamos
- `supabase/functions/_shared/pdf-utils.ts` — primitivas de bajo nivel (fuentes, texto,
  tablas, ensamblado PDF 1.4) ya usadas por `generate-class-book-pdf`,
  `generate-certificate-b-pdf`, `generate-contract-pdf`, etc. Las 3 Edge Functions nuevas
  las reutilizan en vez de reimplementar el ensamblado PDF (visto en
  `generate-enrollment-sheet/index.ts`, que sí lo reimplementa a mano — no seguir ese
  ejemplo, es previo a que existiera `_shared/pdf-utils.ts`).
- Patrón "PDF on-demand sin storage" de `generate-enrollment-sheet` (retorna
  `application/pdf` binario directo, `Content-Disposition: attachment`, sin persistir) —
  las 3 nuevas Edge Functions siguen el mismo patrón (no el de `generate-contract-pdf`, que
  sí sube a Storage y devuelve una URL, porque esos 3 documentos no necesitan persistirse).
- Patrón de manejo de error de `functions.invoke()` ya usado en
  `EnrollmentFacade.generateContract()` (`core/facades/enrollment.facade.ts:1145-1169`):
  chequear `error` de la respuesta explícitamente, no confiar en que la promesa rechace.
- El drawer de Hoja de Ruta ya resolvió el problema del popup blocker en fix-134-b (iframe
  interno con `srcdoc`) — este plan solo cambia la fuente del iframe de HTML a PDF, no
  reintroduce `window.open()`.

### Facades/Services existentes que extendemos
- `EpqPrintService.printTest()` — de sync a async, mismo contrato de retorno (`boolean`
  de éxito, ahora `Promise<boolean>`).
- `FichaTecnicaPrintService.printFichaTecnica()` — ídem.
- `AdminPreInscritosFacade.printBlankTest()` — propaga el nuevo `Promise<boolean>`.

### Componentes/Facades que NO existen y debemos crear
- Las 3 Edge Functions — no hay ninguna existente que cubra estos 3 documentos.
- `_shared/epq-questions.ts` — no existe una copia Deno-accesible del array de 81 preguntas;
  se justifica por la restricción real de runtime (Deno no puede importar `src/app/`).

---

## 4. Modelo de datos

N/A — no hay cambios de esquema. Los 3 flujos ya leen datos existentes:
- Ficha Técnica: clases prácticas de un alumno (misma fuente que hoy consume el componente
  Angular vía `ClasePracticaUI[]` — la Edge Function repetirá esa query con el
  `enrollment_id`/`student_id`).
- Hoja de Ruta: datos de vehículo/instructor/sede ya expuestos por `FlotaDetalleFacade` y
  `BranchFacade` — la Edge Function los vuelve a consultar con el `vehicle_id`.
- EPQ: sin dato de alumno real más que nombre/RUT/licencia opcionales para el encabezado
  (mismos campos opcionales que hoy recibe `EpqPrintOptions`) + el array estático de 81
  preguntas.

### RLS / autorización (AC-E1)

Las 3 Edge Functions se invocan con el JWT del usuario autenticado (Admin/Secretaria/
Instructor, según el flujo) — **no** `service_role` — porque los datos que exponen ya son
visibles a esos roles vía RLS existente:

| Edge Function | Rol invocante | RLS que ya cubre el dato |
|---|---|---|
| `generate-ficha-tecnica-pdf` | Admin/Secretaria | mismas policies de `class_b_practices`/`enrollments` que ya usa el drawer para poblar `ClasePracticaUI[]` |
| `generate-route-sheet-pdf` | Admin/Secretaria | `select_vehicles` (ya filtra por sede/`both_branches`) |
| `generate-epq-pdf` | Instructor/Secretaria | sin dato de alumno persistido salvo nombre/RUT/licencia ya visibles en `pre_inscriptions` vía `select_pre_inscriptions` |

Si en implementación se detecta que alguna query cruza tablas fuera del alcance RLS del rol
(como sí le pasa a `generate-enrollment-sheet`), esa función puntual pasa a `service_role`
con su propia validación de rol en código — no las 3 por defecto.

---

## 5. Arquitectura del feature

### Diagrama de flujo — Hoja de Ruta (ejemplo representativo de los 3)

```
Usuario → RouteSheetDrawerComponent (Smart, vive en LayoutDrawerFacade)
            ├─ inject(FlotaDetalleFacade) / inject(BranchFacade)
            ├─ effect/computed: arma { vehicle_id } al abrir el drawer
            ├─ llama supabase.client.functions.invoke('generate-route-sheet-pdf', {...})
            │     ↓
            │   Edge Function (Deno, JWT del usuario)
            │     ├─ query vehicles/instructors (misma data que hoy resuelve el componente)
            │     ├─ arma PDF con _shared/pdf-utils.ts (grilla 08:00–18:00 en blanco)
            │     └─ retorna binario application/pdf
            ├─ arma blob URL desde la respuesta
            └─ <iframe [src]="pdfUrl()">  (antes: [srcdoc]="html() | safe:'html'")
                  botón "Imprimir" → contentWindow.print()
```

Ficha Técnica y EPQ siguen el mismo flujo pero abren el blob URL en `window.open(url, '_blank')`
en vez de un iframe interno (no tienen drawer de previsualización propio).

### Capas tocadas

- **Smart**: `admin-ficha-tecnica-drawer.component.ts`, `route-sheet-drawer.component.ts`
- **Service (UI-effect, no Facade)**: `FichaTecnicaPrintService`, `EpqPrintService` — siguen
  siendo el punto de aislamiento del efecto (antes `window.print()`, ahora también la llamada
  de red + apertura de blob URL); no se convierten en Facades porque no gestionan estado
  reactivo de dominio, solo disparan un efecto puntual — mismo criterio que ya documenta
  `facades.md §2` (`.service.ts` para lógica utilitaria transversal sin estado de dominio).
- **Facade**: `AdminPreInscritosFacade.printBlankTest()` (ya existente, pasa a async)
- **Edge Function**: 3 nuevas, sin Facade Angular intermedio adicional — se invocan directo
  desde el Service/Component vía `supabase.client.functions.invoke()`, mismo patrón que
  `EnrollmentFacade.generateContract()`.
- **Migration**: ninguna

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Los Services siguen sin inyectar `SupabaseService` directo en
  componentes; `OnPush` ya presente en los componentes tocados (sin cambios ahí).
- [ ] `facades.md` — No aplica branch-scoping nuevo; `AdminPreInscritosFacade` ya es
  branch-scoped y no cambia ese aspecto.
- [ ] `models.md` — No se crean DTOs/UI models nuevos (los payloads de las Edge Functions son
  inputs simples, no requieren modelo formal).
- [x] `visual-system.md` — El botón "Imprimir Informe"/"Imprimir" debe reflejar el estado de
  carga breve (spinner `loader-circle`) mientras espera la respuesta de la Edge Function —
  antes era instantáneo, ahora hay una espera de red real.
- [ ] `swr-pattern.md` — No aplica (no es data cacheada entre navegaciones, es una acción
  puntual bajo demanda).
- [ ] `notifications.md` — No aplica (no son notificaciones persistentes; el error de
  AC-E2 es un toast puntual, no una `Notification`).
- [x] `testing-tdd.md` — Los 2 Services (`FichaTecnicaPrintService`, `EpqPrintService`) y
  `AdminPreInscritosFacade.printBlankTest()` requieren `.spec.ts` actualizados para el nuevo
  flujo async (mock de `functions.invoke`). Los 3 `build*Html` de `core/utils/` se eliminan
  junto con sus specs — no queda lógica pura client-side que testear ahí.
- [x] `ai-readability.md` — Los botones "Imprimir Informe"/"Imprimir" ya deberían tener
  `data-llm-action` (confirmar en implementación; `route-sheet-drawer` ya lo tiene:
  `data-llm-action="print-route-sheet"`).

---

## 7. Plan de testing

- **Unitarios (Vitest)**:
  - `epq-print.service.spec.ts` / `ficha-tecnica-print.service.spec.ts`: mockear
    `supabase.client.functions.invoke` (éxito → abre blob URL; error → retorna `false`/lanza
    manejable).
  - `admin-pre-inscritos.facade.spec.ts`: `printBlankTest()` propaga el resultado async
    correctamente (ya tiene spec existente a extender).
  - `_shared/epq-questions` paridad: test (Vitest en `src/` o script Deno en
    `supabase/functions/`) que compara ambos arrays byte a byte.
- **Integración manual (Edge Functions)**: `npx supabase functions serve` local + invocar las
  3 con `curl`/Postman antes de wirearlas al frontend, verificando que el PDF resultante abra
  correctamente en un lector real.
- **QA manual (golden path + edge cases)**:
  - Ficha Técnica: alumno con clases variadas (asistidas, ausentes, canceladas) → PDF con el
    mismo contenido que el HTML actual.
  - Hoja de Ruta: abrir drawer, confirmar iframe muestra PDF (no HTML), imprimir sin popup
    blocker.
  - EPQ: abrir en pestaña nueva, confirmar 81 preguntas completas, imprimir.
  - Edge case AC-E2: simular error de red (offline / Edge Function caída) en Ficha Técnica →
    mensaje de error visible, no pestaña en blanco.
  - `/verify` (Playwright) obligatorio en los 3 flujos por ser cambio de UI con estado de
    carga nuevo.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El PDF generado a mano (sin librería, como `generate-enrollment-sheet`) con `_shared/pdf-utils.ts` no reproduce el mismo layout visual que el HTML actual (tablas con saltos de página, `page-break-inside: avoid`) | Media | Usar `_shared/pdf-utils.ts` (ya maneja paginación en `generate-class-book-pdf`, caso similar de tabla larga) en vez de reinventar; QA visual explícito comparando ambas versiones antes de eliminar el util viejo |
| `EPQ_QUESTIONS` diverge entre `core/utils/` (Angular) y `_shared/` (Deno) tras un cambio futuro en las preguntas | Media | Test de paridad obligatorio (sección 7) — falla el build/CI si divergen |
| Latencia de red nueva en un flujo que antes era instantáneo (percepción de lentitud) | Baja | Spinner de carga en el botón (regla `visual-system.md`), Edge Functions son livianas (sin joins pesados) |
| Revocar/no revocar `URL.createObjectURL()` genera leak de memoria en sesiones largas (varias impresiones sin recargar) | Baja | `route-sheet-drawer` debe revocar el blob URL anterior al generar uno nuevo o al destruirse (`DestroyRef`) |
| RLS del rol invocante no cubre alguna query de las 3 Edge Functions (ej. Ficha Técnica cruza tablas que hoy solo ve un rol distinto) | Media | Verificar en implementación contra las policies reales antes de fijar JWT-de-usuario vs. `service_role` (AC-E1 ya deja la puerta abierta a usar `service_role` por función si hace falta) |

---

## 9. Orden de implementación

1. `_shared/epq-questions.ts` + test de paridad (base para el paso 3).
2. `generate-route-sheet-pdf` (Edge Function) + wiring en `route-sheet-drawer.component.ts`
   — menor riesgo (sin dato de alumno, drawer ya aislado del popup blocker).
3. `generate-epq-pdf` (Edge Function) + wiring en `EpqPrintService` +
   `AdminPreInscritosFacade.printBlankTest()`.
4. `generate-ficha-tecnica-pdf` (Edge Function) + wiring en `FichaTecnicaPrintService` +
   `admin-ficha-tecnica-drawer.component.ts` (incluye manejo de error AC-E2).
5. Eliminar los 3 `build*Html` de `core/utils/` + sus specs, una vez cada flujo migrado y
   verificado visualmente.
6. `/verify` (Playwright) en los 3 flujos + `npm run test:ci` + `npm run lint:arch`.
7. Sincronizar `indices/SERVICES.md` y `indices/UTILS.md`.

---

## 10. Estimación

L (>3 días) — 3 Edge Functions nuevas con verificación visual de layout PDF, cruce de
runtime para las 81 preguntas, y 2 services + 1 facade + 1 componente pasando de sync a
async.

---

## Changelog

- 2026-08-23 — plan inicial por m, talla L confirmada por el usuario. Basado en discovery de
  `_shared/pdf-utils.ts`, patrón `generate-enrollment-sheet` (PDF sin storage) y
  `EnrollmentFacade.generateContract()` (manejo de error de `functions.invoke`).
