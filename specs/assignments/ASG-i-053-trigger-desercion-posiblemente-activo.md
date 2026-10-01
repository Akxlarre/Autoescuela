# Asignación ASG-i-053 — Verificar si el trigger viejo de deserción sigue activo (2 faltas cancelan la matrícula)

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** hotfix
> **priority:** P0
> **created:** 2026-09-30
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada** (tanda de testing 2026-09-29). `trg_class_b_dropout` (AFTER
INSERT/UPDATE en `class_b_practice_attendance`) mira las 2 asistencias más recientes del alumno
por `recorded_at` —sin mirar número de clase, matrícula ni `archived_at`— y, si ambas son
ausencias, cancela la **matrícula entera**. Se creó en `20260301000008_08_misc_and_triggers.sql:343-385`
y solo se corrigió su recursión en `20260412000000_fix_class_b_dropout_trigger_recursion.sql`;
ninguna migración lo elimina. La regla vigente del negocio (penalización) es otra: 2 faltas
consecutivas cancelan las clases futuras, no la matrícula.

## Alcance sugerido

- **Paso 1, confirmar en la BD remota** (solo lectura):
  `select tgname, tgenabled from pg_trigger where tgname = 'trg_class_b_dropout';`
- Si existe y está habilitado: confirmar con el dueño que no es una regla vigente y eliminarlo
  con una migración (`DROP TRIGGER IF EXISTS …`), y revisar si ya canceló matrículas por error.
- Si no existe: cerrar como "no aplica" dejando la evidencia de la consulta.

## Referencias

- `specs/testing-piloto/027-asistencia-clase-b.md` S1 (§2 trae la consulta)

## Archivos involucrados (opcional, para detectar solapes)

- Nueva migración (solo si se confirma)

## Notas para quien la reclame

- Es de minutos: la consulta decide todo.
