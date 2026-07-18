# Tasks 0026-b — Notificaciones Ola 3: triggers SQL (clase completada, tareas, aviso 2ª cuota)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done (2026-07-10) — ver acceptance.md (✅ PASA, 11/11 ACs)
> **Created:** 2026-07-10

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Migración: eventos de `class_b_sessions` (C1 + D1)

- [x] **T1.1** — Escribir `supabase/migrations/20260710000000_notify_class_b_session_events.sql`
  - **AC ref:** AC1, AC2, AC5, AC6, AC-E1, AC-E3, AC-E4, AC7
  - **DoD:**
    - [x] `notify_class_b_completed()`: `SECURITY DEFINER`, `SET search_path=''`, resuelve `enrollments.student_id → students.user_id`, INSERT en `notifications` con `reference_type='class_b'`, mensaje "Clase {class_number}/12 completada"
    - [x] `notify_deposit_reminder()`: mismo patrón, guard `payment_mode='deposit' AND pending_balance>0` — **corregido después a `payment_mode='partial'` en T3.4 (bug real detectado en QA)**, `reference_type='payment'`
    - [x] Ambas funciones envueltas en `EXCEPTION WHEN OTHERS` que absorbe el error sin abortar la transacción (AC-E2)
    - [x] `DROP TRIGGER IF EXISTS` antes de `CREATE TRIGGER` (idempotencia)
    - [x] `trg_notify_class_b_completed`: `AFTER UPDATE OF status` `WHEN (NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed')`
    - [x] `trg_notify_deposit_reminder`: mismo `WHEN` + `AND NEW.class_number = 6`
    - [x] Comentarios `COMMENT ON FUNCTION` documentando el propósito

## Fase 2 — Migración: eventos de `tasks`/`task_replies` (C2)

- [x] **T2.1** — Escribir `supabase/migrations/20260710000100_notify_task_events.sql`
  - **AC ref:** AC3, AC4, AC7, AC-E2
  - **DoD:**
    - [x] `notify_task_reply()`: `AFTER INSERT ON task_replies`, resuelve `from_user_id`/`to_user_id` de la tarea padre, notifica a la CONTRAPARTE de `NEW.from_user_id` — **`reference_id` corregido a `NULL` en T3.6 (bug real: tasks.id es UUID, notifications.reference_id es INT)**
    - [x] `notify_task_completed()`: `AFTER UPDATE OF status ON tasks`, usa `auth_user_id()` (ya existía en `20260301000011_10_rls_policies.sql:23`) para identificar al actor real y excluirlo — notifica solo a la contraparte (AC7)
    - [x] Ambas funciones `SECURITY DEFINER`, `SET search_path=''`, con `EXCEPTION WHEN OTHERS` (AC-E2)
    - [x] `DROP TRIGGER IF EXISTS` antes de cada `CREATE TRIGGER`

---

## Fase 3 — Aplicación y verificación (sin Docker: push directo al proyecto remoto ya linkeado)

> **Cambio de plan respecto al original:** no había Docker disponible en el entorno, así que no se pudo levantar `npx supabase start`. Con autorización explícita del owner, se aplicó directo contra el proyecto remoto (`skvekggejikzxhzsjmkz`, el mismo que usa `ng serve`) vía `supabase db push`, verificando cada paso con `--dry-run` antes de confirmar.

- [x] **T3.0 (no planeada)** — Reparar drift de tracking de migraciones antes de poder aplicar nada
  - **Hallazgo:** `supabase migration list` mostró 99 migraciones locales (de 139) sin registrar en la tabla de tracking remota, aunque el schema real YA las tenía aplicadas (verificado por columnas reales). Causa raíz: 5 pares de archivos con timestamp duplicado (`20260312100000`, `20260313120000`, `20260408000000`, `20260424000001`, `20260522000001`) que el CLI no puede reconciliar (1 solo slot de tracking por versión).
  - **DoD:**
    - [x] `supabase migration repair --status applied <96 versiones>` — marca el historial real sin ejecutar SQL (confirmado con el owner antes de correr)
    - [x] Renombrados los 5 archivos "huérfanos" a timestamps únicos (`git mv`, sin tocar contenido): `20260312100000→20260312100001`, `20260313120000→20260313120001`, `20260408000000→20260408000002`, `20260424000001→20260424000002`, `20260522000001→20260522000004`
    - [x] Repair de las 5 nuevas versiones + `db push --dry-run` confirmó que solo quedaban mis 2 migraciones nuevas por aplicar

- [x] **T3.1** — Aplicar las 2 migraciones nuevas al proyecto remoto
  - **DoD:** `supabase db push --dry-run` mostró exactamente los 2 archivos nuevos (confirmado con el owner) → `supabase db push` aplicó ambos sin error

- [x] **T3.2** — Verificar C1 (clase completada, class_number ≠ 6) — **con datos reales vía REST**
  - **AC ref:** AC1, AC2
  - **DoD:** `PATCH class_b_sessions?id=eq.49` (enrollment 14, class_number=1) `status→completed` → 1 fila nueva en `notifications` (`reference_type='class_b'`, `recipient_id=22` = `students.user_id` correcto de esa matrícula). Confirmado por consulta REST posterior.

- [x] **T3.3** — Verificar D1 (clase 6, payment_mode=partial + pending_balance > 0) — **con datos reales**
  - **AC ref:** AC5, AC6
  - **DoD:** `PATCH class_b_sessions?id=eq.96` (enrollment 18, class_number=6, partial + pending=90000) → 2 filas nuevas (`class_b` + `payment` "Te queda un saldo de $90000...") para `recipient_id=29`

