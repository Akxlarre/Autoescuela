# Asignación ASG-i-002 — Migrar funciones de negocio del cliente a Edge Functions

> **status:** completada
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-08-20
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-08-23
> **resulting_track:** 0011-m-print-flows-edge-functions

---

## Contexto / Objetivo

Buscar funciones exportadas con lógica de negocio (cálculos sensibles, validaciones críticas,
operaciones que requieren privilegios elevados o `service_role`) que hoy se ejecutan del lado
del cliente (Facades/servicios Angular) en vez de como Supabase Edge Function, y convertirlas
a Edge Function. El objetivo es que la lógica sensible deje de vivir expuesta en el bundle del
cliente y pase a ejecutarse server-side.

## Alcance sugerido

- Auditar `core/facades/` y `core/services/` en busca de funciones `export` con lógica de
  negocio no trivial (cálculos financieros, validaciones de reglas de negocio, operaciones que
  hoy dependen de RLS pero deberían ser atómicas/privilegiadas).
- Priorizar funciones que manipulan datos sensibles (pagos, cuadraturas, certificados) o que
  ya mostraron problemas de integridad (ver precedente de race conditions en `pending_balance`,
  `fix-114-m-race-condition-pending-balance-pagos`).
- Para cada candidata, evaluar si existe ya una `supabase/functions/` equivalente antes de
  crear una nueva.
- No migrar funciones puramente de presentación/formato — esas se quedan en el cliente.

## Referencias

- `fix-114-m-race-condition-pending-balance-pagos` (precedente de lógica de pagos con problemas
  de integridad por ejecutarse client-side)
- `ASG-b-046` (menciona preferir Edge Function sobre `pg_net` para integraciones)

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado

## Notas para quien la reclame

- Antes de estimar, leer `docs/TECH-STACK-RULES.md` y `.claude/rules/facades.md` para confirmar
  el criterio de "qué es lógica de negocio sensible" según el proyecto.
- Es candidata a `spec` si el listado de funciones a migrar termina siendo grande — el tipo
  sugerido (`fix`) es solo una primera estimación, ajustar según lo que encuentre la auditoría.

**Corrección de alcance (2026-08-21):** el dueño del negocio aclaró que el objetivo real, tal como
lo pidió quien creó esta Asignación, era más acotado que "auditar toda lógica de negocio
sensible": encontrar instancias de "Exportar como PDF/Excel" que generan el archivo como HTML en
el cliente en vez de Edge Function. Una auditoría preliminar encontró que los 8 botones
"Exportar" literales del sistema ya usan Edge Function (`export-students`,
`generate-financial-report`, `generate-cash-history-report`, `generate-audit-report`,
`generate-class-book-pdf`, `generate-enrollment-sheet`, `generate-contract-pdf`, y el de
servicios especiales) — ninguno pendiente ahí. El hallazgo real son **3 flujos de impresión**
(no "exportación", aunque el mismo anti-patrón) que arman HTML client-side y lo imprimen vía
`window.open()` + `window.print()` en vez de Edge Function:

1. `core/utils/ficha-tecnica-print.util.ts` + `FichaTecnicaPrintService` — informe de clases
   prácticas de un alumno real (botón "Imprimir Informe", `admin-ficha-tecnica-drawer`).
2. `core/utils/route-sheet-print.util.ts` — Hoja de Ruta Diaria de un vehículo (RF-091, planilla
   en blanco para llenar a mano).
3. `core/utils/epq-print.util.ts` + `EpqPrintService` — cuestionario EPQ en blanco (81 preguntas)
   para responder en papel.

El dueño confirmó que los tres deben migrarse a Edge Function, aunque dos sean formularios en
blanco sin dato de negocio y ninguno se llame literalmente "Exportar" — el criterio es "no usar
HTML client-side para generar el documento", sin excepción. Candidata a `spec` (no `fix`): las 3
migraciones implican decisión de diseño (Edge Function compartida vs. 3 separadas, qué pasa con
el flujo de impresión de los 2 formularios en blanco).
