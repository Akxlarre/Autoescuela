# Fix: Bugs en el sistema de audit_log (detectados en QA de spec 0006-m)
> id: fix-145-m-bugs-audit-log-qa-0006-m
> refs: — (independiente, detectado en QA de 0006-m-matricula-refuerzo-clase-b, no ligado a sus ACs)
> status: in_progress
> created: 2026-08-09

## Root Cause
<!-- Qué estaba mal y por qué pasó. Una sola causa raíz. -->
Tres problemas distintos en `log_change()` / `audit_resolve_display_value()` (trigger de
auditoría), detectados durante QA manual de la spec 0006-m pero no relacionados con ella:

1. **Query rota dentro del trigger**: al confirmar una matrícula con pago
   (`confirm_enrollment_with_payment` → `recalculate_enrollment_balance` → `log_change()`)
   aparece en logs de Postgres `audit_log error: relation "students" does not exist`
   (`WARNING`, `sql_state_code=01000`). No revierte la transacción, pero indica una referencia
   a `students` sin schema/`search_path` correcto dentro de una función `SECURITY DEFINER`.
2. **FK sin humanizar**: el feed de actividad muestra "Theory Cycle Id: Sin asignar -> 9" en
   vez del nombre/código del ciclo teórico — falta esa columna en el diccionario de
   `audit_resolve_display_value()`.
3. **Ruido de campos técnicos**: cambios a `supabase_uid` y `license_initial_url` generan
   entradas visibles en el feed que no aportan nada al usuario — faltan en la lista de
   columnas "silenciosas" de `log_change()`.

## ACs Afectados
<!-- Lista los ACs de la spec original que este fix corrige. -->
- Ninguno — fix autónomo sobre el sistema de audit_log (no forma parte de los ACs de 0006-m).

## Cambio
<!-- Archivo tocado y descripción en una línea. Un fix = un cambio puntual. -->
- **Archivo:** nueva migración SQL sobre `log_change()` / `audit_resolve_display_value()`
  (última tocada: `supabase/migrations/20260805090000_*.sql`, ver `indices/DATABASE.md` §`log_change()`
  para el historial completo: fix-097-m, fix-099-m, fix-102-m, fix-103-m, fix-104-m, fix-106-m, fix-108-m)
- **Qué cambia:**
  1. Corrige la referencia rota a `students` dentro del trigger/función de resolución de diff.
  2. Agrega `theory_cycle_id` (confirmar nombre real de columna en `audit_log`) al diccionario
     de humanización.
  3. Agrega `supabase_uid` y las columnas `*_url` de storage relevantes
     (`license_initial_url`, `license_full_url`, `certificate_b_pdf_url`, etc. — confirmar
     cuáles aplican) a la lista de columnas silenciosas (no generan entrada visible, aunque
     sigan auditándose a nivel de BD si aplica).
- **Fuera de alcance:** rediseñar el sistema de audit_log completo.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Reproducir contra Supabase local con logging detallado ANTES de tocar el trigger (patrón de
  "fix no verificado contra Supabase local" ya causó regresiones previas en este trigger —
  ver `indices/DATABASE.md`).
- Confirmar matrícula con pago → sin `WARNING` de `relation "students" does not exist` en logs.
- Feed de actividad muestra el nombre/código del ciclo teórico en vez del ID crudo.
- Feed de actividad no muestra entradas para cambios en `supabase_uid` / `license_initial_url`.

## Referencias
- `indices/DATABASE.md` → sección `log_change()`
- `indices/DOMAIN-GOTCHAS.md` → DG-049
- Originado como ASG-m-001, absorbida en este fix directo (sin paso de Asignación) el 2026-08-09.
