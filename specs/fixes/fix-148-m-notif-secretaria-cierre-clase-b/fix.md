# Fix: Notificación a secretaría al cerrar clase B — detalle, total dinámico y actor
> id: fix-148-m-notif-secretaria-cierre-clase-b
> refs: fix-091-m-alerta-secretaria-cierre-clase, 0006-m-matricula-refuerzo-clase-b
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Root Cause
`notify_class_b_completed()` (trigger `AFTER UPDATE OF status ON class_b_sessions`,
`20260801100000_notify_secretary_class_b_completed.sql`) construye el mensaje de
notificación sin tres datos que ya existen en el modelo:
1. No identifica la matrícula/alumno — el mensaje es genérico ("Clase N/12 completada").
2. Asume `/12` fijo, ignorando `courses.is_reinforcement` (spec 0006-m), que tiene 6 clases.
3. No distingue quién hizo el `UPDATE` — se dispara igual si cierra secretaría/admin
   (mismo código `AsistenciaClaseBFacade.finalizarClase()` usado por
   `secretaria-asistencia.component.ts` y `admin-asistencia.component.ts`), notificando
   a la propia secretaría de una acción que ella misma hizo, con texto falso
   ("completada por el instructor").

## ACs Afectados
Ninguno — fix autónomo (comportamiento no cubierto por ACs de fix-091-m ni 0006-m).

## Cambio
- **Archivo:** `supabase/migrations/20260810120000_fix148_notify_secretary_detail_and_actor.sql` (nueva migración)
- **Qué cambia:**
  - Resuelve `total_classes` desde `courses.is_reinforcement` (6 si true, 12 si false) para
    el mensaje del alumno y el de secretaría.
  - Agrega número de matrícula (`enrollments.number`) y nombre del alumno
    (primer nombre + apellido paterno) al mensaje de secretaría.
  - Usa `auth_user_role()` para solo notificar a secretaría cuando el actor es
    `'instructor'` — si cierra secretaría o admin, se omite el bloque de notificación
    a secretaría (la notificación al alumno no cambia, es independiente del actor).

## Test de Regresión
No hay test automatizado (trigger SQL, sin arnés de integración contra Postgres en este
repo). Verificación manual: cerrar una clase como instructor en una matrícula estándar y
en una de refuerzo → notificación a secretaría con "N/12" y "N/6" respectivamente, número
de matrícula y nombre del alumno correctos. Cerrar una clase como secretaría/admin →ninguna
notificación a secretaría se genera.
