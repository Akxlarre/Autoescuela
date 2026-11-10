# Acceptance 0058-b — "Reactivar horario" deshace solo el último "Eliminar horario"

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-11-09
> **Verifier:** Claude (agente) · validado por Akxlarre

---

## Resumen

- AC totales: 14 (AC1–AC9, AC-E1–AC-E5)
- AC cumplidos: 14
- AC fallidos: 0
- AC con evidencia: 14

**Veredicto final:** ✅ PASA

Migración `20261109180000_spec0058b_reactivar_deshace_eliminar.sql` aplicada en producción el
2026-11-09 con OK del owner. El test SQL corrió contra la base real después de aplicarla:
`RESULTADO spec-0058-b: TODO OK` (termina en `RAISE EXCEPTION`, no dejó datos; verificado por SQL).
Aún sin commit: la evidencia apunta a archivos del árbol de trabajo de la rama
`feat/0058-b-reactivar-deshace-eliminar`.

Abreviaturas de evidencia:
- **SQL** = `supabase/tests/asistencia/spec0058b-reactivar-deshace-eliminar.sql` (contra producción).
- **Asis** = `src/app/core/facades/asistencia-clase-b.facade.spec.ts`.
- **Dash** = `src/app/core/facades/dashboard-alerts.facade.spec.ts`.
- **e2e-H05** = `e2e/asistencia-clase-b.spec.ts` › "H05 · H06 · H08 · N02 (spec 0058-b)" (✅, 35.6 s).
- **e2e-H06** = `e2e/acciones-masivas-clases.spec.ts` › "H06/H09" (✅, 29.2 s).
- **e2e-N03** = `e2e/agenda-5.spec.ts` › "N03" (✅, 26.7 s).

---

## Verificación por AC

### AC1 — Eliminar = cancelar + registrar + ligar + sellar, en una transacción

- **Estado:** ✅ cumplido
- **Evidencia:**
  - RPC `remove_class_b_schedule` (migración §3), una sola función plpgsql.
  - SQL: `AC1=2`. Registro con `removed_by` y sello anterior; 2 clases ligadas; la cancelada ajena sin
    vínculo; sello puesto.
  - Asis:987 "removeSchedule llama a la RPC…". Dash "0058-b AC1: al confirmar llama a la RPC solo con las
    clases que vio el usuario".
  - e2e-H05: el sello queda puesto tras eliminar.

### AC2 — Reactivar revive solo lo ligado y futuro de la última eliminación

- **Estado:** ✅ cumplido
- **Evidencia:** SQL `AC2=1` (la pasada y la cancelada ajena no vuelven). Asis:833, Asis:867.
  e2e-H05: la futura vuelve a `scheduled`. e2e-H06: vuelven las clases 3 y 4, la 5 (pasada) no.

### AC3 — El sello vuelve a su valor anterior; la eliminación queda marcada como reactivada

- **Estado:** ✅ cumplido
- **Evidencia:** SQL (sello a null, `reactivated_by` = secretaria). AC-E1 del SQL prueba un sello anterior
  no nulo. Asis:867 y Asis:887. e2e-H05: `absence_penalty_applied_at` vuelve a null en la BD real.

### AC4 — Sin eliminación ligada no revive nada y orienta a "Reagendar Clases"

- **Estado:** ✅ cumplido
- **Evidencia:** SQL `AC4=Estas clases no se cancelaron con "Eliminar horario"…`. Asis:805.
  `SIN_ELIMINACION_MSG` en `schedule-removal.utils.ts`, con el mismo texto que la RPC. e2e-H05: una futura
  cancelada sin vínculo sigue `cancelled`.

### AC5 — Aviso al alumno y a los instructores al reactivar

- **Estado:** ✅ cumplido
- **Evidencia:** Asis:899. `schedule-removal.utils.spec.ts` (textos, día de Chile). e2e-H05: el alumno tiene
  la notificación "Horario reactivado".

### AC6 — Choques de fix-245-b sin regresión

- **Estado:** ✅ cumplido
- **Evidencia:** Asis, tests de fix-245-b conservados (96/96). e2e-N03: el aviso nombra "Clase 3" y su
  hora, y ninguna clase vuelve.

### AC7 — La alerta vuelve a su estado de antes de eliminar

- **Estado:** ✅ cumplido
- **Evidencia:** Asis:867 (`horarioActivo` true, `parPenalizado` = sello anterior). e2e-H05: tras recargar,
  "Eliminar" está disponible otra vez y no aparece "Ya penalizado".
- **Notas:** este AC cambia a propósito lo que fijó fix-391-m ("ya penalizado, no se vuelve a ofrecer").
  El e2e se actualizó al comportamiento nuevo.

### AC8 — Admin y secretaria (esta última, solo en su sede); instructor y alumno no

