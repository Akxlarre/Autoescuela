# Spec 0047-b — RLS: aislamiento por sede para la secretaria (tablas del piloto)

> **Status:** done
> **Created:** 2026-10-01
> **Owner:** Benjamín
> **Priority:** P0

---

## 1. Contexto de negocio

**Origen:** Asignación `ASG-i-045` (tanda de testing del piloto, 2026-09-29/30), creada por Ignacio.
Inventario completo en `specs/testing-piloto/037-transversal-multisede-shell.md` §1.3.

[Heredado de ASG-i-045] En varias tablas la RLS solo exige rol admin o secretaria, sin mirar la
sede. La única barrera entre sedes es el filtro que aplica el facade en el navegador: desde la
consola, una secretaria de la sede A puede leer, modificar o borrar datos de la sede B.

**Confirmación propia contra la BD remota (2026-10-01, solo lectura, `pg_policies` + impersonación
de `secretaria@test.com` sede 1 dentro de `BEGIN … ROLLBACK`):**

- `class_b_sessions`: la secretaria de la sede 1 lee **1.728** clases (todas las sedes).
- `payments`: lee **176** pagos, de los cuales solo **61** son de matrículas que puede ver.
  ⚠️ **Contradice la corrección de la asignación** ("la lectura de `payments` sí está filtrada"):
  en la BD remota `select_payments` es solo por rol. La lectura de `students` y `enrollments`
  sí está filtrada (eso de la corrección se mantiene).
- `special_service_sales`: lee 4 ventas de la sede 2.
- No existen policies `RESTRICTIVE` en `public`: lo que muestra `pg_policies` es todo lo que hay.
- `class_b_theory_attendance` y `secretary_observations`, citadas en el inventario, **no existen**
  en la BD remota.

**Persona afectada:** Secretaria (sede A) como vector; alumnos, instructores y la caja de la sede B
como víctimas. Admin no cambia.

**Problema que resuelve:**
Una secretaria puede, desde la consola del navegador, leer pagos, clases, ventas, anticipos y
documentos de otra sede, y además crear, modificar o borrar filas de esa sede (archivar alumnos,
cancelar clases, alterar pagos). Son datos personales y financieros (Ley 21.719) y descuadran la
caja de una sede que no es la suya. Es bloqueante para la entrega del piloto.

**Hipótesis de valor:**
La sede pasa a ser una garantía del servidor, no del navegador: una secretaria de A obtiene 0 filas
de B y cualquier escritura sobre B es rechazada, sin cambiar nada de lo que ve en la app.

---

## 2. User Stories

- **US1**: Como dueño de la escuela, quiero que una secretaria no pueda leer datos de la otra sede
  aunque use la consola, para cumplir la ley de datos personales.
- **US2**: Como dueño, quiero que una secretaria no pueda crear, modificar ni borrar datos de la
  otra sede, para que la caja y la agenda de cada sede sean confiables.
- **US3**: Como secretaria (con o sin grant multi-sede), quiero seguir viendo y operando
  exactamente lo mismo que hoy en la app, para que el cambio no me quite nada.

---

## 3. Acceptance Criteria (Gherkin)

> Se verifican con `supabase/tests/rls/0047-b-aislamiento-por-sede.sql`, que impersona usuarios
> reales dentro de `BEGIN … ROLLBACK` (no deja rastros) y falla con `RAISE EXCEPTION` si un caso
> no se cumple.

- **AC1 (lectura)**: Given una secretaria sin grant de la sede 1, When hace `SELECT` sobre
  `class_b_sessions`, `class_b_practice_attendance`, `class_b_theory_sessions`, `absence_evidence`,
  `payments`, `discount_applications`, `instructor_advances`, `instructor_replacements`,
  `special_service_sales`, `standalone_courses`, `standalone_course_enrollments`,
  `school_documents`, `certificates` y `certificate_issuance_log`, Then no obtiene ninguna fila
  que pertenezca a la sede 2.
- **AC2 (escritura rechazada)**: Given la misma secretaria, When intenta `UPDATE` o `DELETE` de una
  fila de la sede 2 en `students`, `class_b_sessions`, `payments`, `special_service_sales`,
  `standalone_courses` y `digital_contracts`, Then afecta 0 filas; y When intenta `INSERT` de una
  fila que apunta a la sede 2 en `class_b_sessions`, `payments`, `special_service_sales` y
  `student_documents`, Then la BD lo rechaza por RLS.
- **AC3 (no regresión, sede propia)**: Given la misma secretaria, When lee las tablas del AC1,
  Then obtiene exactamente las mismas filas de su sede que antes del cambio; y puede actualizar una
  fila de su sede (ej. `class_b_sessions.notes`) sin error.
