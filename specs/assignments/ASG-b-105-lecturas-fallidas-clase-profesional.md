# Asignación ASG-b-105 — Lecturas fallidas en Clase Profesional

> **status:** pendiente
> **owner:** m
> **tipo_sugerido:** spec
> **priority:** P1
> **created:** 2026-11-20
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Parte de la spec **`0060-b-lecturas-fallidas-como-ceros`**, ya aprobada y con las etapas 0, 1 y 3a
cerradas. Esta asignación cubre la **fase 4 (T4.1 a T4.4)** de su `tasks.md`, que son los facades
de Clase Profesional, y también `admin-pre-inscritos` (de T2.2), que es del mismo dominio. Hoy esas
lecturas descartan su `error`: sin red, la asistencia, los certificados, las promociones o el libro
de clases se ven en 0 o como "sin datos". El objetivo es que toda lectura lance y que cada pantalla
muestre el caso A (error con "Reintentar", sin ceros) o el caso B (datos más un aviso), igual que en
las etapas que ya se cerraron.

**No se crea un track nuevo.** Al reclamarla, el track resultante es `0060-b` y se trabaja sobre sus
tareas.

## Alcance sugerido

- **T4.1, `asistencia-profesional.facade.ts`:** son 27 consultas, la mayoría en `Promise.all` (F2).
  Si falla una de varias consultas que forman un total, falla la carga completa (AC7).
- **T4.2:** `certificacion-profesional` y `archivo-profesional`.
- **T4.3:** `admin-alumnos-profesional`, `libro-de-clases`, `promociones` y `relatores`.
- `admin-pre-inscritos.facade.ts`, que en la spec está en T2.2.
- **T4.4,** validación de la etapa, igual que T1.6.
- Cada facade cumple el **DoD-F** de `tasks.md` y sale de `PENDING` en
  `unchecked-reads.guard.spec.ts`.

## Referencias

- Spec, plan y tareas: `specs/specs/0060-b-lecturas-fallidas-como-ceros/`
- Referencias de implementación: `asistencia-clase-b.facade.ts` (T3.1, el par Clase B de T4.1) y
  `admin-alumnos.facade.ts` (T3.2)
- Contrato: `.claude/rules/swr-pattern.md` §"Errores de carga"
- Asignación madre: ASG-b-102

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/asistencia-profesional.facade.ts`
- `src/app/core/facades/certificacion-profesional.facade.ts`
- `src/app/core/facades/archivo-profesional.facade.ts`
- `src/app/core/facades/admin-alumnos-profesional.facade.ts`
- `src/app/core/facades/libro-de-clases.facade.ts`
- `src/app/core/facades/promociones.facade.ts`
- `src/app/core/facades/relatores.facade.ts`
- `src/app/core/facades/admin-pre-inscritos.facade.ts`
- `src/app/core/facades/unchecked-reads.guard.spec.ts`

## Notas para quien la reclame

- Está asignada a `m` porque Matías tiene el bloque académico y Clase Profesional
  (ASG-i-025, ASG-i-038).
- **La mayoría de estas pantallas están ocultas en el piloto** (`pilot-phase.config.ts`): solo se
  ven Matricular y Base de Alumnos Profesional. X01 no las recorre. Para la prueba manual hay que
  desbloquearlas solo en local, como se hizo con los portales en T3.5, y sin commitear ese cambio.
- T3.5 encontró una columna inexistente (`v_professional_attendance.semaphore`) que pasaba
  desapercibida porque el error se tragaba. En Profesional puede haber más casos así: una pantalla
  que queda en error permanente apenas lanza es una lectura rota, no un falso positivo.
- Se va a tocar `unchecked-reads.guard.spec.ts` en paralelo con ASG-b-104 y ASG-b-106. Cada uno saca
  solo sus líneas de `PENDING`.
