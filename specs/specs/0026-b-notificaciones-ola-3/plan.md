# Plan 0026-b — Notificaciones Ola 3: triggers SQL (clase completada, tareas, aviso 2ª cuota)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (2026-07-10)
> **Created:** 2026-07-10
> **Talla:** M (2 migraciones SQL nuevas, 0 archivos Angular, 0 facades — todo el productor vive en BD)

---

## 1. Resumen ejecutivo

A diferencia de Ola 1 y 2 (donde el actor siempre era admin/secretaria y el cliente podía insertar en `notifications` directamente), Ola 3 cubre eventos donde el actor es **instructor** (terminar clase) o **cualquiera de las dos partes de una tarea** (alumno/instructor/secretaria/admin según el caso) — roles sin permiso de INSERT en `notifications` vía RLS. La solución es 100% en base de datos: 2 migraciones SQL nuevas con funciones `SECURITY DEFINER` que se disparan como triggers `AFTER UPDATE`/`AFTER INSERT` sobre tablas existentes, replicando el patrón ya usado por `trg_enable_certificate_b` (`supabase/migrations/20260301000008_08_misc_and_triggers.sql:451`). Cero cambios en Angular — ningún facade, componente ni Edge Function se toca.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Contenido |
|------|-----------|
| `supabase/migrations/20260710000000_notify_class_b_session_events.sql` | 2 funciones + 2 triggers sobre `class_b_sessions`: `notify_class_b_completed()` (C1) y `notify_deposit_reminder()` (D1), ambas `AFTER UPDATE OF status` |
| `supabase/migrations/20260710000100_notify_task_events.sql` | 2 funciones + 2 triggers: `notify_task_reply()` (`AFTER INSERT ON task_replies`, C2) y `notify_task_completed()` (`AFTER UPDATE OF status ON tasks`, C2) |

### Archivos a MODIFICAR

Ninguno. No hay cambio en `src/app/`.

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Patrón SQL existente que replicamos
- `trg_enable_certificate_b` (`20260301000008_08_misc_and_triggers.sql:451`): `AFTER UPDATE OF status ON class_b_sessions FOR EACH ROW WHEN (NEW.status = 'completed' AND NEW.class_number = 12)`. Confirma que `class_number` es confiable como secuencial 1-12 — mismo campo que usamos para C1 (cualquier número) y D1 (`= 6`).
- El proyecto ya usa `SECURITY DEFINER` extensivamente (68 ocurrencias en `supabase/migrations/`) para funciones que necesitan bypasear RLS — mismo patrón para nuestras 4 funciones nuevas, ya que todas necesitan `INSERT INTO notifications` sin importar qué rol disparó el evento original (instructor/alumno no tienen permiso de INSERT ahí vía RLS).
- `SET search_path = ''` en cada función (ya es el estándar del archivo `08_misc_and_triggers.sql` — previene search_path hijacking en funciones `SECURITY DEFINER`).

### Tablas/columnas existentes que reutilizamos (verificado contra `indices/DATABASE.md`)
- `class_b_sessions`: `id`, `enrollment_id`, `class_number`, `status`, `instructor_id` (→ `instructors.id`).
- `enrollments`: `student_id` (→ `students.id`), `payment_mode` (`'total'|'partial'` — corregido, ver Changelog: el índice documentaba erróneamente `'deposit'`), `pending_balance`.
- `students.user_id`, `instructors.user_id` — mismo join que usaron los helpers Angular `resolveStudentUserId`/`resolveInstructorUserIds` en Ola 1/2, ahora expresado en SQL puro.
- `tasks`: `id`, `from_user_id`, `to_user_id`, `status`. `task_replies`: `id`, `task_id`, `from_user_id`.
- `notifications`: sin cambios de schema — mismas columnas que usa `NotificationsFacade.notifyUsers()` (`recipient_id`, `type`, `subject`, `message`, `reference_type`, `reference_id`, `read`, `sent_ok`).

### Componentes/Facades que NO se tocan
- Nada en Angular. El panel de notificaciones, `NotificationsFacade`, Realtime — todo ya funciona porque la fila se inserta igual en `notifications`, sin importar si el INSERT vino de un trigger SQL o de un `.from('notifications').insert()` del cliente. Realtime está suscrito a la tabla base, no le importa el origen del INSERT.

