# Spec 0026-b — Notificaciones Ola 3 (triggers SQL para actor instructor/alumno + aviso de cuota)

> **Status:** done
> **Created:** 2026-07-10
> **Owner:** Akxlarre
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** `indices/NOTIFICATIONS-MAP.md` (mapa de productores, creado en Spec 0024), sección "Priorización acordada" — Ola 3. Grupo C del mapa.

**Persona afectada:** Alumno, Instructor, Secretaria/Admin (contraparte de tareas).

**Problema que resuelve:**
Las Olas 1 y 2 (Specs 0024/0025) solo cubrieron eventos donde el actor es admin/secretaria, porque el RLS de `notifications` únicamente permite INSERT desde el cliente para esos dos roles. Cuando el actor real del evento es un **instructor** (terminar una clase) o cualquiera de las dos partes de una tarea (responder, cerrar), hoy no se genera ninguna notificación — ni siquiera para admin/secretaria en el caso de tareas. Además, el alumno con matrícula por abono no recibe ningún aviso antes de que se le acumulen clases sin pagar la segunda cuota (RF-018).

**Hipótesis de valor:**
Cerrar estos tres eventos reduce la dependencia de que el alumno/instructor revise manualmente el estado de sus clases y tareas, y anticipa la cobranza de la segunda cuota antes de que se acumule mora.

---

## 2. User Stories

- **US1**: Como alumno de Clase B, quiero recibir una notificación cuando el instructor marca mi clase práctica como completada, para saber mi avance (ej. "clase 5/12").
- **US2**: Como emisor o receptor de una tarea, quiero recibir una notificación cuando la contraparte responde en el hilo, para no tener que revisar manualmente.
- **US3**: Como emisor o receptor de una tarea, quiero recibir una notificación cuando la tarea se marca como completada.
- **US4**: Como alumno con matrícula por abono (pago parcial), quiero recibir un aviso antes de mi 7ª clase práctica si todavía no pagué la segunda cuota, para regularizar a tiempo.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 (C1 — Clase completada)**: Given una sesión de `class_b_sessions` en curso, When el instructor la marca como `status='completed'` (vía `InstructorClasesFacade.finishClass()`), Then el alumno de esa matrícula recibe una notificación tipo `class_b` con el número de clase (ej. "Clase 5/12 completada").
- **AC2 (C1 — vía trigger, no cliente)**: Given cualquier camino que actualice `class_b_sessions.status` a `'completed'` (no solo `finishClass()`), When el UPDATE se confirma en BD, Then la notificación se dispara igual, porque el productor es un **trigger SQL** en la tabla, no código Angular.
- **AC3 (C2 — Respuesta en tarea)**: Given una tarea con hilo de tipo `question`, When cualquiera de las partes (`from_user_id` o `to_user_id`) inserta una fila en `task_replies`, Then la **contraparte** (el otro de los dos) recibe una notificación tipo `task`, nunca quien escribió la respuesta.
- **AC4 (C2 — Cierre de tarea)**: Given una tarea en estado `pending` o `in_progress`, When `tasks.status` pasa a `completed`, Then la contraparte de quien la cerró recibe una notificación tipo `task`.
- **AC5 (D1 — Aviso de 2ª cuota)**: Given una matrícula Clase B con `payment_mode='deposit'` y `pending_balance > 0`, When la clase práctica N° 6 de esa matrícula pasa a `status='completed'` (mismo trigger de escritura que C1, reutilizando el patrón de `trg_enable_certificate_b`), Then el alumno recibe una notificación tipo `payment` avisando que debe pagar la 2ª cuota antes de su próxima clase (la 7ª).
- **AC6 (No duplicado D1)**: Given que la clase N° 6 ya se completó una vez y ya se notificó, When por alguna razón se vuelve a disparar el UPDATE (ej. corrección de datos), Then no debe reenviarse el aviso — el trigger solo dispara en la transición puntual hacia `completed` (`OLD.status IS DISTINCT FROM 'completed'`), igual que C1; no requiere tabla de control ni cron.
- **AC7 (Anti-ruido, actor no se auto-notifica)**: Given cualquiera de los tres eventos, When el trigger resuelve destinatarios, Then el actor que causó el evento nunca aparece como destinatario de su propia acción.

### Edge cases obligatorios

- **AC-E1**: Given una clase que se marca `completed` pero luego se revierte (vuelve a `pending`/`scheduled`) y se vuelve a completar, When esto ocurre, Then el trigger no debe disparar en la transición de reversión, solo en la transición **hacia** `completed`.
- **AC-E2**: Given una tarea sin `to_user_id` resoluble (dato inconsistente) o una respuesta de un tercero que no es ninguna de las dos partes originales, When el trigger corre, Then no debe fallar el INSERT/UPDATE original — el trigger nunca debe abortar la transacción de negocio por un error de notificación.
- **AC-E3**: Given una matrícula que llega a la clase 6 completada pero ya con `pending_balance=0` (pagó antes de tiempo), When el trigger de D1 corre, Then no genera aviso (guard `pending_balance > 0` en la condición del trigger).
- **AC-E4**: Given una matrícula de Clase B pagada al contado (`payment_mode='total'`, sin abono), When se completa su clase 6, Then nunca se le genera un aviso de 2ª cuota (guard `payment_mode='deposit'`).

