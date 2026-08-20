# Fix: Al finalizar una promoción profesional, marcar sus matrículas como ex-alumno
> id: fix-196-m-promocion-finalizada-marca-ex-alumnos
> refs: fix-012-i-marcar-ex-alumno-manual
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Root Cause
`fix-012-i` agregó `marcarComoExAlumno()` (`admin-alumno-detalle.facade.ts`) como acción
**manual** exclusiva de Clase B (gateada por `certificateEmailSent`, que solo se calcula para
`license_group='class_b'`). Clase Profesional nunca tuvo un mecanismo — ni manual ni
automático — para transicionar `enrollments.status` a `'completed'`.

El cron `auto_transition_promotion_status()` (`20260330100000`, pg_cron diario 06:00 UTC) sí
transiciona `professional_promotions.status` a `'finished'` cuando `end_date < CURRENT_DATE`,
y el trigger `trg_cascade_promotion_status` (`20260415000002`) ya propaga ese cambio a
`promotion_courses`. Pero ninguno de los dos toca `enrollments` — las matrículas de los
alumnos de esa promoción (unidas vía `enrollments.promotion_course_id → promotion_courses.id`)
se quedan indefinidamente en `status='active'`, así que nunca aparecen en "Ex-Alumnos
Profesional" (`ExAlumnosFacade` filtra por `status='completed'`) aunque la promoción ya
terminó.

## ACs Afectados
Ninguno — fix autónomo (gap de negocio detectado en conversación con el dueño, no una
regresión de spec existente).

- AC-1: Al ejecutarse `auto_transition_promotion_status()` y una promoción pasar de
  `in_progress` a `finished`, todas las `enrollments` con `status='active'` cuyo
  `promotion_course_id` pertenece a esa promoción pasan a `status='completed'`.
- AC-2: Enrollments en otros estados (`draft`, `pending_payment`, `cancelled`, ya
  `completed`) de esa misma promoción **no** se tocan.
- AC-3: El mismo alumno aparece después en "Ex-Alumnos Profesional"
  (`ExAlumnosFacade.egresadosProfesionalList`) sin acción manual de secretaría/admin.
- AC-4: La transición manual `in_progress`/`planned → finished` hecha desde la UI (no solo
  el cron) dispara el mismo efecto, porque ambos caminos pasan por el mismo trigger.

## Cambio
- **Archivo:** `supabase/migrations/<timestamp>_fix196_promotion_finished_completes_enrollments.sql`
- **Qué cambia:** extiende `cascade_promotion_status_to_courses()` (trigger ya disparado tras
  `UPDATE OF status` en `professional_promotions`, cubre tanto el cron como la UI manual) para
  que, cuando `NEW.status = 'finished'`, además actualice
  `enrollments.status = 'completed'` para las filas con `status = 'active'` cuyo
  `promotion_course_id` pertenece a `promotion_courses` de esa promoción.
- **Archivo:** `indices/DATABASE.md` — actualizar la descripción de
  `cascade_promotion_status_to_courses()` para documentar el nuevo efecto secundario.

## Test de Regresión
- Test manual SQL ejecutado contra `npx supabase db reset` (todas las migraciones aplicadas,
  incluida esta) en una transacción con `ROLLBACK` final: se creó una `professional_promotion`
  con un `promotion_course`, una `enrollment` en `status='active'` y otra en `status='cancelled'`
  colgando de ese curso, se forzó `UPDATE professional_promotions SET status='finished'` y se
  verificó el resultado. ✓
  - `enrollment` `active` → `completed` ✓
  - `enrollment` `cancelled` → sin cambios (sigue `cancelled`) ✓
  - `promotion_course` asociado → `finished` (cascada preexistente, sin regresión) ✓
