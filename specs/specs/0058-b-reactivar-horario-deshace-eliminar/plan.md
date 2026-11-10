# Plan 0058-b — "Reactivar horario" deshace solo el último "Eliminar horario"

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (owner, 2026-11-09)
> **Created:** 2026-11-09
> **Talla:** L (confirmada por el owner). ⚠️ **Revisar el plan antes de implementar — tamaño alto.**

---

## 1. Resumen ejecutivo

Las dos formas de "Eliminar horario" (Asistencia y "Borrar horarios" del dashboard) pasan a una sola
RPC transaccional. Esa RPC cancela las clases, registra la eliminación en una tabla nueva y liga cada
clase cancelada a ese registro. "Reactivar horario" pasa a otra RPC que revive **solo** las clases
ligadas a la última eliminación sin reactivar y devuelve el sello de penalización a su valor anterior.
Ambas acciones avisan al alumno y a los instructores. Orden: migración y tests SQL → facades con TDD →
avisos → e2e → índices.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|---|---|---|
| `supabase/migrations/2026111xxxxxxx_spec0058b_reactivar_deshace_eliminar.sql` | Migration | Tabla `class_b_schedule_removals`, columna `class_b_sessions.schedule_removal_id`, RPCs `remove_class_b_schedule` y `reactivate_class_b_schedule`, ajuste a `reschedule_class_b_sessions` |
| `supabase/tests/asistencia/spec0058b-reactivar-deshace-eliminar.sql` | Test SQL | AC1–AC4, AC8, AC-E1–AC-E4 a nivel BD (transacción con `ROLLBACK`, como `fix-383-m-reagendar-todo-o-nada.sql`) |
| `src/app/core/models/dto/class-b-schedule-removal.model.ts` | DTO | Fila de la tabla nueva y tipo de retorno de las dos RPCs |
| `src/app/core/utils/schedule-removal.utils.ts` (+ `.spec.ts`) | Util pura | Arma el texto de los avisos (cantidad + primera fecha con `formatChileDate`) y el mensaje del modal ("se eliminaron el {fecha} por {nombre}") |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|---|---|---|
| `src/app/core/facades/asistencia-clase-b.facade.ts` | `removeSchedule()` → RPC `remove_class_b_schedule` + avisos. `reactivateSchedule()` → lee la última eliminación, conserva el chequeo de choques (fix-245-b) limitado a sus clases, llama a la RPC `reactivate_class_b_schedule`, restaura `parPenalizado` y avisa | AC1–AC7, AC9 |
| `src/app/core/facades/asistencia-clase-b.facade.spec.ts` | Tests nuevos y ajuste de los existentes de remove/reactivate | TDD |
| `src/app/core/facades/dashboard-alerts.facade.ts` | `clearSchedules()` → la misma RPC (una eliminación por matrícula, solo los ids que vio el usuario) + avisos | AC1, AC9 |
| `src/app/core/facades/dashboard-alerts.facade.spec.ts` | Ajustar los tests de `clearSchedules` | TDD |
| `src/app/core/facades/admin-alumno-detalle.facade.ts` | `reciclarSesion()` (Reprogramar) pone `schedule_removal_id = null` al reciclar | AC-E3 |
| `src/app/core/facades/admin-alumno-detalle.facade.spec.ts` | Afirmar que el UPDATE lleva `schedule_removal_id: null` | TDD |
| `src/app/core/models/dto/class-b-session.model.ts` (o el DTO vigente de la tabla) | `schedule_removal_id: number \| null` | models.md |
| `e2e/agenda-5.spec.ts` (o `asistencia-clase-b.spec.ts`, donde viva N02/N03) | Caso N02: eliminar → reactivar devuelve las clases y el sello; clases sin eliminación ligada no reviven | Golden path real |
| `indices/DATABASE.md`, `indices/FACADES.md`, `indices/MODELS.md`, `indices/UTILS.md` | Tabla, columna, RPCs, cambios de facades | Sync |
| `indices/DOMAIN-GOTCHAS.md` | "Reactivar ≠ perdón": solo deshace lo que liga `schedule_removal_id`; toda cancelación nueva que no sea "Eliminar" debe dejarlo en null | Evitar regresión |
| `specs/testing-piloto/026-agenda-triple-match.md` | Fila N02 → ✅ al cerrar | Trazabilidad |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Facades/Services existentes que reutilizamos
- `NotificationsFacade.notifyUsers(recipientIds, payload)`: el mismo camino que usan
  `notifyClaseReprogramada()` y `notifyClasesReagendadas()` en `AdminAlumnoDetalleFacade`.
