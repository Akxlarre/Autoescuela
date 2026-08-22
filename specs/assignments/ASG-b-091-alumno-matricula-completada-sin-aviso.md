# Asignación ASG-b-091 — Alumno con matrícula solo `completed` ve horario histórico sin aviso

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-09
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-10
> **resulting_track:** fix-128-b-alumno-matricula-completada-sin-aviso

---

## Contexto / Objetivo

Encontrado durante fix-127-b (app-like `/alumno/horario`), fuera de su scope (es un gap de
lógica de negocio/estado, no de layout).

`StudentEnrollmentContextFacade.initialize()` trae matrículas con
`status in ('active', 'completed')` (`student-enrollment-context.facade.ts:26-31`), ordenadas
por `created_at` desc, y activa por defecto la más reciente (`tabs[0].id`) sin distinguir si esa
matrícula está realmente `active` o ya `completed`.

El estado "Sin matrícula activa" en `AlumnoHorarioComponent` (y el mismo patrón heredado en
`AlumnoPagosComponent`, ver `indices/APP-LIKE-ROLLOUT.md` línea de `/alumno/pagos`) está
gateado por `facade.licenseGroup() === null` — ese signal **solo** queda `null` cuando el
alumno tiene CERO matrículas en la BD (ni activa ni completada). Si el alumno tiene
ÚNICAMENTE matrículas `completed` (terminó Clase B hace meses, todavía no toma nada nuevo),
`licenseGroup()` se setea igual con el `license_group` de esa matrícula completada — el
horario histórico se renderiza como si fuera normal, **sin ningún aviso de que es un curso ya
cerrado**.

El check de "vacío" responde "¿tiene alguna matrícula en la BD alguna vez?" en vez de "¿tiene
una matrícula con `status='active'` ahora mismo?" — son preguntas distintas y el código solo
resuelve la primera.

## Alcance sugerido

- `StudentHorarioFacade`/`StudentEnrollmentContextFacade`: exponer si la matrícula
  seleccionada actualmente tiene `status = 'completed'` (no solo el `license_group`).
- `AlumnoHorarioComponent`: cuando la matrícula activa es `completed`, mostrar un banner
  informativo distinto ("Tu matrícula de [curso] finalizó. Consulta a la secretaría para una
  nueva.") en vez de mostrar el horario histórico sin contexto.
- Revisar si `AlumnoPagosComponent` tiene el mismo patrón (`licenseGroup() === null` como único
  gate de "sin matrícula") — mencionado como sospechoso en `APP-LIKE-ROLLOUT.md` pero no
  confirmado.
- Bonus menor (no bloqueante): las tabs de selector de matrícula (`enrollmentTabs()`) no
  distinguen visualmente cuál está `active` vs `completed` — un alumno con 2 matrículas del
  mismo `license_group` (ej. repitió Clase B) no puede diferenciarlas por el label solo.

## Referencias

- `src/app/core/facades/student-enrollment-context.facade.ts`
- `src/app/core/facades/student-horario.facade.ts`
- `src/app/features/alumno/horario/alumno-horario.component.ts`

## Archivos involucrados

- `src/app/core/facades/student-enrollment-context.facade.ts`
- `src/app/core/facades/student-horario.facade.ts`
- `src/app/features/alumno/horario/alumno-horario.component.ts`
