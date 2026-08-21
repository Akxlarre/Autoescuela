# Asignación ASG-i-002 — Migrar funciones de negocio del cliente a Edge Functions

> **status:** reclamada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-08-20
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-08-21
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

**Corrección de alcance al reclamar (2026-08-21):** el dueño del negocio aclaró que el objetivo
real, tal como lo pidió quien creó esta Asignación, era más acotado que "auditar toda lógica de
negocio sensible": encontrar instancias de "Exportar como PDF/Excel" que generan el archivo como
HTML en el cliente en vez de Edge Function. La auditoría hecha al reclamar encontró que los 8
botones "Exportar" literales ya usan Edge Function; el hallazgo real fueron 3 flujos de
**impresión** (no exportación) que sí arman HTML client-side. Ver
`specs/specs/0011-m-print-flows-edge-functions/spec.md` §1 para el detalle completo.