- `findReactivationConflicts()` / `reactivationConflictMessage()` (`core/utils/reactivation-conflicts.utils.ts`, fix-245-b): se mantiene el
  chequeo previo. El trigger de doble agendamiento sigue siendo la red de seguridad dentro de la RPC.
- `assertWriteOk`, `toFriendlyDbMessage`, `ErrorSanitizer`: manejo de errores de RPC ya estándar.
- `ConfirmModalService` y `ToastService`: sin cambios de patrón.
- `public.auth_user_role()`: el mismo guard de rol que `reschedule_class_b_sessions` (admin / secretary).
- `formatChileDate` / `formatChileTime`: la fecha de los avisos.

### Lo que NO existe y se crea
- **Tabla `class_b_schedule_removals`.** No hay dónde guardar el origen de una cancelación ni el sello
  anterior. `notes` en la sesión es texto libre y no permite deshacer de forma confiable.
- **Dos RPCs.** Hoy "Eliminar" son 2 UPDATE separados desde el cliente (clases + sello). Si el segundo
  falla, la clase queda cancelada sin sello (por eso existe el toast de "sin registrar la
  penalización"). AC1 y AC3 piden transacción.
- **Util de mensajes.** Las tres llamadas (eliminar, borrar masivo, reactivar) arman el mismo tipo de
  aviso: se centraliza y se testea como función pura.

---

## 4. Modelo de datos

### Migración

```sql
-- 1. Registro de cada eliminación
CREATE TABLE IF NOT EXISTS public.class_b_schedule_removals (
  id                          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enrollment_id               INT NOT NULL REFERENCES public.enrollments(id),
  removed_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_by                  INT REFERENCES public.users(id),
  previous_penalty_applied_at TIMESTAMPTZ,          -- sello antes de eliminar (null = no había)
  reactivated_at              TIMESTAMPTZ,
  reactivated_by              INT REFERENCES public.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ... ON class_b_schedule_removals (enrollment_id) WHERE reactivated_at IS NULL;

-- 2. Vínculo clase → eliminación (solo lo escribe remove_class_b_schedule)
ALTER TABLE public.class_b_sessions
  ADD COLUMN IF NOT EXISTS schedule_removal_id INT REFERENCES public.class_b_schedule_removals(id);

-- 3. remove_class_b_schedule(p_enrollment_ids INT[], p_session_ids INT[] DEFAULT NULL)
--    SECURITY INVOKER, search_path = ''. Guard auth_user_role() ∈ {admin, secretary}.
--    Por cada matrícula: SELECT ... FOR UPDATE de sus clases scheduled y futuras (∩ p_session_ids si viene),
--    si hay alguna: INSERT removal (previous_penalty_applied_at = enrollments.absence_penalty_applied_at),
--    UPDATE clases → cancelled, cancelled_at = now(), schedule_removal_id = removal.id,
--    UPDATE enrollments.absence_penalty_applied_at = now().
--    RETURNS TABLE(enrollment_id, removal_id, cancelled_count, first_scheduled_at,
--                  student_user_id, instructor_user_ids INT[]).

-- 4. reactivate_class_b_schedule(p_enrollment_id INT)
--    Mismo guard. SELECT la última removal con reactivated_at IS NULL ... FOR UPDATE
--    (si no hay → RAISE P0001 'El horario ya estaba reactivado' / 'no se canceló con Eliminar horario').
--    UPDATE class_b_sessions SET status='scheduled', cancelled_at=null, schedule_removal_id=null
--      WHERE schedule_removal_id = removal.id AND status='cancelled' AND scheduled_at > now();
--    (los triggers de doble agendamiento validan aquí; un choque aborta todo)
--    UPDATE enrollments SET absence_penalty_applied_at = removal.previous_penalty_applied_at;
--    UPDATE removal SET reactivated_at = now(), reactivated_by = <users.id del caller>.
--    RETURNS TABLE(reactivated_count, first_scheduled_at, student_user_id, instructor_user_ids INT[],
--                  previous_penalty_applied_at).

-- 5. reschedule_class_b_sessions: el UPDATE que recicla la fila suma schedule_removal_id = NULL (AC-E3).

-- 6. Lectura previa para el modal: SELECT de la última removal sin reactivar + nombre de removed_by
--    (por RLS, desde el facade). Sin RPC extra.
```

Notas:
- Las clases de la eliminación que ya pasaron siguen `cancelled` y conservan el vínculo. Un segundo
  "Reactivar" no las ve porque la removal ya quedó marcada (AC-E1, AC-E2).
- `apply_class_b_absence_penalty`, el cierre de feriados y `cancelClass()` **no se tocan**: al no
  escribir la columna, quedan en null y no se reviven (AC4).
- Datos existentes: 0 clases futuras canceladas en producción (consulta del 2026-11-09). No hace falta
  backfill (AC-E5).
- Si `fix413` audita tablas por trigger, sumar la tabla nueva a la auditoría (verificar al escribir
  la migración).

### RLS

| Tabla | Rol | Operación | Política |
|---|---|---|---|
| `class_b_schedule_removals` | admin | SELECT / INSERT / UPDATE | todas |
| `class_b_schedule_removals` | secretary | SELECT / INSERT / UPDATE | solo si `enrollments.branch_id` = su sede (mismo criterio que la RLS de `enrollments`) |
| `class_b_schedule_removals` | instructor, student | — | sin acceso |
| `class_b_schedule_removals` | todos | DELETE | nadie |

Las RPCs son `SECURITY INVOKER`: la secretaria de otra sede no ve la matrícula ni sus clases y la RPC no
encuentra filas (AC8). Además, el guard de rol rechaza a instructor y alumno con `42501`.

### Modelos

- `core/models/dto/class-b-schedule-removal.model.ts`: `ClassBScheduleRemoval`,
  `RemoveScheduleResultRow` y `ReactivateScheduleResultRow`.
- DTO de `class_b_sessions`: `+ schedule_removal_id`.
- UI: sin modelo nuevo. Las alertas (`horarioActivo`, `parPenalizado`) ya existen.

---

## 5. Arquitectura del feature

```
Asistencia (alerta) ── Eliminar ──▶ AsistenciaClaseBFacade.removeSchedule()
Dashboard (alertas) ── Borrar ────▶ DashboardAlertsFacade.clearSchedules()
                                         │ confirm modal (igual que hoy)
                                         ▼
                              rpc remove_class_b_schedule ──▶ removals + sessions + enrollments (1 tx)
                                         │ filas devueltas
                                         ▼
                              NotificationsFacade.notifyUsers(alumno, instructores)   [AC9]

Asistencia (alerta) ── Reactivar ─▶ AsistenciaClaseBFacade.reactivateSchedule()
                                         │ SELECT última removal + sus clases futuras
                                         │ sin removal → toast AC4 ("usa Reagendar Clases")
                                         │ findReactivationConflicts (fix-245-b) → toast y salir
                                         │ confirm modal ("eliminadas el {fecha} por {nombre}")
                                         ▼
                              rpc reactivate_class_b_schedule ──▶ sessions + enrollments + removal (1 tx)
                                         ▼
                              _alertas: horarioActivo=true, parPenalizado = previous != null   [AC7]
                              NotificationsFacade.notifyUsers(alumno, instructores)            [AC5]
```

### Capas tocadas
- **Facades:** `AsistenciaClaseBFacade`, `DashboardAlertsFacade`, `AdminAlumnoDetalleFacade`.
- **Utils:** `schedule-removal.utils.ts` (nuevo).
- **Smart/Dumb:** sin cambios de template. Los botones ya existen y llevan `data-llm-action`
  (verificarlo y agregarlo si falta).
- **Migration:** una sola, idempotente.

---

## 6. Restricciones aplicables

- [x] `architecture.md`: lógica de mensajes en `core/utils/` (núcleo funcional), facades delgadas
- [x] `facades.md`: errores capturados en el facade, sin `effect()` nuevo
- [x] `models.md`: DTO de la tabla nueva en `dto/`
- [ ] `visual-system.md`: sin UI nueva
- [ ] `swr-pattern.md`: después de mutar se sigue usando `refreshSilently()` donde ya existe
- [x] `notifications.md`: avisos vía `NotificationsFacade`, toasts vía `ToastService`
- [x] `testing-tdd.md`: specs de los 3 facades y del util antes del código
- [x] `ai-readability.md`: confirmar `data-llm-action` en Eliminar, Borrar horarios y Reactivar
- [x] `dates.md`: `now()` en SQL para instantes y `formatChileDate` para mostrar; nada de `CURRENT_DATE`
- [x] `database.md`: migración idempotente, RLS activada, `DATABASE.md` actualizado

---

## 7. Plan de testing

- **SQL** (`supabase/tests/asistencia/spec0058b-*.sql`, en transacción con `ROLLBACK` contra
  producción, como el test de fix-383):
  - Eliminar → removal creado con el sello previo y clases ligadas.
  - Reactivar → solo esas vuelven y el sello se restaura.
  - Una clase cancelada sin removal no revive.
  - Doble eliminación: solo la última (AC-E1).
  - Clase pasada queda cancelada (AC-E2).
  - Clase reciclada por reschedule no se toca (AC-E3).
  - Segundo reactivar → P0001 (AC-E4).
  - Rol instructor → 42501 (AC8).
- **Unit (Vitest):**
  - `schedule-removal.utils.spec.ts`: textos, singular/plural, fecha en hora Chile y vectores en 3
    zonas con `node scripts/test-tz.mjs`.
  - `asistencia-clase-b.facade.spec.ts`: llama a la RPC; sin removal → toast AC4 sin RPC; choque →
    sin RPC; éxito → alertas y `notifyUsers` con alumno + instructores; error de RPC → toast saneado.
  - `dashboard-alerts.facade.spec.ts`: `clearSchedules` usa la RPC con los ids vistos y avisa por
    matrícula.
  - `admin-alumno-detalle.facade.spec.ts`: el reciclaje limpia `schedule_removal_id`.
- **e2e** (seed `E2E-` + limpieza, verificar por SQL que no queden restos): eliminar → reactivar →
  agenda y ficha muestran las clases de vuelta; aviso visible en el portal del alumno.
- **QA visual:** `/verify` de la alerta de Asistencia (modal con el texto nuevo).
- `npm run test:ci`, `npm run lint:arch` (0 errores y sin subir los warnings de 187).

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|---|---|---|
| La migración corre en **producción** (no hay BD de dev) | Alta | Pedir el OK del owner antes de `apply_migration`; probar antes el SQL en transacción con `ROLLBACK`; DDL idempotente y aditivo (columna nullable, tabla nueva) |
| Una cancelación futura nueva escribe `schedule_removal_id` y Reactivar la reviviría | Baja | Solo las dos RPCs la escriben; regla en DOMAIN-GOTCHAS |
| Dos sesiones reactivan a la vez y duplican avisos | Media | `FOR UPDATE` sobre la removal; la segunda recibe P0001 y no notifica (AC-E4) |
| "Borrar horarios" masivo con una matrícula que falla deja las demás a medias | Media | Una sola RPC con arreglo: todo o nada, como fix-383 |
| `SECURITY INVOKER` + RLS: la secretaria no puede hacer UPDATE de `enrollments.absence_penalty_applied_at` | Media | Hoy ya lo hace desde el cliente (fix-391-m), así que la RLS lo permite; el test SQL lo cubre con rol secretary |
| Avisos a portales bloqueados (I17 sin decidir) | Baja | Mismo comportamiento que Reprogramar; se resuelve cuando se decida I17 |
| `reactivateSchedule()` supera 50 líneas (ARCH-10) | Alta | Extraer la lectura de la removal y el armado de avisos a métodos privados y utils |

---

## 9. Orden de implementación

1. Test SQL (rojo) → migración → test SQL (verde). **Pedir OK antes de aplicar en producción.**
2. DTO + `schedule-removal.utils.ts` con su spec (TDD).
3. `AsistenciaClaseBFacade`: specs → remove y reactivate con RPC y avisos.
4. `DashboardAlertsFacade.clearSchedules`: spec → RPC y avisos.
5. `AdminAlumnoDetalleFacade.reciclarSesion`: spec → limpiar el vínculo.
6. e2e N02 + `/verify`.
7. `test:ci`, `lint:arch`, prueba en 3 zonas horarias del util.
8. Índices (DATABASE, FACADES, MODELS, UTILS, DOMAIN-GOTCHAS) + checklist 026 + `acceptance.md`.

---

## 10. Estimación

L: 3–4 días (la migración y su test SQL son ~1 día).

---

## Changelog

- 2026-11-09 — plan inicial
