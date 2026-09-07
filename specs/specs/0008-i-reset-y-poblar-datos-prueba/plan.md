# Plan 0008-i — Resetear y repoblar la BD de prueba con datos masivos realistas

> **Spec:** [spec.md](./spec.md)
> **Status:** draft
> **Created:** 2026-09-06

---

## 1. Resumen ejecutivo

Dos scripts SQL independientes, entregados al owner para ejecutar manualmente (primero
contra Supabase local): **(1) RESET** — borra en cascada todo lo que depende de
`students`/`instructors`, excepto las filas de las 5 cuentas de login protegidas
(identificadas por `users.email`, no por heurística); **(2) SEED** — genera ~15
instructores, ~150-300 alumnos (Clase B + Profesional) con RUTs válidos (algoritmo módulo
11 ya existente en el proyecto) y foto placeholder compartida, más ~6 meses de agenda con
3+ clases/día, manteniendo la coherencia referencial en todo momento.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| (a definir en `tasks.md`, probablemente `supabase/migrations/` o script ad-hoc fuera de esa carpeta) | Script SQL (RESET) | Borra instructores/alumnos de prueba y dependientes, preservando las 5 cuentas de login |
| (a definir en `tasks.md`) | Script SQL (SEED) | Genera el dataset masivo (instructores, alumnos, matrículas, agenda, pagos, asistencia) |

### Archivos a MODIFICAR

Ninguno — es una operación de datos, no de código de aplicación.

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Utilidades existentes que reutilizamos
- `core/utils/rut.utils.ts` → `calculateRutDv(body)` — algoritmo módulo 11 ya implementado
  y probado (`fix-064-b`). El script de SEED replica exactamente esta fórmula en SQL (es
  determinística, no hay nada que inventar) para generar RUTs válidos y únicos.
- Precedente `cleanup_expired_drafts()` (función SQL existente, `indices/DATABASE.md`) —
  ya demuestra el patrón de "borrar `students`/`users` huérfanos con guards explícitos
  (`supabase_uid IS NOT NULL` protege admins/secretarias)". El RESET de esta spec usa el
  mismo espíritu de guard explícito, pero por `email` en vez de `supabase_uid`.

### Componentes/Facades que NO existen y debemos crear
- Ninguno — no hay UI ni lógica de aplicación nueva.

---

## 4. Modelo de datos

### 4.1 — Criterio de exclusión (confirmado con el owner)

```sql
-- IDs de students/instructors que NO se tocan (ligados a cuentas de login del equipo)
SELECT s.id FROM students s
JOIN users u ON u.id = s.user_id
WHERE u.email IN (
  'admin@test.com', 'secretaria@test.com', 'secretaria2@test.com',
  'instructor@test.com', 'alumno@test.com'
);
-- (mismo patrón con instructors i JOIN users u ON u.id = i.user_id)
```

En la práctica, de esas 5 cuentas solo `alumno@test.com` debería resolver una fila en
`students` y solo `instructor@test.com` una fila en `instructors` — pero el filtro por
`email` cubre el caso exacto sin necesitar esa asunción.

### 4.2 — Grafo de dependencias (RESET) — a verificar contra el esquema real

Relevado desde `indices/DATABASE.md` (columnas `→ students.id` / `→ instructors.id` y
transitivamente vía `enrollment_id`/`class_b_session_id`). **Antes de escribir el SQL
final, correr contra Supabase local:**

```sql
SELECT tc.table_name, kcu.column_name, ccu.table_name AS references_table,
       rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('students', 'instructors', 'enrollments', 'class_b_sessions');
```

Esto confirma si cada FK ya es `ON DELETE CASCADE` (Postgres limpia solo) o
`NO ACTION`/`RESTRICT` (hay que borrar el hijo primero a mano). El orden de abajo asume lo
segundo (más seguro, funciona sea cual sea la regla real):

**Nivel 3 (hijos de `class_b_sessions`/`enrollment_id` más profundos):**
`class_b_practice_attendance`, `route_incidents`

**Nivel 2 (hijos directos de `enrollments`):**
`class_b_sessions`, `digital_contracts`, `license_validations`, `class_b_exam_attempts`,
`professional_theory_attendance`, `professional_practice_attendance`, `student_documents`,
`payments`, `consents` (nullable, solo si `enrollment_id` apunta a uno afectado)

**Nivel 1 (hijos directos de `students`/`instructors`):**
`enrollments`, `certificates`, `class_b_exam_scores`, `disciplinary_notes`,
`standalone_course_enrollments`, `special_service_sales` (nullable),
`instructor_documents`, `vehicle_assignments`, `instructor_replacements`,
`instructor_monthly_hours`, `instructor_advances`, `instructor_monthly_payments`,
`slot_holds`

**Nivel 0 (raíz):**
`students`, `instructors`

**Storage (fuera de BD, revisar aparte):** las fotos/documentos de los alumnos/instructores
borrados quedan huérfanas en el bucket `documents` (`students/{id}/...`,
`instructor_documents`) — evaluar si conviene limpiarlas también o dejarlas (no rompen
nada, solo ocupan espacio de prueba).

### RLS

