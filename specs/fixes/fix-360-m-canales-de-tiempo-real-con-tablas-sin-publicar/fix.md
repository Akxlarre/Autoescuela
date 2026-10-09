# Fix: seis canales de tiempo real no reciben nada porque escuchan tablas sin publicar
> id: fix-360-m-canales-de-tiempo-real-con-tablas-sin-publicar
> refs: ASG-i-056 · fix-227-m · fix-031-i · fix-264-m · fix-319-m
> status: done
> closed: 2026-10-07
> created: 2026-10-07

## Root Cause
[Heredado de ASG-i-056, confirmado el 2026-10-07]: 6 de los 15 canales Realtime escuchan al menos
una tabla que no está en la publicación `supabase_realtime`. Según `fix-227-m`, eso deja mudo
**todo el canal** aunque reporte `SUBSCRIBED`: las pantallas no se actualizan solas.

Confirmado contra el servidor de tiempo real de la BD de desarrollo (una suscripción de prueba por
tabla; responde "Unable to subscribe…" si no está publicada). Faltan 13 tablas:

| Canal | Pantalla | Tablas sin publicar |
|---|---|---|
| `alumnos-listado-realtime` | Base Alumnos B | `enrollments` |
| `alumnos-profesional-realtime` | Base Alumnos Profesional | `enrollments` |
| `pagos-global-realtime` | Pagos | `enrollments` |
| `alumno-detalle-<id>` | Ficha del alumno | `absence_evidence`, `class_b_practice_attendance`, `professional_theory_attendance`, `professional_practice_attendance`, `professional_module_grades` |
| `cuadratura-hoy-realtime` | Cuadratura | `expenses`, `cash_closings`, `standalone_course_enrollments`, `special_service_sales` |
| `flota-realtime` | Flota | `vehicles`, `vehicle_documents`, `vehicle_assignments` |

Ya publicadas: `students`, `payments`, `class_b_sessions`, `users`, `tasks`, `notifications`,
`instructor_advances`, `instructor_monthly_payments`, `branch_payroll_config`.

Dos problemas que aparecen en cuanto los canales despierten:

- **La ficha no distingue de quién es el cambio** (`024b` R03): su canal escucha las tablas
  completas, así que una asistencia o un pago de cualquier alumno la recargaría.
- **La Base Profesional no se entera de archivar** (`025` U02): archivar cambia `students`, y su
  canal solo escucha `enrollments` (la Base B sí escucha las dos).

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **Migración nueva** `20261007140000_fix360_publicar_tablas_de_canales_realtime.sql`: agrega las
  13 tablas a `supabase_realtime`, cada una solo si falta. La aplica Matías.
- `core/utils/realtime-scope.utils.ts` (nuevo, función pura): decide si un evento de tiempo real
  pertenece al alumno de la ficha (por `enrollment_id` o `student_id` de la fila). Si la fila no
  trae cómo saberlo (un borrado solo trae la clave), se recarga igual.
- `admin-alumno-detalle.facade.ts`: la ficha recarga solo con eventos de su alumno.
- `admin-alumnos-profesional.facade.ts`: el canal escucha también `students`.

## Test de Regresión
- Unit: `realtime-scope.utils.spec.ts` (evento propio, ajeno, sin datos para decidir).
- Script de publicación: las 13 tablas responden "publicada".
- E2E: se quita `knownBug` a `alumnos-b-lista > Q01` y a `clase-profesional > U01`.
- Dos sesiones (después de la migración): `024a` Q01–Q04, Q06 · `024b` R01–R03 · `025` U01, U02.

## Progreso
- [x] Tablas sin publicar confirmadas contra el servidor (13).
- [x] Migración escrita.
- [x] Función pura + test (7 casos); ficha y Base Profesional. `tsc` sin errores; tests de los dos
  facades y del util en verde (122).
- [x] Matías aplicó la migración (2026-10-07).
- [x] Publicación comprobada: las 22 tablas que escucha algún canal responden "publicada" (antes 9).
- [x] `knownBug` retirados de `alumnos-b-lista > Q01` y `clase-profesional > U01`: ambos pasan.
- [x] Casos de dos sesiones, automatizados en `e2e/tiempo-real.spec.ts` (4 tests, en verde):
  - `024a` Q01 ✅ (matricular → aparece) · Q02 ✅ (archivar y restaurar se reflejan) · Q06 ✅
    (un alumno de otra sede no aparece: los eventos respetan la RLS).
  - `025` U01 ✅ · U02 ✅ (archivar y restaurar en la Base Profesional).
  - `024b` R01 ✅ y R03 ✅: una clase agendada al alumno de la ficha la recarga; una agendada a
    otro alumno no dispara ninguna consulta en 5 s.
- Unitarios 3480 en verde, `lint:arch` 0 errores. `alumnos-b-ficha` completo: 83 de 84 en la corrida
  conjunta; el restante (M01, editar perfil) pasó al repetirlo solo.

**No ejecutados:**

- `024a` Q03 (un pago cambia "Con deuda" en la otra sesión) y `024b` R02 (el instructor marca
  asistencia y la ficha se actualiza): usan el mismo mecanismo ya probado (canal vivo + filtro por
  alumno, cubierto por el test unitario para `student_id` y `enrollment_id`), pero no se probaron
  de punta a punta.
- `024a` Q04: subir un documento no actualiza el expediente en la otra sesión porque ningún canal
  escucha documentos. Se deja así: se ve al volver a entrar.
- Cuadratura y Flota: sus tablas quedaron publicadas y el servidor acepta la suscripción; no se
  probó un cambio real en esas pantallas.
