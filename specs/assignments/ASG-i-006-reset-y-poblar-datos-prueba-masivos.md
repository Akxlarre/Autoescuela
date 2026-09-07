# Asignación ASG-i-006 — Resetear y repoblar la BD de prueba con datos masivos realistas

> **status:** completada
> **owner:** i
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-09-06
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-09-06
> **resulting_track:** 0008-i-reset-y-poblar-datos-prueba

---

## Contexto / Objetivo

La base de datos de prueba acumuló datos desde el inicio del proyecto (instructores,
alumnos, matrículas, clases, pagos, etc.) y hace falta dejarla "desde cero" en esas tablas
para volver a poblarla con un volumen de datos alto y realista, y así ver cómo se comporta
la app con carga real (listas, agenda, reportes) — sin ser exactamente una prueba de estrés
formal, pero apuntando a un volumen considerable.

**Fase 1 — Reset:** borrar todos los instructores y todos los alumnos existentes (y todo lo
que dependa de ellos: matrículas, clases, asistencia, pagos, certificaciones, etc.), **sin
tocar las cuentas de login** (los `users`/`auth` con los que el equipo entra al sistema —
`admin@test.com`, `secretaria@test.com`, `instructor@test.com`, `alumno@test.com`, etc. —
esas se mantienen intactas). No debe romper ninguna tabla ni el esquema del sistema.

**Fase 2 — Repoblar:** generar datos de prueba en volumen alto y realista — varios meses
completos de agenda, más de 3 clases por día, varios instructores distintos, muchos alumnos
(tanto Clase B como Profesional), con sus matrículas/pagos/asistencia correspondientes para
que los datos sean coherentes entre sí (no filas huérfanas o inconsistentes).

Toda la información es exclusivamente de prueba/desarrollo — no hay datos reales de
producción en juego.

## Alcance sugerido

- Fase 1 (reset) y Fase 2 (seed) probablemente se diseñan y ejecutan como una unidad, pero
  quien reclame debe decidir si conviene separarlas en 2 sub-tareas/tracks o resolverlas
  en un solo track con ambas fases documentadas.
- Diseñar el reset con guardrails explícitos: excluir por diseño (no por casualidad) las
  cuentas de login del equipo — identificar el criterio exacto para distinguir "cuenta de
  login del equipo" vs "alumno/instructor de prueba a borrar" antes de escribir cualquier
  `DELETE`.
- El volumen y la coherencia de los datos generados (relaciones válidas entre
  alumnos/instructores/clases/matrículas/pagos) importan más que la cantidad exacta — no
  generar filas que rompan constraints o dejen la UI en un estado imposible.
- Evaluar si conviene un script reutilizable (para volver a resetear/poblar en el futuro)
  en vez de una operación de un solo uso.
- Fuera de alcance (a menos que el owner decida lo contrario al reclamar): tocar el
  esquema de BD (columnas/tablas nuevas) — esto es sobre datos, no sobre estructura.

## Referencias

- Ninguna spec previa directamente relacionada. Ver `indices/DATABASE.md` para el esquema
  actual antes de diseñar los `DELETE`/`INSERT`.

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado — es una operación de datos (probablemente scripts SQL /
  `supabase/migrations/` o un script de seed ad-hoc), no cambios de código de aplicación.
  Confirmar con `indices/DATABASE.md` qué tablas dependen de `instructors`/`students` antes
  de definir el orden de borrado (foreign keys).

## Notas para quien la reclame

- **Regla del proyecto:** las migraciones de BD se dan en el chat para que el humano las
  aplique manualmente — no se auto-escriben ni auto-ejecutan contra Supabase. Diseñar el
  plan de reset/seed como scripts SQL a revisar y correr por el owner, no como algo que el
  agente ejecute solo contra la base real.
- Antes de borrar nada, confirmar con el owner el criterio exacto de qué cuentas de login
  hay que preservar (¿todas las de `specs/` credenciales de prueba? ¿algo más?).
- Recomendado probar el reset+seed primero contra Supabase local (Docker) antes de tocar
  cualquier entorno compartido, mismo patrón ya usado en otras specs del proyecto
  (`0012-m`).