---

## 4. Out of scope

- ❌ D2 (envío automático de Zoom), D3 (vencimiento docs de flota como notificación), D4 (encuesta de fin de curso) → Ola 4.
- ❌ Canales externos (email/WhatsApp) → Ola 4.
- ❌ Página "ver todas las notificaciones" para admin/secretaria/alumno → sigue sin resolverse, no es parte de esta spec.
- ❌ Extender el trigger de C1 a Clase Profesional (solo cubre Clase B, `class_b_sessions`) — si se necesita para profesional, spec nueva.
- ❌ Cualquier cambio al flujo de pago o al cálculo de `pending_balance` — D1 solo lee ese campo, no lo modifica.

---

## 5. Dependencias

### Specs previas
- Spec 0024 (Ola 1) y Spec 0025 (Ola 2) — ambas `done`. Reutiliza `notifications`, `NotificationReferenceType` (`class_b`, `task`, `payment` ya existen).

### Capacidades del proyecto que se asumen existentes
- `class_b_sessions.status`/`completed_at`, `tasks.status`/`from_user_id`/`to_user_id`, `task_replies.from_user_id` (confirmado contra `indices/DATABASE.md`).
- `enrollments.payment_mode`/`pending_balance`/`payment_status` (confirmar exactamente cuáles existen al planificar — el mapa asume que ya están).

### Capacidades nuevas requeridas
- **Función/trigger SQL** `AFTER UPDATE OF status ON class_b_sessions` (C1 y D1 — mismo patrón que el trigger existente `trg_enable_certificate_b`, `WHEN (NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed')`).
- **Función/trigger SQL** `AFTER INSERT ON task_replies` + `AFTER UPDATE OF status ON tasks` (C2).
- D1 se resuelve con el **mismo trigger de C1** (o uno hermano en la misma tabla/evento), agregando el guard `NEW.class_number = 6 AND payment_mode='deposit' AND pending_balance > 0` — sin pg_cron, sin tabla de control.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas: ninguna. C1, C2 y D1 son triggers puros en `supabase/migrations/`, sin columnas ni tablas de control adicionales (a diferencia del borrador inicial de esta spec, que asumía un mecanismo de cron para D1 — descartado, ver §9).
- RLS: sin cambios — los triggers corren como `SECURITY DEFINER`, no dependen de la policy de INSERT del cliente en `notifications` (igual que `trg_enable_certificate_b` ya hace con `enrollments`).

---

## 7. UX y flujos (preliminar)

- Pantalla(s) afectada(s): ninguna nueva — solo la campana/panel de notificaciones ya existente en los 4 portales.
- Flujo principal: evento de BD (UPDATE/INSERT) → trigger → INSERT en `notifications` → Realtime → campana.
- D1: corre en background (cron), el alumno simplemente ve la notificación aparecer en su próxima visita o vía Realtime si está conectado.

---

## 8. Métricas de éxito post-launch

- Reducción de instructores/alumnos preguntando manualmente "¿en qué clase voy?" o "¿me respondieron la tarea?".
- % de matrículas con abono que regularizan el pago antes de la clase 7 tras recibir el aviso (requiere instrumentación futura).

---

## 9. Notas / decisiones abiertas

- [x] ✅ Decidido 2026-07-10: usar **trigger SQL** (no RLS ampliado, no EF nueva) para resolver el bloqueo de actor instructor/alumno en C1 y C2.
- [x] ✅ Decidido 2026-07-10: D1 se dispara al completarse la **clase 6** (no cron diario) — mismo patrón reactivo que C1, reutilizando la lógica de `trg_enable_certificate_b` (`AFTER UPDATE OF status ON class_b_sessions WHEN NEW.status='completed'`). Sin pg_cron, sin tabla de control.
- [x] ✅ Verificado contra `indices/DATABASE.md`: `enrollments.payment_mode` ∈ `'total'|'deposit'`, `pending_balance` ya existe (usado en Ola 2). `class_b_sessions.class_number` es confiable como secuencial 1-12 — ya lo usa `trg_enable_certificate_b` (`WHEN NEW.class_number = 12`) para el certificado.
- [x] ✅ Resuelto: "antes de la 7ª clase" = al completarse la clase 6 (AC5), no ambiguo.

---

## Changelog

- 2026-07-10 — draft inicial por Akxlarre, basado en `indices/NOTIFICATIONS-MAP.md` (priorización Ola 3). Decisión técnica (trigger SQL) confirmada por el owner.
- 2026-07-10 — approved. D1 simplificado a trigger reactivo (clase 6 completada) en vez de cron, tras descubrir el patrón existente `trg_enable_certificate_b`. Columnas de `enrollments`/`class_b_sessions` verificadas contra `indices/DATABASE.md`.
