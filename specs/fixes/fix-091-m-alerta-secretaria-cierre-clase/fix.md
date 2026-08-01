# Fix: Alerta a secretaría cuando un instructor cierra una clase
> id: fix-091-m-alerta-secretaria-cierre-clase
> refs: ASG-b-044
> status: done
> closed: 2026-08-01
> created: 2026-08-01

## Root Cause
[Heredado de ASG-b-044, a confirmar]: Anotación de la reunión con el cliente
(2026-07-28): "Alerta para secretaria cuando un instructor cierre una clase."

Ya existe el trigger `notify_class_b_completed()`
(`20260710000000_notify_class_b_session_events.sql`, spec 0026): AFTER UPDATE OF status ON
`class_b_sessions`, dispara cuando pasa a `completed` y notifica **al alumno** ("Clase N/12
completada", `reference_type='class_b'`). Es `SECURITY DEFINER` porque el actor es el
instructor, que no tiene permiso de INSERT en `notifications` vía RLS.

Falta extender ese mismo trigger para que también notifique a la secretaría de la sede —
no hay que diseñar nada nuevo.

## ACs Afectados
Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-b-044-alerta-secretaria-cierre-de-clase.md`.

## Alcance sugerido (de la Asignación)
- Extender `notify_class_b_completed()` para insertar además una notificación dirigida a
  secretaría.
- Resolver **a quién** exactamente: la secretaría de la sede de la matrícula. Si hay varias
  secretarias por sede, definir si se notifica a todas.
- Mantener el `EXCEPTION WHEN OTHERS` que ya tiene, para que un fallo de notificación nunca
  aborte el UPDATE real de la clase.

## Preguntas abiertas (no bloqueante) — RESUELTAS con el owner (2026-08-01)
1. ¿A todas las secretarias de la sede, o solo a una? → **A todas las secretarias de la
   sede de la matrícula.**
2. ¿Cadencia? → **Una notificación por cada clase completada** (mismo patrón que la del
   alumno), sin agregación ni resumen.
3. ¿Tope/filtro de ruido? → **No, por ahora.** Sin datos reales de volumen diario, no se
   inventa un umbral; se revisará si el cliente reporta que es ruidoso.

## Cambio
- **`supabase/migrations/20260801100000_notify_secretary_class_b_completed.sql`**:
  redefine `notify_class_b_completed()` (`CREATE OR REPLACE FUNCTION`, mismo trigger
  `trg_notify_class_b_completed`). Tras notificar al alumno (sin cambios), agrega un
  `FOR ... LOOP` sobre `users u JOIN roles r ON r.id = u.role_id WHERE r.name =
  'secretary' AND u.branch_id = v_branch_id` (branch resuelto desde
  `enrollments.branch_id` de la misma consulta que ya trae al alumno) e inserta una
  notificación por cada secretaria encontrada, `reference_type='class_b'`, subject
  "Clase cerrada por instructor". Mantiene el `EXCEPTION WHEN OTHERS` que envuelve toda
  la función (AC-E2 heredado de spec 0026): un fallo notificando a secretaría tampoco
  aborta el UPDATE real de la clase.
- **`indices/DATABASE.md`**: actualizada la entrada de `notify_class_b_completed()` con
  la extensión.
- **`indices/NOTIFICATIONS-MAP.md`**: actualizada la fila C1 con el nuevo destinatario.

## Verificación
- **Verificado en local (2026-08-01)** tras levantar Docker: `npx supabase start` +
  `npx supabase db reset` aplicó la migración `20260801100000` sin errores sobre la
  función/trigger existente.
- Datos de prueba mínimos vía `docker exec ... psql`, dentro de una transacción con
  `ROLLBACK` final (no deja residuos en la BD): 1 sede (`branch_id=9001`) con 2
  secretarias (`9001`, `9002`), 1 secretaria de **otra** sede (`9003`, control negativo),
  1 alumno con matrícula `active` en esa sede, 1 instructor + vehículo, 1
  `class_b_sessions` en `scheduled`. Se ejecutó
  `UPDATE class_b_sessions SET status='completed' WHERE id=9001` (simula
  `finishClass()` del instructor) y se consultó `notifications` filtrando por
  `reference_type='class_b' AND reference_id=9001`.
- **Resultado — 3 filas, exactamente las esperadas:**
  - `recipient_id=9004` (alumno): "Clase completada" — **sin regresión**, idéntico al
    comportamiento pre-fix.
  - `recipient_id=9001` y `9002` (las 2 secretarias de la sede): "Clase cerrada por
    instructor" — **el fix funciona**.
  - `recipient_id=9003` (secretaria de otra sede): **no aparece** — el filtro
    `u.branch_id = v_branch_id` excluye correctamente sedes ajenas.
- Ruido no relacionado observado en el log (`WARNING: audit_log error: operator does
  not exist: ... ->> unknown`): proviene de triggers de auditoría preexistentes en
  `users`/`students`/`vehicles`/`enrollments`/`class_b_sessions`, no de
  `notify_class_b_completed()`; no abortó ningún INSERT (tienen su propio
  `EXCEPTION WHEN OTHERS`). Fuera de alcance de este fix.

## Test de Regresión
- Script SQL manual (transacción con `ROLLBACK`, ver "Verificación") ejecutado contra
  Supabase local — **verde**: alumno notificado (no regresión) + ambas secretarias de
  la sede notificadas + secretaria de otra sede correctamente excluida.
- No se agregó un `.spec.ts` — es lógica 100% SQL (trigger), sin código TypeScript
  involucrado; el test de regresión vive como procedimiento reproducible documentado
  arriba, mismo criterio ya usado en `fix-060-m`/`fix-061-m` para fixes de triggers/RLS.

## Notas
- ⚠️ **Se solapa con ASG-b-036** (ciclo de vida de la clase, actualmente 🔴 BLOQUEADA). Si
  esa asignación introduce cierre automático de clases olvidadas, hay que decidir si una
  clase cerrada por el sistema también genera esta alerta — probablemente sí, con texto
  distinto.
- ⚠️ Patrón FK ya documentado: `instructors.id` ≠ `users.id` y `students.id` ≠ `users.id`.
  Resolver siempre el `user_id` real antes de insertar en `notifications`.
- Esto es capa 2 (notificación persistente) según `.claude/rules/notifications.md`, no un
  toast.
- Referencias: `indices/DATABASE.md` → `notify_class_b_completed()`,
  `indices/NOTIFICATIONS-MAP.md` — mapa completo de productores (Olas 1-3).
- Archivos involucrados sugeridos: `supabase/migrations/` (migración nueva que redefine la
  función).