---

## 4. Modelo de datos

### C1 — `notify_class_b_completed()`

```sql
CREATE OR REPLACE FUNCTION notify_class_b_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_user_id INT;
BEGIN
  SELECT s.user_id INTO v_student_user_id
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  WHERE e.id = NEW.enrollment_id;

  IF v_student_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES (v_student_user_id, 'system', 'Clase completada',
            'Clase ' || NEW.class_number || '/12 completada.', 'class_b', NEW.enrollment_id, false, true);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_class_b_completed error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_class_b_completed
  AFTER UPDATE OF status ON class_b_sessions
  FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION notify_class_b_completed();
```

### D1 — `notify_deposit_reminder()` (mismo evento, guard distinto)

```sql
CREATE OR REPLACE FUNCTION notify_deposit_reminder()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student_user_id INT;
  v_pending INT;
BEGIN
  SELECT s.user_id, e.pending_balance INTO v_student_user_id, v_pending
  FROM public.enrollments e
  JOIN public.students s ON s.id = e.student_id
  WHERE e.id = NEW.enrollment_id AND e.payment_mode = 'partial' AND e.pending_balance > 0;

  IF v_student_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES (v_student_user_id, 'system', 'Pago pendiente',
            'Te queda un saldo de $' || v_pending || ' por pagar antes de tu próxima clase.', 'payment', NEW.enrollment_id, false, true);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_deposit_reminder error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_deposit_reminder
  AFTER UPDATE OF status ON class_b_sessions
  FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.class_number = 6)
  EXECUTE FUNCTION notify_deposit_reminder();
```

**Nota de diseño:** C1 y D1 son 2 triggers separados sobre el mismo evento (no 1 trigger con 2 INSERTs) para que cada uno tenga su propio `WHEN` y sea independiente — si D1 necesita desactivarse o ajustarse a futuro, no afecta C1. Postgres permite múltiples triggers `AFTER UPDATE` sobre la misma tabla/evento sin conflicto (corren en orden alfabético del nombre del trigger).

### C2 — `notify_task_reply()` y `notify_task_completed()`

```sql
CREATE OR REPLACE FUNCTION notify_task_reply()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from INT; v_to INT; v_recipient INT; v_subject TEXT;
BEGIN
  SELECT from_user_id, to_user_id, subject INTO v_from, v_to, v_subject
  FROM public.tasks WHERE id = NEW.task_id;

  v_recipient := CASE WHEN NEW.from_user_id = v_from THEN v_to ELSE v_from END;

  IF v_recipient IS NOT NULL AND v_recipient != NEW.from_user_id THEN
    INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES (v_recipient, 'system', 'Nueva respuesta',
            'Respondieron en: ' || v_subject, 'task', NULL, false, true);
            -- reference_id NULL: tasks.id es UUID, notifications.reference_id es INT (corregido, ver Changelog)
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_reply error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_task_reply
  AFTER INSERT ON task_replies
  FOR EACH ROW EXECUTE FUNCTION notify_task_reply();
```

```sql
CREATE OR REPLACE FUNCTION notify_task_completed()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor INT;
  v_recipient INT;
BEGIN
  -- auth_user_id() ya existe en el proyecto (20260301000011_10_rls_policies.sql:23):
  -- resuelve users.id desde auth.uid(), disponible en cualquier función SECURITY DEFINER
  -- dentro de una request autenticada. Permite excluir al actor real (AC7), sin necesitar
  -- notificar a ambas partes.
  v_actor := public.auth_user_id();
  v_recipient := CASE WHEN v_actor = NEW.from_user_id THEN NEW.to_user_id ELSE NEW.from_user_id END;

  IF v_recipient IS NOT NULL AND v_recipient != v_actor THEN
    INSERT INTO public.notifications (recipient_id, type, subject, message, reference_type, reference_id, read, sent_ok)
    VALUES (v_recipient, 'system', 'Tarea completada', NEW.subject, 'task', NEW.id::text, false, true);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_task_completed error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_task_completed
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION notify_task_completed();
```

