# Fix: Bugs en el sistema de audit_log (detectados en QA de spec 0006-m)
> id: fix-145-m-bugs-audit-log-qa-0006-m
> refs: — (independiente, detectado en QA de 0006-m-matricula-refuerzo-clase-b, no ligado a sus ACs)
> status: done
> closed: 2026-08-09
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
4. **Clase teórica sin detalle**: al registrar una clase teórica se observó en el feed "Nueva
   clase teórica / PEPITO ADMI registró: Sesión teórica -" — el detalle queda vacío (guion
   suelto tras "Sesión teórica"). Detectado puntualmente sobre una matrícula de refuerzo (spec
   0006-m) que creó un ciclo teórico nuevo, pero **no está confirmado si es específico de ese
   camino o un bug general del resolver de clase teórica** — falta reproducir contra una
   matrícula regular antes de asumir causa raíz.
5. **Pago con monto y matrícula sin resolver**: al registrar un pago en efectivo se observó en
   el feed "Nuevo pago / PEPITO ADMI registró: $0 (Desconocido) de Pedro Morales (Matrícula ?)"
   — el monto aparece en $0, el método de pago como "Desconocido" (debería decir "Efectivo") y
   el label de matrícula como "?" en vez del código/identificador real. Detectado puntualmente
   sobre una matrícula de refuerzo, pero **no está confirmado si es específico de ese camino o
   un bug general del resolver de pagos** — falta reproducir contra un pago sobre matrícula
   regular antes de asumir causa raíz.

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
  4. Primero reproducir contra matrícula regular vs. matrícula de refuerzo para acotar el
     alcance real; luego corregir el resolver de "Nueva clase teórica" para que muestre el
     detalle de la sesión (nombre/código de ciclo o número de sesión) en vez de dejar "Sesión
     teórica -" vacío.
  5. Primero reproducir contra matrícula regular vs. matrícula de refuerzo para acotar el
     alcance real; luego corregir el resolver de "Nuevo pago" para que resuelva monto, método de
     pago y matrícula asociada en vez de caer en $0 / "Desconocido" / "Matrícula ?".
- **Fuera de alcance:** rediseñar el sistema de audit_log completo.

## Test de Regresión
<!-- El test que prueba que el fix funciona. Debe quedar verde post-fix. -->
- Reproducir contra Supabase local con logging detallado ANTES de tocar el trigger (patrón de
  "fix no verificado contra Supabase local" ya causó regresiones previas en este trigger —
  ver `indices/DATABASE.md`).
- Confirmar matrícula con pago → sin `WARNING` de `relation "students" does not exist` en logs.
- Feed de actividad muestra el nombre/código del ciclo teórico en vez del ID crudo.
- Feed de actividad no muestra entradas para cambios en `supabase_uid` / `license_initial_url`.
- Crear un ciclo teórico vía matrícula de refuerzo Y vía matrícula regular → comparar; el feed
  debe mostrar el detalle de la sesión en ambos casos (no "Sesión teórica -" vacío).
- Registrar un pago en efectivo sobre una matrícula de refuerzo Y sobre una matrícula regular →
  comparar; el feed debe mostrar el monto real, método "Efectivo" y la matrícula identificada en
  ambos casos (no "$0 (Desconocido)" ni "Matrícula ?").

## Referencias
- `indices/DATABASE.md` → sección `log_change()`
- `indices/DOMAIN-GOTCHAS.md` → DG-049, **DG-058** (nueva, específica de este fix)
- Originado como ASG-m-001, absorbida en este fix directo (sin paso de Asignación) el 2026-08-09.

## Verificación (2026-08-09)
Reproducido y corregido contra Supabase local (Docker) antes de cerrar — migración
`supabase/migrations/20260809100000_fix145_audit_log_search_path_theory_cycle_payments.sql`:

- **Causa raíz real, distinta a la hipótesis inicial en 2 de los 5 puntos**: bug 4 y 5 SÍ
  tenían causa raíz confirmada y **no son específicos de la matrícula de refuerzo** — ocurren en
  cualquier matrícula/pago/clase teórica. Bug 5 además reveló dos sub-causas no anticipadas:
  `payments` nunca tuvo columnas `amount`/`method` (tiene `total_amount` +
  `cash_amount`/`transfer_amount`/`card_amount`/`voucher_amount`), y `confirm_enrollment_with_payment()`
  inserta el pago antes de asignar `enrollments.number` (por diseño, no se tocó el RPC).
- Confirmar matrícula con pago (`confirm_enrollment_with_payment` real) → sin `WARNING`
  `relation "students" does not exist`; la entrada de auditoría del recálculo de saldo
  (`Saldo pendiente: ... ; Total pagado: ...`) ahora SÍ se registra. ✅
- Feed muestra `theory_cycle_id` como "Ciclo DD-MM-YYYY al DD-MM-YYYY" en vez del ID crudo. ✅
- Cambios a `supabase_uid` / `license_initial_url` ya no generan entrada en el feed. ✅
- `ensure_theory_cycle()` (creación de ciclo nuevo, camino compartido por refuerzo y matrícula
  regular) → feed muestra "Clase teórica N°1 - 05-10-2026" en vez de "Sesión teórica -" vacío. ✅
- Pago vía `confirm_enrollment_with_payment()` → feed muestra "$300000 (Efectivo) de Pedro
  Morales (Curso Test B3)" — monto y método correctos; matrícula identificada por nombre de
  curso en vez de "?" (el número real aún no existe en ese instante, por diseño del RPC).
  **Ajuste post-verificación:** la primera versión usaba `'Matrícula #' || e.id` (el PK interno
  de Supabase) como fallback — el usuario señaló correctamente que ese id no significa nada para
  quien lee el feed. Se cambió a `COALESCE(e.number, c.name)` (nombre del curso, ya se hacía
  JOIN a `courses` en otras ramas de `log_change()`). ✅
- Datos de prueba (branch/course/user/student/enrollment) limpiados de la BD local tras cada
  verificación.