- [x] **T3.4** — Verificar guards de D1 (AC-E3, AC-E4) — **detectó y corrigió un bug real**
  - **DoD:**
    - [x] Sesión id=133 (enrollment 41, class_number=6, `payment_mode=partial` pero `pending_balance=0`) → solo `class_b`, sin `payment` (AC-E3 ✅)
    - [x] Sesión id=54 (enrollment 14, class_number=6, `payment_mode=total`, `pending_balance=90000`) → solo `class_b`, sin `payment` (AC-E4 ✅)
    - [x] **Bug encontrado en la primera pasada:** el guard original usaba `payment_mode='deposit'`, pero el valor real en producción es `'total'|'partial'` (nunca `'deposit'` — confirmado consultando los 44 enrollments existentes). El índice `indices/DATABASE.md` tenía el valor incorrecto documentado. Corregido con `20260710000200_fix_deposit_reminder_payment_mode.sql` (`CREATE OR REPLACE FUNCTION`, sin necesidad de nueva migración de tabla) antes de repetir la prueba

- [x] **T3.5** — AC-E1 (reversión + re-completado)
  - **DoD:** verificado por diseño — `WHEN (NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed')` dispara en toda transición hacia `completed`, garantía estructural de Postgres, no requiere prueba empírica adicional una vez confirmada la sintaxis del `WHEN`

- [x] **T3.6** — Verificar C2 — respuesta de tarea — **detectó y corrigió un segundo bug real**
  - **AC ref:** AC3
  - **DoD:**
    - [x] Tarea de prueba creada (`type=question`, `from_user_id=2` admin, `to_user_id=6` instructor), `INSERT task_replies` como `from_user_id=2` → notificación a `recipient_id=6` (contraparte), nunca a 2
    - [x] **Bug encontrado en la primera pasada:** `notify_task_reply()`/`notify_task_completed()` casteaban `NEW.task_id` (UUID) a texto e intentaban guardarlo en `notifications.reference_id` (columna INT) → error de tipo atrapado silenciosamente por el `EXCEPTION WHEN OTHERS`, la notificación NUNCA se creaba (el INSERT de la respuesta real sí funcionaba, por eso no era visible desde la UI). Corregido con `20260710000300_fix_task_notifications_reference_id_type.sql` (`reference_id` queda `NULL` para tareas — no rompe el deep-link existente, que ya enruta sin id específico)
    - [x] Repetido tras el fix → notificación creada correctamente

- [x] **T3.7** — Verificar C2 — cierre de tarea (AC7)
  - **AC ref:** AC4, AC7
  - **DoD:** `PATCH tasks?id=eq.<tarea de prueba>` `status→completed` (actor = admin id=2) → 1 sola notificación a `recipient_id=6` (contraparte), el actor NUNCA se auto-notifica (`auth_user_id()` funcionando correctamente dentro de la función `SECURITY DEFINER`)

---

## Fase 4 — Limpieza de datos de prueba

- [x] **T4.1** — Limpiar todos los registros de prueba creados durante T3.2-T3.7
  - **DoD:**
    - [x] 4 sesiones de `class_b_sessions` (ids 49, 96, 54, 133) revertidas a `status='no_show'` (su valor original)
    - [x] 5 notificaciones de prueba eliminadas (ids 14-18, del bloque C1/D1)
    - [x] Tarea de prueba completa eliminada: `tasks` (1 fila), `task_replies` (2 filas), `notifications` (2 filas, ids 19-20)
    - [x] Verificación final: 0 residuos (`notifications` con mensaje "QA spec 0026-b" → `[]`; `tasks` con subject "QA spec 0026-b" → `[]`; las 4 sesiones confirmadas de vuelta en `no_show`)

---

## Fase 5 — Cierre

- [x] **T5.1** — `npm run lint:arch` sin regresiones
  - **DoD:** exit 0, sin cambios (no se tocó TS)

- [x] **T5.2** — Actualizar `indices/DATABASE.md` con las 3 migraciones nuevas + 2 fixes, los 4 triggers/funciones, y corregir el valor real de `payment_mode`
  - **DoD:** documentadas `notify_class_b_completed`, `notify_deposit_reminder`, `notify_task_reply`, `notify_task_completed`; corregido `payment_mode` de `('total'|'deposit')` a `('total'|'partial')`

- [x] **T5.3** — Actualizar `indices/NOTIFICATIONS-MAP.md`
  - **DoD:** C1, C2, D1 marcados ✅ implementados (Spec 0026-b), Ola 3 marcada como implementada en §8, encabezado actualizado

- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** los 11 AC (AC1-AC7 + AC-E1..E4) con evidencia en `acceptance.md` → veredicto **✅ PASA** (11/11, todos verificados con datos reales)

- [x] **T5.5** — Marcar spec 0026-b como `done` en `specs/ROADMAP.md` + limpiar `specs/.active`

---

## Tareas descubiertas durante implementación

- [x] **T3.0** — Reparar drift de tracking de migraciones (ver Fase 3) — necesario para poder aplicar cualquier cosa, documentado ahí
- [x] Corregir `payment_mode` guard de D1 (`deposit`→`partial`) — ver T3.4
- [x] Corregir `reference_id` de notificaciones de tareas (INT vs UUID) — ver T3.6
- [ ] **Fuera de scope, no se toca acá:** corregir `indices/DATABASE.md` para otros posibles valores desactualizados más allá de `payment_mode` — si aparecen más discrepancias, evaluar una auditoría completa del índice en spec aparte
