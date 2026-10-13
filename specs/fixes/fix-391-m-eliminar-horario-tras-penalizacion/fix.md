# Fix: "Eliminar" y "Borrar horarios" vuelven a cancelar las clases de un alumno ya penalizado
> id: fix-391-m-eliminar-horario-tras-penalizacion
> refs: fix-366-m-testing-asistencia-clase-b (H07, H09, J07) · ASG-i-027 · fix-384-m
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Un alumno falta a dos clases seguidas y pierde su agenda (por la regla automática o porque la
secretaria apretó "Eliminar"). Después se le reagendan las clases desde la ficha. Como las dos
faltas siguen ahí, la alerta de Asistencia sigue en rojo y, al volver a tener horario, ofrece
"Eliminar" otra vez; "Borrar horarios" del Dashboard también lo incluye. Un clic cancela lo recién
reagendado, por las mismas faltas que ya se penalizaron.

## Root Cause

Decisión J07 (`fix-384-m`): un par de faltas que ya causó una penalización no vuelve a contar. La
BD lo cumple con `enrollments.absence_penalty_applied_at`, pero las dos pantallas deciden solas con
"hay faltas en clases seguidas" y no miran esa fecha. Además la cancelación manual ("Eliminar",
"Borrar horarios") no la registra: solo lo hace `apply_class_b_absence_penalty()`.

## Decisión (Matías, 2026-10-12 — H07 / H09)

"Eliminar" y "Reactivar" se mantienen: con la regla automática apagada en la sede son la forma
manual de aplicar y deshacer la penalización. "Eliminar" no se ofrece cuando ese par ya fue
penalizado.

## Fix

- `class-b-session.utils.ts`: `enrollmentsWithUnpenalizedPair()` — la misma regla de la BD: un par
  cuenta solo si sus dos faltas se registraron después de la última penalización de la matrícula.
- `asistencia-clase-b.facade.ts`: la alerta lleva `parPenalizado`; "Eliminar" registra la
  penalización en la matrícula después de cancelar.
- Rail de alertas: con `parPenalizado` y horario activo no hay botón; la alerta sigue en rojo, con
  el texto "Ya penalizado". "Reactivar" no cambia.
- `dashboard-alerts.facade.ts`: la alerta sigue contando a todos los alumnos con faltas seguidas,
  pero "Borrar horarios" solo actúa sobre los pares sin penalizar (y no se ofrece si no queda
  ninguno); al cancelar registra la penalización.

Sin migración: usa la columna de `fix-384-m`.

## Acceptance Criteria

- [x] AC1 — Par penalizado y clases reagendadas: la alerta sigue roja, sin "Eliminar".
- [x] AC2 — Par sin penalizar: "Eliminar" sigue disponible y, al usarlo, la matrícula queda con la
  penalización registrada.
- [x] AC3 — "Reactivar" sigue disponible cuando el horario está eliminado.
- [x] AC4 — "Borrar horarios" del Dashboard no incluye a los alumnos cuyo par ya fue penalizado, y
  registra la penalización de los que sí cancela.
- [x] AC5 — Una falta nueva seguida de otra, ambas posteriores a la penalización, vuelve a ofrecer
  "Eliminar".

## Regression Test

`class-b-session.utils.spec.ts`, `asistencia-clase-b.facade.spec.ts`,
`dashboard-alerts.facade.spec.ts`, el spec del componente y verificación en navegador con
`E2E-AsisB4Dos1` (faltas 1 y 2, clase 3 a futuro).

## Verificación (2026-10-12)

- `class-b-session.utils.spec.ts` 22/22, `asistencia-clase-b.facade.spec.ts` 77/77,
  `dashboard-alerts.facade.spec.ts` 52/52, componente 27/27 y `unchecked-writes.guard.spec.ts`.
- Navegador (secretaria, `E2E-AsisB4Dos1`: faltas 1 y 2, clase 3 a futuro):
  - La alerta ofrece "Eliminar" → "Horario eliminado": la clase 3 queda cancelada y la matrícula
    con `absence_penalty_applied_at`. La alerta pasa a "Reactivar".
  - "Reactivar" devuelve la clase 3. Tras recargar, la alerta sigue en rojo con "Ya penalizado",
    sin "Eliminar" ni "Reactivar", y el tooltip dice que esas faltas no vuelven a contar.
  - Dashboard: la alerta sigue contando 64 alumnos, pero "Borrar horarios" ya no incluye a este
    alumno ("No hay clases futuras que cancelar"; antes del fix pedía confirmar la cancelación de
    su clase 3). La clase 3 sigue agendada.
- AC5 por test unitario (`enrollmentsWithUnpenalizedPair`).