**Resuelto (ya no es riesgo abierto):** se descubrió que `auth_user_id()` ya existe en el proyecto (`20260301000011_10_rls_policies.sql:23`) — resuelve `users.id` desde `auth.uid()`, disponible dentro de cualquier función `SECURITY DEFINER` en el contexto de una request autenticada. Se usa para identificar al actor real que cerró la tarea y excluirlo del destinatario, cumpliendo AC7 sin necesitar el fallback de "notificar a ambas partes". Caso borde: si `auth_user_id()` devuelve `NULL` (ej. la actualización la dispara un job de sistema sin JWT, no un usuario), `v_actor` es `NULL` y `v_recipient` cae en `NEW.from_user_id` por defecto de la comparación `CASE` — se documenta como aceptable porque hoy no existe ningún flujo que cierre tareas sin un usuario autenticado detrás.

### RLS

Sin cambios en policies. Las 4 funciones son `SECURITY DEFINER`, bypasean el RLS de `notifications` (y de lectura en `enrollments`/`students`/`instructors`/`tasks`) sin necesidad de tocar ninguna policy existente — mismo mecanismo que ya usan 68 funciones del proyecto.

---

## 5. Arquitectura del feature

### Flujo productor → consumidor

```
[Eventos de escritura, actor = instructor/alumno/cualquiera]
 InstructorClasesFacade.finishClass()
   → UPDATE class_b_sessions SET status='completed' ─┬─ trg_notify_class_b_completed (siempre)
                                                       └─ trg_notify_deposit_reminder (solo class_number=6)
 TasksFacade.addReply() → INSERT task_replies ── trg_notify_task_reply
 TasksFacade.updateStatus('completed') → UPDATE tasks ── trg_notify_task_completed
                                                                    │
                                            (los 4 triggers, SECURITY DEFINER)
                                                                    ▼
                                                    INSERT notifications (bypassa RLS)
                                                                    │ Realtime
                                                                    ▼
                                      NotificationsFacade (sin cambios — ya escucha la tabla base)
                                                                    ▼
                                          TopbarComponent → <app-notifications-panel>
```

### Capas tocadas

- **Solo BD**: `supabase/migrations/`. Cero Angular.
- El panel de notificaciones YA maneja `reference_type` `class_b`, `payment` y `task` desde Ola 1 — sin cambios de ícono ni deep-link necesarios.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [ ] `architecture.md` — no aplica, sin código Angular
- [ ] `facades.md` — no aplica
- [ ] `models.md` — no aplica
- [ ] `visual-system.md` — no aplica, cero UI nueva
- [ ] `swr-pattern.md` — no aplica
- [x] `notifications.md` — regla madre respetada: el INSERT en `notifications` nunca lo hace un Dumb component; en este caso ni siquiera pasa por Angular, es 100% servidor
- [ ] `testing-tdd.md` — no aplica en el sentido de Vitest (no hay TS nuevo); ver plan de testing SQL abajo
- [ ] `ai-readability.md` — no aplica
- [x] `database.md` — **regla crítica de este proyecto**: SQL idempotente (`CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` antes de crear), documentar en `indices/DATABASE.md` tras aplicar

---

## 7. Plan de testing

- **Sin harness de test automatizado para triggers SQL** (Vitest no ejecuta contra Postgres real). Mismo criterio que las Edge Functions de Ola 1/2.
- **Verificación local obligatoria** con `npx supabase start` antes de aplicar a producción:
  1. Aplicar las 2 migraciones nuevas contra el stack local.
  2. `UPDATE class_b_sessions SET status='completed' WHERE id=<sesión de prueba con class_number != 6>` → verificar 1 fila nueva en `notifications` (`reference_type='class_b'`).
  3. Repetir con una sesión `class_number=6` de una matrícula `payment_mode='partial'` y `pending_balance>0` → verificar 2 filas (`class_b` + `payment`).
  4. Repetir con `class_number=6` pero `pending_balance=0` → verificar que NO se genera la fila `payment` (AC-E3).
  5. `INSERT INTO task_replies (task_id, from_user_id, body) VALUES (...)` → verificar que se notifica a la CONTRAPARTE, no a quien respondió.
  6. `UPDATE tasks SET status='completed' WHERE id=...` (autenticado como una de las dos partes) → verificar que solo se notifica a la CONTRAPARTE, no a quien cerró (AC7).
  7. Confirmar que revertir `status` de `'completed'` a otro valor y volver a `'completed'` sí re-dispara (comportamiento esperado, no es un caso de "no duplicar" real — cada transición hacia completed es un evento legítimo).