- **Estado:** ✅ cumplido
- **Evidencia:** SQL `AC8-instr=42501` (eliminar) y `AC8-react=42501` (reactivar). La secretaria de la
  sede 2 no cancela nada en la sede 1. Ambas RPC son `SECURITY INVOKER` con `GRANT` solo a
  `authenticated` y chequeo de rol.

### AC9 — Aviso al eliminar (Asistencia y dashboard)

- **Estado:** ✅ cumplido
- **Evidencia:** Asis:1004. Dash "0058-b AC9: avisa a cada alumno y a sus instructores". e2e-H05: el alumno
  tiene la notificación "Horario eliminado".

### AC-E1 — Eliminar → reagendar → eliminar: solo vuelve la segunda

- **Estado:** ✅ cumplido
- **Evidencia:** SQL (B canceló 2 y se reactivaron 2; el sello vuelve al de A; un segundo Reactivar se
  rechaza). Asis:821.

### AC-E2 — Las clases ligadas ya pasadas quedan canceladas

- **Estado:** ✅ cumplido
- **Evidencia:** SQL (s2 movida al pasado sigue `cancelled`). e2e-H06 (la clase 5 no revive).

### AC-E3 — Una clase reciclada con "Reagendar Clases" no se toca

- **Estado:** ✅ cumplido
- **Evidencia:** SQL ("reagendar soltó el vínculo" vía `reschedule_class_b_sessions`).
  `admin-alumno-detalle.facade.spec.ts:383` (`reciclarSesion` pone `schedule_removal_id: null`).

### AC-E4 — Dos reactivaciones simultáneas: una gana, la otra "ya estaba reactivado", sin avisos dobles

- **Estado:** ✅ cumplido
- **Evidencia:** la RPC toma la eliminación con `FOR UPDATE`, así que la segunda espera y luego ve
  `reactivated_at`. SQL `AC-E4=El horario ya estaba reactivado.`. Asis:922 (muestra el error y no avisa).
- **Notas:** probado en secuencia; la exclusión real entre sesiones la da el lock de fila, no se ejercitó
  con dos conexiones en paralelo.

### AC-E5 — Cancelaciones previas a la spec se tratan como AC4

- **Estado:** ✅ cumplido
- **Evidencia:** 0 clases futuras canceladas en producción antes de aplicar (consulta del 2026-11-09).
  La columna nace en null, así que aplica el camino de AC4 (probado arriba).

---

## Out-of-scope respetado

- ❌ Encender la penalización automática o cambiar su regla — confirmado: `apply_class_b_absence_penalty`
  no se tocó.
- ❌ Botón de cancelar para el instructor — confirmado: `InstructorClasesFacade` no se tocó.
- ❌ Deshacer "Reagendar Clases" / "Reprogramar" — confirmado: solo se agregó `schedule_removal_id = NULL`.
- ❌ I17 (avisos a portales bloqueados) — confirmado: se usa `NotificationsFacade.notifyUsers` sin cambios.

---

## Deuda técnica detectada

- `DashboardAlertsFacade` mantiene su advertencia de `lint:arch` por 6 `inject()`. Ya estaba antes; la
  spec sumó `NotificationsFacade`, pero el total del lint quedó igual que en main (188).
- 5 notificaciones viejas con "E2E-" en el mensaje (octubre de 2026, de otros tests) siguen en la BD.
  No son de esta spec.

---

## Cambios en índices

- `indices/DATABASE.md` — tabla `class_b_schedule_removals`, columna `class_b_sessions.schedule_removal_id`,
  RPC `remove_class_b_schedule` y `reactivate_class_b_schedule`.
- `indices/FACADES.md` — fila 0058-b (Asistencia y dashboard por RPC + avisos).
- `indices/MODELS.md` — `class-b-schedule-removal.model.ts`.
- `indices/UTILS.md` — `schedule-removal.utils.ts`.
- `indices/DOMAIN-GOTCHAS.md` — DG-122 (solo la RPC escribe `schedule_removal_id`; cualquier otro cambio de
  estado o fecha lo deja en NULL).
- `indices/COMPONENTS.md` / `SERVICES.md` — sin cambios (no hay componentes ni servicios nuevos).

---

## Post-mortem

- Qué salió mejor de lo esperado: el ensayo de migración y test en una sola llamada que termina en
  `RAISE EXCEPTION` permitió probar contra la BD de producción sin dejar nada.
- Qué fricciones encontramos: los avisos a instructores (usuarios no sembrados) obligaron a ampliar la
  limpieza e2e: ahora se borran por matrícula (`reference_type = 'enrollment'`).
- Qué cambiaríamos: detectar antes qué e2e fijan comportamiento que la spec cambia (aquí fix-391-m).

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando (`npm run test:ci`: 4772 ✅; e2e de Eliminar/Reactivar: 3 ✅)
- [x] `lint:arch` limpio (0 errores, 188 advertencias = main)
- [x] Sin deuda crítica abierta

**Cerrado por:** Akxlarre
**Fecha:** 2026-11-09
