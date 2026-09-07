# Spec 0008-i — Resetear y repoblar la BD de prueba con datos masivos realistas

> **Status:** done
> **Created:** 2026-09-06
> **Closed:** 2026-09-07
> **Owner:** i
> **Priority:** P2

---

## 1. Contexto de negocio

**Origen:** Asignación de equipo `ASG-i-006` (`specs/assignments/ASG-i-006-reset-y-poblar-datos-prueba-masivos.md`).

**Persona afectada:** Equipo de desarrollo (uso interno — no afecta a usuarios finales).

**Problema que resuelve:**
La base de datos de prueba acumuló datos desde el inicio del proyecto (instructores,
alumnos, matrículas, clases, pagos, etc.), lo que dificulta evaluar cómo se comporta la app
con un volumen de datos alto y realista (listas, agenda, reportes) porque el dataset actual
es orgánico e inconsistente en volumen. Hace falta dejar el proyecto "desde cero" en las
tablas de instructores y alumnos (y todo lo dependiente de ellos), preservando únicamente
las cuentas de login con las que el equipo entra al sistema, y repoblar con un dataset
grande y coherente.

**Criterio de exclusión confirmado (2026-09-06):** se preservan explícitamente las 4-5
cuentas de login especiales conocidas (`admin@test.com`, `secretaria@test.com`,
`secretaria2@test.com`, `instructor@test.com`, `alumno@test.com`) y sus filas
`students`/`instructors` asociadas — el resto de instructores y alumnos se borra.

**Volumen objetivo confirmado (2026-09-06):** ~6 meses de agenda completos, ~15
instructores, ~150-300 alumnos (mezcla Clase B / Profesional), con más de 3 clases por día
en la agenda, y todos los datos dependientes (matrículas, pagos, asistencia,
certificaciones) coherentes entre sí — sin filas huérfanas ni estados imposibles en la UI.

**Hipótesis de valor:** Un dataset de prueba grande y coherente permite detectar problemas
de rendimiento, paginación y UX bajo carga real que un dataset pequeño/orgánico no expone
(precedente: `0039-b-benchmark-umbral-virtual-scroll`, que ya encontró comportamiento
distinto entre datasets chicos y grandes en otras superficies del proyecto).

---

## 2. User Stories

- **US1**: Como desarrollador, quiero poder resetear las tablas de instructores/alumnos de
  prueba a un estado limpio, sin perder las cuentas de login del equipo, para poder
  repoblar con un dataset controlado.
- **US2**: Como desarrollador, quiero un dataset de prueba de volumen alto y coherente
  (~6 meses, ~15 instructores, ~150-300 alumnos, 3+ clases/día) para evaluar cómo se
  comporta la app con carga real de datos.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given la BD de prueba con datos orgánicos acumulados, When se ejecuta el reset,
  Then todas las filas de `instructors`/`students` (y sus dependientes: matrículas, clases,
  asistencia, pagos, certificaciones) quedan eliminadas, **excepto** las asociadas a las
  cuentas de login preservadas (`admin@test.com`, `secretaria@test.com`,
  `secretaria2@test.com`, `instructor@test.com`, `alumno@test.com`).
- **AC2**: Given el reset ejecutado, When el equipo intenta loguearse con cualquiera de las
  cuentas preservadas, Then el login funciona igual que antes del reset (sin romper el
  acceso del equipo).
- **AC3**: Given el reset ejecutado, When se inspecciona el esquema de la BD, Then ninguna
  tabla, columna, constraint, policy RLS o índice fue alterado — solo se borraron filas.
- **AC4**: Given la BD reseteada, When se ejecuta el seed, Then existen ~15 instructores y
  ~150-300 alumnos de prueba nuevos, con mezcla de Clase B y Profesional.
- **AC5**: Given el seed ejecutado, When se revisa la agenda, Then existen ~6 meses
  completos de clases programadas, con más de 3 clases por día en promedio.
- **AC6**: Given el seed ejecutado, When se navega cualquier listado/reporte afectado
  (alumnos, instructores, agenda, pagos, certificaciones), Then los datos se ven coherentes
  y completos — sin filas huérfanas, referencias rotas, ni estados de UI imposibles
  (ej. una clase sin instructor asignado, un alumno sin matrícula).

