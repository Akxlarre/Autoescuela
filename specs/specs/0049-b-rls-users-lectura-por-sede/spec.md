# Spec 0049-b — La secretaria solo lee los datos personales de usuarios de su sede

> **Status:** done
> **Created:** 2026-10-07
> **Owner:** Benjamín
> **Priority:** P1 (datos personales; no bloquea operar el piloto)

---

## 1. Contexto de negocio

**Origen:** caso R11 de `ASG-i-034` (`fix-197-b`). **Decisión del owner (2026-10-07):** la secretaria
no debe poder leer RUT/teléfono de usuarios de otras sedes.

Hoy la política `select_users` deja a **cualquier** secretaria leer **todas** las filas de `users`
(`auth_user_role() = 'secretary'`, sin sede). Fue una decisión deliberada de `fix-002-b`, y la
spec `0047-b` (aislamiento por sede) la dejó fuera de alcance. `ASG-i-043` / `fix-179-b` cerró las
**escrituras** de la secretaria sobre `users`; la **lectura** sigue abierta: desde la consola del
navegador una secretaria de la sede 1 puede listar RUT, teléfono, correo y fecha de nacimiento de
todo el personal y los alumnos de la sede 2.

### Por qué no es un cambio de una línea

`users` es la tabla más leída de la app: **38 facades** la leen con join (`users!inner(…)` o
`users(…)`). Si la RLS esconde filas, un `!inner` hace **desaparecer la fila padre** (una matrícula,
un pago, una clase) y un join simple deja el nombre en `null`, **sin error**. Casos que hoy cruzan
sedes (medidos en producción el 2026-10-07):

| Caso | Hoy en prod | Qué se rompería |
|---|---|---|
| Alumno cuyo `users.branch_id` ≠ sede de su matrícula | 1 | La matrícula desaparece de Base Alumnos / Agenda de su sede |
| Pago registrado por personal de otra sede (`registered_by`) | 4 | "Registrado por" en blanco; con `!inner`, el pago desaparece |
| Instructor "Ambas" de la otra sede | 0 (el modelo lo permite, spec 0004-m) | Desaparece de Instructores y de la Agenda de la otra sede |
| Clases con instructor de otra sede | 0 | Clase sin nombre de instructor / desaparece |

## 2. User Stories

- Como **admin**, quiero que una secretaria no pueda ver los datos personales de usuarios de otra
  sede, para cumplir con el resguardo de datos personales.
- Como **secretaria**, quiero seguir viendo en mi sede todo lo que veo hoy (alumnos, instructores
  "Ambas", quién registró un pago), para que nada de mi trabajo diario cambie.

## 3. Propuesta (a validar en el plan)

**A — Filas por relación (recomendada).** La secretaria ve una fila de `users` si:
1. es de una sede visible para ella (`branch_visible(branch_id)`; con grant, todas), **o**
2. es un instructor "Ambas", **o**
3. es un alumno con alguna matrícula en una sede visible, **o**
4. es personal (admin/secretaria) — solo nombre, ver B.

Se implementa con una función `SECURITY DEFINER` (`secretary_can_view_user(id)`), como
`class_b_slot_occupied` en fix-196-b, para no evaluar subconsultas fila por fila con RLS anidada.

**B — Columnas sensibles aparte.** Además de A, el personal de otras sedes aparece solo con nombre:
RUT, teléfono, correo y fecha de nacimiento de usuarios fuera de su sede se leen por una vista o RPC
acotada. Más trabajo (cambia consultas), más estricto.

**Recomendación:** A en esta spec; B solo si el owner lo pide (los 4 pagos "registrados por" hoy son
de personal, y el nombre de quien registró no es un dato sensible).

## 4. Acceptance Criteria

- **AC1:** una secretaria sin grant **no** obtiene filas de `users` de un alumno, instructor o
  secretaria de otra sede que no cumpla (2) o (3) — verificado impersonando en un test SQL.
- **AC2:** sigue viendo: usuarios de su sede, instructores "Ambas", alumnos con matrícula en su sede
  aunque su `users.branch_id` sea otro.
- **AC3:** la secretaria con grant y el admin ven todo (sin cambios).
- **AC4:** instructor y alumno: sin cambios (`select_users` y `select_users_via_class_relationship`).
- **AC5:** inventario de los 38 facades revisado: ninguna pantalla de la secretaria pierde filas ni
  nombres (e2e de Base Alumnos, Agenda, Instructores, Pagos, Asistencia contra el build de prod).
- **AC6:** rendimiento: Base Alumnos y Agenda de la secretaria no empeoran más de un 20 % (EXPLAIN
  ANALYZE impersonando, como en fix-196-b).

## 5. Out of scope

- Escrituras sobre `users` (resueltas en `fix-179-b`).
- Columnas sensibles por vista/RPC (propuesta B), salvo decisión del owner.
- Tablas de Clase Profesional (bloqueadas en el piloto).

## 6. Riesgos

- Un `!inner` olvidado en el inventario = filas que desaparecen en silencio → AC5 obligatorio.
- Migración sobre la política más usada: aplicar con test SQL en transacción revertida antes, como
  en fix-196-b / fix-206-b.
