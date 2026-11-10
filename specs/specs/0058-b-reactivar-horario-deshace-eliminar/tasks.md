# Tasks 0058-b — "Reactivar horario" deshace solo el último "Eliminar horario"

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Created:** 2026-11-09

---

## Fase 1 — Datos y modelo

- [x] **T1.1** — Test SQL en rojo: `supabase/tests/asistencia/spec0058b-reactivar-deshace-eliminar.sql`
  - **AC ref:** AC1, AC2, AC3, AC4, AC8, AC-E1, AC-E2, AC-E3, AC-E4
  - **DoD:**
    - [ ] Corre dentro de `BEGIN … ROLLBACK`, con seed `E2E-` propio (no toca datos reales)
    - [ ] Casos:
      - [ ] eliminar → removal con el sello previo y clases ligadas
      - [ ] reactivar → solo vuelven las ligadas y se restaura el sello
      - [ ] una clase cancelada sin vínculo no revive
      - [ ] doble eliminación → solo la última
      - [ ] una clase pasada queda cancelada
      - [ ] una clase reciclada no se toca
      - [ ] un segundo reactivar → P0001
      - [ ] rol instructor → 42501
    - [ ] Falla antes de la migración (las funciones no existen)

- [x] **T1.2** — Migración `supabase/migrations/20261109180000_spec0058b_reactivar_deshace_eliminar.sql`
  - **AC ref:** AC1, AC2, AC3, AC4, AC8, AC-E1–AC-E4
  - **DoD:**
    - [ ] Crea la tabla `class_b_schedule_removals` con índice parcial por `enrollment_id` sin reactivar
    - [ ] RLS: admin todo; secretary por sede; instructor y student sin acceso; DELETE nadie
    - [ ] `class_b_sessions.schedule_removal_id` es FK nullable
    - [ ] `remove_class_b_schedule(INT[], INT[] DEFAULT NULL)` y `reactivate_class_b_schedule(INT)`: `SECURITY INVOKER`, `search_path = ''`, guard `auth_user_role()`, `FOR UPDATE`
    - [ ] `reschedule_class_b_sessions` limpia `schedule_removal_id` al reciclar
    - [ ] Auditoría (fix413): se suma la tabla nueva si corresponde
    - [ ] Idempotente: se corre 2 veces sin error
    - [ ] Instantes con `now()`, sin `CURRENT_DATE`; `lint:arch` sin ARCH-28
    - [ ] **OK del owner antes de `apply_migration`** (producción)
    - [ ] T1.1 en verde después de aplicarla

- [x] **T1.3** — DTOs
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [ ] `core/models/dto/class-b-schedule-removal.model.ts`: `ClassBScheduleRemoval`, `RemoveScheduleResultRow`, `ReactivateScheduleResultRow`
    - [ ] El DTO de `class_b_sessions` incluye `schedule_removal_id`
    - [ ] `tsc` limpio

- [x] **T1.4** — `core/utils/schedule-removal.utils.ts` + spec (TDD)
  - **AC ref:** AC4, AC5, AC9
  - **DoD:**
    - [ ] Arma los avisos de eliminación y reactivación con cantidad (singular/plural) y primera fecha (`formatChileDate`)
    - [ ] Arma el mensaje del modal ("eliminadas el {fecha} por {nombre}") y el aviso AC4
    - [ ] Spec en verde en las 3 zonas (`node scripts/test-tz.mjs`)

## Fase 2 — Capa Facade

- [x] **T2.1** — `AsistenciaClaseBFacade.removeSchedule()` → RPC + avisos
  - **AC ref:** AC1, AC9
  - **DoD:**
    - [ ] Spec escrito primero:
      - [ ] llama a la RPC con `[enrollmentId]`
      - [ ] sin clases → toast info
      - [ ] éxito → alertas actualizadas y `notifyUsers` al alumno y a los instructores
      - [ ] error → toast saneado
    - [ ] Sin el UPDATE suelto de `enrollments` (lo hace la RPC)
    - [ ] Método ≤ 50 líneas

- [x] **T2.2** — `AsistenciaClaseBFacade.reactivateSchedule()` → última removal + RPC + avisos
  - **AC ref:** AC2, AC3, AC4, AC5, AC6, AC7, AC-E4
  - **DoD:**
    - [ ] Spec escrito primero:
      - [ ] sin removal → toast AC4, sin RPC
      - [ ] choque → toast fix-245-b, sin RPC
      - [ ] modal con fecha y nombre
      - [ ] éxito → `horarioActivo = true`, `parPenalizado = previous != null`, `notifyUsers`
      - [ ] P0001 ("ya estaba reactivado") → toast, sin avisos
    - [ ] El chequeo de choques se limita a las clases de esa removal
    - [ ] Lectura de la removal y armado de avisos en métodos privados (ARCH-10)

- [x] **T2.3** — `DashboardAlertsFacade.clearSchedules()` → RPC + avisos
  - **AC ref:** AC1, AC9
  - **DoD:**
    - [ ] Spec ajustado: RPC con los ids mostrados en el diálogo; un aviso por matrícula; error → toast
    - [ ] Sin el UPDATE suelto de `enrollments` ni el toast "No se registró la penalización" (ya no puede pasar)

- [x] **T2.4** — `AdminAlumnoDetalleFacade.reciclarSesion()` limpia el vínculo
  - **AC ref:** AC-E3
  - **DoD:**
    - [ ] El spec afirma que el UPDATE lleva `schedule_removal_id: null`
    - [ ] Sin subir los warnings de `lint:arch` (187)

## Fase 3 — UI

- [x] **T3.1** — Atributos `data-llm-action` en Eliminar, Borrar horarios y Reactivar
  - **AC ref:** — (ai-readability)
  - **DoD:**
    - [ ] Verificado y agregado donde falte; sin otros cambios de template

## Fase 5 — Validación

- [x] **T5.1** — e2e N02
  - **AC ref:** AC2, AC3, AC4, AC5, AC7
  - **DoD:**
    - [ ] Seed `E2E-`:
      - [ ] eliminar → reactivar → la agenda y la ficha muestran las clases de vuelta y el sello vuelve
      - [ ] el alumno ve el aviso
      - [ ] una clase cancelada sin vínculo no revive
    - [ ] SQL confirma 0 restos `E2E-`

- [x] **T5.2** — Suite completa
  - **DoD:**
    - [ ] `npm run test:ci` en verde
    - [ ] `npm run lint:arch` con 0 errores y ≤ 187 warnings
    - [ ] `/verify` del modal de Reactivar (texto nuevo, consola limpia)

- [x] **T5.3** — `/spec-verify` → `acceptance.md` con evidencia por AC

## Fase 6 — Cierre

- [x] **T6.1** — Índices y trazabilidad
  - **DoD:**
    - [ ] Actualizados:
      - [ ] `indices/DATABASE.md`: tabla, columna y RPCs
      - [ ] `FACADES.md`, `MODELS.md` y `UTILS.md`
      - [ ] `DOMAIN-GOTCHAS.md`: solo "Eliminar" escribe `schedule_removal_id`
    - [ ] Checklist 026: N02 → ✅; fix-186-b actualizado
    - [ ] `spec.md` en `done`, `.active` vacío, `npm run assignments:sync`