- **AC4 (grant multi-sede)**: Given una secretaria con `can_access_both_branches = true`, When lee
  las tablas del AC1, Then ve las filas de ambas sedes (igual que hoy).
- **AC5 (admin intacto)**: Given un admin, When lee las tablas del AC1, Then ve el mismo conteo que
  antes del cambio.
- **AC6 (otros roles intactos)**: Las cláusulas de instructor y alumno de cada policy tocada quedan
  idénticas a las vigentes (verificado comparando `pg_policies` antes/después).

### Edge cases obligatorios

- **AC-E1**: Given una fila con `branch_id` NULL (hoy: 1 venta especial, 1 documento de escuela),
  When la lee una secretaria, Then sigue visible para cualquier secretaria (semántica actual de
  `branch_visible()`; no se cambia en esta spec).
- **AC-E2**: Given un instructor marcado `both_branches`, When una secretaria de cualquiera de las
  dos sedes lee sus anticipos o reemplazos, Then los ve (misma regla que `select_instructors`).
- **AC-E3**: Given una secretaria que mueve una fila propia a la otra sede con `UPDATE`
  (ej. `special_service_sales.branch_id = 2`), Then la BD lo rechaza (el `USING` se aplica también
  como `WITH CHECK` a la fila nueva).

---

## 4. Out of scope

- ❌ RLS de `users` (lectura de todos los usuarios = decisión fix-002; columnas editables) →
  `ASG-i-043`.
- ❌ Storage (`storage.objects`) → `ASG-i-046`.
- ❌ RPC `SECURITY DEFINER` sin validación (`confirm_enrollment_with_payment`, etc., `037 · S1`).
- ❌ Tablas de Clase Profesional (`professional_promotions`, `promotion_courses`, `class_book`,
  `professional_*`): el módulo está bloqueado en el piloto y no se puede probar el flujo; queda
  como follow-up.
- ❌ Flota (`vehicles` y afines, lectura por rol = decisión documentada `032 · R03`) y
  `service_catalog` (catálogo global por diseño).
- ❌ Acceso amplio del rol **instructor** en `class_b_practice_attendance` y
  `class_b_theory_sessions` (lee todas): el portal Instructor está fuera del piloto. Se documenta.
- ❌ `notifications`, `audit_log`, `consents` (INSERT abierto): no es un problema de sede.
- ❌ Cambiar la semántica de `branch_visible()` para filas con `branch_id` NULL.

---

## 5. Dependencias

### Specs previas
- Ninguna. Coordina con `ASG-i-043` / `ASG-i-046` (mismo tema, otras tablas).

### Capacidades del proyecto que se asumen existentes
- Helpers `auth_user_role()`, `auth_user_branch_id()`, `auth_can_access_both_branches()`,
  `branch_visible()`, `auth_student_id()`, `auth_instructor_id()`.
- RLS de `enrollments` y `students` (SELECT) ya filtrada por sede.

### Capacidades nuevas requeridas
- Helpers `SECURITY DEFINER` de alcance por sede para tablas sin `branch_id` directo.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna tabla; solo policies y funciones helper.
- Modelos UI nuevos: ninguno.
- RLS requerida: ver `plan.md`.

---

## 7. UX y flujos (preliminar)

- Sin cambios visibles. La app ya filtra por sede en los facades; el cambio solo cierra el acceso
  directo por API.

---

## 8. Métricas de éxito post-launch

- Test de RLS en verde contra la BD del piloto después de aplicar la migración.
- Cero reportes de "no veo datos de mi sede" en la semana siguiente.

---

## 9. Notas / decisiones abiertas

- Originado de Asignación ASG-i-045 (`specs/assignments/ASG-i-045-rls-sin-filtro-de-sede.md`).
- Hallazgo lateral: `v_class_b_schedule_availability` (`security_invoker`) ya hace `JOIN enrollments`,
  que filtra por sede: una secretaria **ya hoy** no ve como ocupados los horarios de un instructor
  o vehículo "ambas sedes" tomados por la otra sede. Hoy hay 0 instructores `both_branches`
  activos, así que no se manifiesta. No lo cambia esta spec (filtrar `class_b_sessions` por la
  sede de la matrícula no altera el resultado de la vista). Reportado como follow-up.
- Aplicar la migración a la BD remota del piloto requiere el visto bueno del owner (cambia permisos
  de usuarios reales en uso).

---

## Changelog

- 2026-10-01 — aplicada en la BD remota (`supabase db push`, visto bueno del owner); test de RLS en verde fuera de transacción. Cerrada.
- 2026-10-01 — spec redactada por Benjamín (vía Claude) tras confirmar las policies vigentes en la BD remota