Sin cambios — el script de RESET/SEED se ejecuta con rol `service_role` (bypass RLS),
igual que las Edge Functions del proyecto. No se toca ninguna policy.

### Modelos UI/DTO

Sin cambios.

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
Owner (Supabase local primero, luego decide si aplicar a compartido):
  1. Correr query de descubrimiento (§4.2) → confirmar ON DELETE rules reales
  2. Ejecutar script RESET:
     a. Calcular set de IDs protegidos (join por email, §4.1)
     b. DELETE en orden Nivel 3 → 0, siempre con WHERE ligado a los IDs no-protegidos
     c. Verificar: login de las 5 cuentas sigue funcionando
  3. Ejecutar script SEED:
     a. Generar ~15 instructores (users + instructors, RUT válido, licencia vigente)
     b. Generar ~150-300 alumnos (users + students, RUT válido, id_photo → placeholder
        compartido en student_documents)
     c. Generar matrículas (mix class_b/professional) coherentes con cada alumno
     d. Generar ~6 meses de class_b_sessions / professional_*_sessions, 3+ clases/día,
        repartidas entre los instructores generados, respetando los triggers de
        exclusión mutua ya existentes (`prevent_double_booking_class_b_sessions`,
        `prevent_concurrent_in_progress_class_b_sessions`)
     e. Generar pagos/asistencia coherentes con el avance de cada matrícula
  4. Validar AC4-AC6 navegando la app contra el dataset nuevo
```

### Capas tocadas

- **Script/Migration**: SQL puro, ejecutado manualmente por el owner. Sin cambios de
  código de aplicación (Angular/Facades/Components).

---

## 6. Restricciones aplicables

- [ ] `architecture.md` — N/A (sin UI)
- [ ] `facades.md` — N/A
- [ ] `models.md` — N/A
- [ ] `visual-system.md` — N/A
- [ ] `swr-pattern.md` — N/A
- [ ] `notifications.md` — N/A
- [ ] `testing-tdd.md` — N/A (no hay lógica de aplicación nueva)
- [ ] `ai-readability.md` — N/A

---

## 7. Plan de testing

- Sin tests unitarios (no es código de aplicación).
- **Validación funcional obligatoria**, en este orden, siempre contra Supabase local
  primero:
  1. Tras RESET: login con las 5 cuentas protegidas funciona igual que antes.
  2. Tras RESET: `SELECT count(*) FROM students` / `instructors` refleja solo lo
     preservado.
  3. Tras SEED: navegar Base Alumnos, Instructores, Agenda, Reportes Contables,
     Certificaciones — sin errores de consola, sin filas con referencias rotas.
  4. Muestreo manual de 5-10 alumnos/instructores generados: datos coherentes (RUT válido,
     matrícula con curso real, clases con instructor asignado, fechas dentro de los ~6
     meses objetivo).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Borrar por error una cuenta de login del equipo | Baja | Exclusión por `email` explícito (no heurística), verificado en `spec.md` AC2 |
| Grafo de dependencias real distinto al relevado desde `indices/DATABASE.md` (puede haber quedado desactualizado) | Media | Correr la query de `information_schema` (§4.2) contra Supabase local ANTES de escribir el DELETE final — no confiar solo en la documentación |
| Deadlock/violación de FK a mitad del RESET por orden incorrecto | Media | Ejecutar dentro de una transacción (`BEGIN`/`COMMIT`) — si falla, revierte todo, no deja la BD a medias |
| Seed masivo choca con triggers de exclusión mutua (`prevent_double_booking_class_b_sessions`, etc.) | Media | Generar horarios de clases con la misma lógica de slots de 45 min que ya usa `v_class_b_schedule_availability`, evitando solapes por diseño en vez de confiar en que el trigger los descarte silenciosamente |
| Volumen alto tarda demasiado en insertarse en Supabase local | Baja | Volumen confirmado moderado (~6 meses, ~15 instructores, ~150-300 alumnos), no el escenario de mayor volumen que se descartó explícitamente |
| Fotos/documentos huérfanos en Storage tras el RESET | Baja | Documentado en §4.2 como pendiente de decisión — no bloquea el AC principal (son solo archivos de prueba sin URL pública, no rompen la app) |

---

## 9. Orden de implementación

1. Correr la query de `information_schema` (§4.2) contra Supabase local — confirmar
   `ON DELETE` real de cada FK antes de escribir el SQL final.
2. Escribir el script RESET completo (con `BEGIN`/`COMMIT`), probarlo contra Supabase
   local.
3. Validar AC1-AC3 y AC-E1 (idempotencia) tras el RESET.
4. Escribir el generador de SEED (RUT válido + foto placeholder + volumen confirmado).
5. Validar AC4-AC6 tras el SEED, navegando la app contra el dataset nuevo.
6. Entregar ambos scripts al owner (en el chat, no auto-ejecutados) para que decida
   aplicarlos contra el entorno compartido.

---

## 10. Estimación

M (1-2 días) — el mapeo de dependencias reales + la coherencia del generador de seed
(matrículas/agenda/pagos consistentes entre sí) es la parte que más tiempo toma, no el
volumen en sí.

---

## Changelog

- 2026-09-06 — plan generado vía /spec-plan, con criterio de exclusión y volumen ya
  confirmados por el owner en conversación previa