### Edge cases obligatorios

- **AC-E1**: Given el reset se ejecuta más de una vez seguida (re-entrada), When se corre de
  nuevo, Then no falla ni duplica — es idempotente o al menos seguro de re-ejecutar.
- **AC-E2**: Given el proceso se prueba primero contra Supabase local (Docker), When se
  valida ahí, Then el owner recién después decide si aplicarlo contra el entorno compartido.

---

## 4. Out of scope

- ❌ Cambios de esquema (columnas, tablas, constraints, RLS nuevas) — esta spec es
  exclusivamente sobre datos, no sobre estructura.
- ❌ Automatizar el reset/seed como parte de un pipeline de CI o de un flujo de producción —
  es una operación manual, puntual, ejecutada por el owner.
- ❌ Tocar datos de otros dominios no mencionados (ej. configuración web, servicios
  especiales) salvo que dependan directamente de instructores/alumnos borrados.

---

## 5. Dependencias

### Specs previas
- Ninguna bloqueante. Referencia útil: `0012-m-persistir-borrador-cierre-caja` (patrón de
  validar migraciones contra Supabase local antes de aplicar).

### Capacidades del proyecto que se asumen existentes
- Esquema actual de `instructors`, `students`, `enrollments`, `classes`, `payments`,
  `certifications` (y demás tablas dependientes) — ver `indices/DATABASE.md`.
- Cuentas de login de prueba ya sembradas (`admin@test.com`, `secretaria@test.com`,
  `secretaria2@test.com`, `instructor@test.com`, `alumno@test.com`).

### Capacidades nuevas requeridas
- Ninguna — es generación/borrado de datos sobre el esquema existente.

---

## 6. Datos y modelo (preliminar)

- Tablas nuevas / modificadas: ninguna (solo lectura/escritura de filas).
- Modelos UI nuevos: ninguno.
- RLS requerida: sin cambios — se debe verificar que las policies existentes permitan el
  `DELETE`/`INSERT` planeado desde el rol con el que se ejecute el script (probablemente
  `service_role` o equivalente admin, a definir en `plan.md`).

---

## 7. UX y flujos (preliminar)

- No aplica — sin cambios de UI. El "flujo" es un script/migración que el owner ejecuta
  manualmente, primero contra Supabase local.

---

## 8. Métricas de éxito post-launch

- El equipo puede navegar listados, agenda y reportes con el nuevo volumen de datos sin
  encontrar inconsistencias.
- El dataset sirve como base estable para futuras pruebas de UX/rendimiento con carga real.

---

## 9. Notas / decisiones abiertas

- [x] Criterio de exclusión de cuentas de login — confirmado con el owner (ver §1).
- [x] Volumen objetivo del seed — confirmado con el owner (ver §1).
- [ ] Definir en `plan.md` el orden exacto de `DELETE` respetando foreign keys (revisar
  `indices/DATABASE.md` para el grafo de dependencias real antes de escribir el SQL).
- [ ] Definir en `plan.md` si el reset+seed se entrega como migración SQL versionada
  (`supabase/migrations/`) o como script ad-hoc fuera de esa carpeta (dado que no es un
  cambio de esquema, podría no calzar con la convención de migraciones numeradas).
- [ ] Recordatorio de proceso: las migraciones/scripts de BD se entregan en el chat para
  que el owner las aplique manualmente — no se auto-ejecutan contra Supabase.
- Originado de Asignación ASG-i-006 (specs/assignments/ASG-i-006-reset-y-poblar-datos-prueba-masivos.md).

---

## Changelog

- 2026-09-06 — draft inicial por i, vía /assign-claim de ASG-i-006
- 2026-09-07 — cerrada tras ejecución manual guiada en chat (ver `acceptance.md`).
  **AC-E2 con desviación documentada**: el proyecto no usa Docker/Supabase local — se
  sustituyó por validación con transacciones `BEGIN`/`ROLLBACK` directamente contra el
  entorno compartido (mismo efecto de seguridad: cero cambios reales hasta confirmar, sin
  requerir un segundo ambiente). Descubrió además un bug preexistente de performance en
  `v_class_b_schedule_availability`, derivado a `fix-032-i` (no bloqueante para esta spec).