- **QA en vivo con datos reales** (mismo patrón que Ola 2, spec 0025): usar el token de sesión admin + REST directo para verificar `notifications.recipient_id` tras disparar cada evento desde la UI real (`instructor-clases`, `tareas`), aprovechando que RLS `select_notifications` permite a `admin` leer todas las filas. Limpiar cualquier fila de prueba al terminar.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Un trigger `SECURITY DEFINER` mal escrito podría insertar en `notifications` con datos incorrectos y no hay forma fácil de "deshacer" sin acceso a BD | Media | Los 4 bloques tienen `EXCEPTION WHEN OTHERS` que absorbe cualquier error sin abortar la transacción de negocio (AC-E2) — y se prueban localmente antes de aplicar (paso obligatorio del plan de testing) |
| `class_number` podría no ser secuencial 1-12 en matrículas viejas con reprogramaciones raras | Baja | Ya es el mismo supuesto que usa `trg_enable_certificate_b` en producción hoy — si hay drift ya sería un bug pre-existente, no introducido por esta spec |
| Reprogramar una clase que ya estaba en `completed` de vuelta a `scheduled` y re-completarla dispara notificación de nuevo | Baja | Comportamiento aceptado (AC-E1): cada transición hacia `completed` es un evento legítimo de negocio, no un duplicado a evitar |
| Migraciones no idempotentes si se re-corren | Baja | `CREATE OR REPLACE FUNCTION` (siempre idempotente) + `DROP TRIGGER IF EXISTS ...` antes de `CREATE TRIGGER` (patrón estándar del proyecto) |

---

## 9. Orden de implementación

1. Migración 1 (`class_b_sessions`): escribir `notify_class_b_completed()` + `notify_deposit_reminder()` y sus triggers.
2. Migración 2 (`tasks`/`task_replies`): escribir `notify_task_reply()` + `notify_task_completed()` y sus triggers.
3. `npx supabase start` (si no está corriendo) y aplicar ambas migraciones localmente.
4. Ejecutar los 7 pasos de verificación local del plan de testing (§7).
5. QA en vivo con datos reales (mismo patrón que spec 0025) contra el proyecto de desarrollo remoto, con limpieza posterior.
6. `npm run lint:arch` (no debería reportar nada nuevo, no hay TS tocado) + actualizar `indices/DATABASE.md` con las 2 migraciones nuevas.
7. `/spec-verify` → `acceptance.md`.

---

## 10. Estimación

**M — 1 a 2 días.** Día 1: escribir y probar localmente las 4 funciones/triggers (pasos 1-4). Día 2: QA en vivo + documentación + cierre.

---

## Changelog

- 2026-07-10 — plan inicial (talla M, por analogía con Ola 1/2 pero 100% SQL en vez de Angular)
- 2026-07-10 — implementado y verificado con datos reales. Sin Docker disponible, se aplicó directo al proyecto remoto (autorización del owner en cada paso) en vez de `supabase start` local. Se encontraron y corrigieron 2 bugs reales durante el QA en vivo:
  1. El guard de D1 usaba `payment_mode='deposit'`, pero el valor real en producción es `'total'|'partial'` (`indices/DATABASE.md` documentaba mal esta columna) — corregido en `20260710000200_fix_deposit_reminder_payment_mode.sql`.
  2. `notify_task_reply()`/`notify_task_completed()` intentaban guardar `tasks.id` (UUID) en `notifications.reference_id` (columna INT) — fallaba silenciosamente (atrapado por el `EXCEPTION WHEN OTHERS`), la notificación nunca se creaba. Corregido en `20260710000300_fix_task_notifications_reference_id_type.sql` (`reference_id` queda `NULL` para tareas).
  - También se descubrió y reparó un drift pre-existente en el tracking de migraciones remoto (99 de 139 migraciones no registradas, aunque sí aplicadas) y 5 pares de archivos con timestamp duplicado — ver `tasks.md` Fase 3 para el detalle completo.
