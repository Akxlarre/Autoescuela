# Acceptance — 0008-i — Resetear y repoblar la BD de prueba con datos masivos realistas

> **Verificado:** 2026-09-07
> **Owner:** i
> **Veredicto:** ✅ PASA (1 desviación documentada en AC-E2, no bloqueante)

---

## Resumen ejecutivo

Operación de datos pura (sin cambios de código ni de esquema), ejecutada mediante scripts
SQL entregados en el chat y corridos manualmente por el owner contra Supabase, siempre
primero con `BEGIN`/`ROLLBACK` antes de cualquier `COMMIT` real. 6/6 AC principales
cumplidos, 1/2 edge cases cumplido, 1 con desviación justificada.

## AC1 — Reset preserva solo las cuentas de login

✅ **Cumplido.** Script de RESET con `target_students`/`target_instructors` excluyendo por
`users.email IN (admin@test.com, secretaria@test.com, secretaria2@test.com,
instructor@test.com, alumno@test.com)`. Verificación post-`COMMIT` confirmada por el owner:
`students_restantes = 1`, `instructors_restantes = 1` (exactamente las 2 cuentas protegidas
que tienen fila propia en esas tablas).

## AC2 — Login del equipo sigue funcionando

✅ **Cumplido.** El script nunca ejecuta `DELETE`/`UPDATE` sobre `users` ni sobre Supabase
Auth — confirmado por diseño (revisado explícitamente en el chat) y por la consulta de
verificación post-reset que muestra las 5 filas de `users` intactas
(`admin@test.com` role_id=1, `secretaria@test.com`/`secretaria2@test.com` role_id=2,
`instructor@test.com` role_id=3, `alumno@test.com` role_id=4).

## AC3 — Sin cambios de esquema

✅ **Cumplido.** Todos los cambios fueron `DELETE`/`INSERT`/`UPDATE` de filas. Única
excepción de alcance ampliado durante la ejecución: se crearon 8 filas nuevas en la tabla
`vehicles` (ya existente, sin cambio de esquema) para poder darle un vehículo propio a cada
instructor nuevo — necesario porque `vehicle_assignments` tiene una constraint de un
vehículo activo por vez (`idx_active_vehicle_assignment`), descubierta durante la ejecución.

## AC4 — ~15 instructores, ~150-300 alumnos, mezcla Clase B/Profesional

✅ **Cumplido.** 15 instructores (8 sede 1 "Autoescuela Chillán", 7 sede 2 "Conductores
Chillán", todos Clase B — se descartó la idea inicial de "instructores profesionales": esos
son relatores, tabla `lecturers` aparte, fuera de alcance). 200 alumnos: 70 Clase B sede 1,
70 Clase B + 60 Profesionales sede 2 (solo la sede 2 dicta cursos profesionales, respetando
`courses.branch_id` real).

## AC5 — ~6 meses de agenda, 3+ clases/día

✅ **Cumplido.** ~1680 sesiones en `class_b_sessions`, generadas por alumno (no por día, tras
descubrir que el enfoque "greedy día a día" agotaba alumnos disponibles antes de llegar a
semanas recientes). Rango: 150 días atrás a 15 días adelante, solo lunes a viernes (respeta
`courses.schedule_days=[1,2,3,4,5]`), 6 franjas horarias por día
(08:30/09:20/10:10/15:00/15:50/16:40). Solo 15 alumnos "egresados" (curso completo, 12/12 en
el pasado); los ~125 restantes "en curso" (parte de sus 12 clases ya tomadas, resto agendado
a futuro) — decisión explícita del owner para que la mayoría de la agenda esté viva, no
histórica.

## AC6 — Sin filas huérfanas ni estados imposibles

✅ **Cumplido**, con iteración activa durante la ejecución:
- `enrollments`/`class_b_sessions` huérfanas: 0 (verificado por query).
- Pagos con variedad real (15% sin pagar, 15% parcial, 70% pagado) para no dejar el estado
  financiero plano.
- Cada instructor con `vehicle_assignments` activa (sin esto, la UI de Agenda bloqueaba
  agregar clases nuevas — bug descubierto y corregido durante esta misma ejecución).
- Balance de carga por instructor verificado (sede 1: 101-106 clases/instructor, sede 2:
  116-123) tras corregir el reparto inicial que dejaba solo 2 instructores Clase B cubriendo
  toda la sede 2.

## AC-E1 — Reset idempotente / seguro de re-ejecutar

✅ **Cumplido.** El script de limpieza de datos `seed` (identificados por
`email LIKE '%.seed%@test-data.local'` / `number LIKE 'SEED-%'`) se corrió más de una vez
durante la sesión (para corregir bugs de agenda) sin dejar residuos ni duplicados —
confirmado por las verificaciones de conteo en `0` tras cada limpieza.

## AC-E2 — Validar primero contra Supabase local

⚠️ **Desviación documentada, no bloqueante.** El proyecto **no usa Docker ni tiene Supabase
local** (confirmado por el owner durante la ejecución — la suposición original de la spec,
heredada de la Asignación `ASG-i-006`, era incorrecta). Se sustituyó por el mismo principio
de seguridad usando transacciones reales: cada script se corrió primero con
`BEGIN; ... ROLLBACK;` contra el entorno compartido (probado 2 veces limpio antes de
cualquier `COMMIT`), más tablas de respaldo (`backup_students_pre_reset`,
`backup_instructors_pre_reset`, borradas después de confirmar éxito) y una verificación
explícita anti-cuentas-protegidas dentro del propio script. Cumple el objetivo real del AC
(no arriesgar el entorno compartido sin ensayo previo) sin el mecanismo literal que asumía
la spec.

---

## Fuera de alcance respetado

- ✅ Sin cambios de esquema/RLS/constraints (más allá de las 8 filas nuevas en `vehicles`,
  ya cubierto en AC3).
- ✅ Sin automatización de CI — todo ejecutado manualmente por el owner vía SQL Editor.
- ✅ Sin tocar dominios no relacionados.

## Deuda técnica / hallazgos derivados

- **`fix-032-i-agenda-clase-b-vista-disponibilidad-lenta`** (abierto, `in_progress`): la
  vista `v_class_b_schedule_availability` tarda ~8s al cambiar de semana en la Agenda con
  el volumen nuevo (~1680 sesiones) — bug preexistente, nunca visible con el volumen bajo de
  antes. No bloquea el cierre de esta spec (es un hallazgo derivado de probar con datos
  realistas, que era justamente el objetivo de `0008-i`).
- No se generó agenda para alumnos profesionales (`professional_practice_sessions`/
  `professional_theory_sessions`) — decisión explícita del owner, fuera de alcance para
  esta iteración.

## Cambios en índices

Ninguno — no se creó código de aplicación, componentes, facades ni modelos.
