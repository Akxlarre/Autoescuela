# Spec 0011-m — Migrar los flujos de impresión client-side a Edge Functions

> **Status:** draft
> **Created:** 2026-08-21
> **Owner:** Matías
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** `ASG-i-002` (creada por `i`, 2026-08-20). El texto escrito en la Asignación describía
el objetivo como "auditar Facades/services en busca de lógica de negocio sensible que debería ser
server-side" — un alcance genérico. Al reclamarla, el dueño del negocio aclaró que la intención
real de quien la creó era más acotada: **encontrar instancias de "Exportar como PDF" / "Exportar
como Excel" que generan el archivo como HTML en el cliente en vez de usar una Edge Function, como
sí hace la mayoría del sistema.**

**Auditoría hecha antes de escribir esta spec** (para no heredar un alcance que no corresponde):

- **Los 8 botones literales "Exportar como PDF" / "Exportar como Excel" del sistema ya usan Edge
  Function**, sin excepción: alumnos (`export-students`), cuadratura (`generate-cash-history-report`
  y equivalente de cierre), liquidaciones, servicios especiales, reportes contables
  (`generate-financial-report`), auditoría (`generate-audit-report`), libro de clases
  (`generate-class-book-pdf`), ficha de matrícula (`generate-enrollment-sheet`) y contrato
  (`generate-contract-pdf`). No hay ninguno pendiente de migrar bajo ese nombre.
- **Sí existen 3 flujos que arman HTML en el cliente y lo imprimen vía `window.open()` +
  `window.print()`** (el usuario "guarda como PDF" manualmente desde el diálogo de impresión del
  navegador, si quiere un archivo):
  1. `core/utils/ficha-tecnica-print.util.ts` + `FichaTecnicaPrintService` — informe de **clases
     prácticas de un alumno real** (dato de negocio), botón "Imprimir Informe" en
     `admin-ficha-tecnica-drawer`.
  2. `core/utils/route-sheet-print.util.ts` + su drawer en `admin/flota` — Hoja de Ruta Diaria de
     un vehículo, planilla **en blanco** para llenar a mano (RF-091).
  3. `core/utils/epq-print.util.ts` + `EpqPrintService` — cuestionario EPQ **en blanco** (81
     preguntas) para responder en papel cuando no se rinde en línea.

Ninguno de los tres se llama "Exportar" en la UI (dos dicen "Imprimir"), y dos de los tres no llevan
dato real (son formularios vacíos). Pese a eso, **el dueño del negocio confirmó el 2026-08-21 que
los tres deben migrarse a Edge Function igual — "en ningún caso es mejor usar HTML"** — cerrando la
duda sobre si el criterio debía limitarse a exportaciones de datos reales o a la etiqueta "Exportar".
Con esa decisión, el alcance de esta spec queda fijado en los 3 flujos de arriba.

**Persona afectada:** el equipo de desarrollo (mantiene dos motores de generación de documentos en
vez de uno) y, indirectamente, quien usa esas 3 pantallas (Secretaría/Admin/Instructor), cuya
experiencia hoy depende de que el navegador no bloquee la ventana emergente de impresión.

**Problema que resuelve:** consolidar en un solo patrón (Edge Function → PDF descargable) la
generación de documentos del sistema, eliminando la dependencia de `window.open`/`window.print`
—sensible a bloqueadores de pop-ups y sin control sobre el resultado— para los 3 flujos que hoy
quedan fuera del patrón ya establecido por el resto del sistema.

---

## 2. User Stories

`[TODO: completar en /spec-plan o a mano — no inventar alcance más allá del contexto de arriba]`

---

## 3. Acceptance Criteria (Gherkin)

`[TODO: completar]`

### Edge cases obligatorios

`[TODO: completar — considerar al menos: planillas en blanco (Route Sheet, EPQ) sin datos de
negocio que "exportar" más allá de las etiquetas de campo, comportamiento cuando la Edge Function
falla vs. el fallback actual de ventana bloqueada por el navegador]`

---

## 4. Out of scope

`[TODO: completar]`

- ❌ Los 8 flujos "Exportar como PDF/Excel" que ya usan Edge Function — no tocar, están correctos.

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- Patrón ya establecido en el resto del sistema: Facade llama
  `supabase.client.functions.invoke('generate-*', { body })`, recibe un buffer/Blob y lo descarga
  con un `<a download>` (ver `admin-alumnos.facade.ts:exportarFicha` como referencia más reciente).
- `core/utils/{ficha-tecnica,route-sheet,epq}-print.util.ts` — funciones puras que arman el HTML
  actual; sirven de referencia de contenido/maquetado para la Edge Function nueva.

### Capacidades nuevas requeridas
- 3 Edge Functions nuevas (o una compartida parametrizada — decisión de `/spec-plan`) que generen
  PDF server-side para: ficha técnica de clases prácticas, hoja de ruta diaria, test EPQ en blanco.

---

## 6. Datos y modelo (preliminar)

`[TODO: completar en /spec-plan]`

---

## 7. UX y flujos (preliminar)

`[TODO: completar — definir si el resultado sigue abriendo el diálogo de impresión del navegador
tras descargar el PDF, o si pasa a ser una descarga simple como el resto de "Exportar"]`

---

## 8. Métricas de éxito post-launch

`[TODO: completar]`

---

## 9. Notas / decisiones abiertas

- Originado de Asignación `ASG-i-002` (`specs/assignments/ASG-i-002-funciones-de-negocio-a-edge-functions.md`).
- El texto de la Asignación original describía un alcance genérico ("auditar lógica de negocio
  sensible"); el alcance real, confirmado por el dueño del negocio al reclamarla, es específicamente
  los 3 flujos de impresión listados en la sección 1.
- Decisión confirmada 2026-08-21: los 3 flujos migran a Edge Function aunque dos de ellos sean
  formularios en blanco sin dato de negocio — el criterio del dueño no distingue por eso, solo por
  "no usar HTML client-side para generar el documento".

---

## Changelog

- 2026-08-21 — draft inicial, generado al reclamar `ASG-i-002`. Alcance corregido en conversación
  respecto del texto original de la Asignación (ver sección 1 y sección 9).
