# Spec 0011 — Migrar flujos de impresión client-side a Edge Function

> **Status:** draft
> **Created:** 2026-08-23
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

_(pendiente — a completar por quien ejecute la spec)_

---

## 3. Acceptance Criteria (Gherkin)

_(pendiente — a completar por quien ejecute la spec)_

### Edge cases obligatorios

_(pendiente)_

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
- Definir en `plan.md`: Edge Function compartida vs. 3 separadas para los 3 flujos.
- Definir en `plan.md`: qué pasa con el flujo de impresión de los 2 formularios en blanco
  (Hoja de Ruta, EPQ) una vez el documento se genera server-side — ¿sigue siendo
  `window.open()` + `window.print()` mostrando el PDF recibido, o cambia la UX?

---

## 6. Datos y modelo (preliminar)

- Sin cambios de esquema esperados — los 3 flujos ya leen datos existentes (alumno, vehículo,
  formulario EPQ en blanco). A confirmar en `plan.md` si alguno requiere una tabla de auditoría
  de impresión (no mencionado en la Asignación).

---

## 7. UX y flujos (preliminar)

- Pantallas afectadas: `admin-ficha-tecnica-drawer` (botón "Imprimir Informe"), pantalla de
  Flota/vehículo (Hoja de Ruta Diaria, RF-091), pantalla donde se imprime el EPQ en blanco.
- El comportamiento visible al usuario (botón "Imprimir" → PDF listo para imprimir) no debería
  cambiar — el cambio es dónde se genera el HTML/PDF, no la experiencia de impresión.

---

## 8. Métricas de éxito post-launch

- Cero flujos de generación de documento/impresión ejecutándose client-side (HTML armado en
  Angular + `window.print()`) — el sistema queda 100% consistente en Edge Function para esto.

---

## 9. Notas / decisiones abiertas

- [ ] Edge Function compartida vs. 3 separadas — decidir en `plan.md`.
- [ ] UX de los 2 formularios en blanco (Hoja de Ruta, EPQ) tras la migración — decidir en
  `plan.md`.
- Originado de Asignación ASG-i-002 (specs/assignments/ASG-i-002-funciones-de-negocio-a-edge-functions.md)

---

## Changelog

- 2026-08-23 — draft inicial por m, a partir de ASG-i-002 (alcance ya corregido por el dueño el
  2026-08-21 a los 3 flujos de impresión).
