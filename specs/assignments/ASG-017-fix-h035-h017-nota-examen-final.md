# Asignación ASG-017 — Fix H-035 + H-017: Portal Alumno nunca muestra la nota del Examen Final

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Mismo bug encontrado 2 veces en iteraciones distintas del audit (H-017 en Fase 1, H-035 con causa raíz confirmada en Fase 3). Consola muestra `400` permanente: `GET .../class_b_exam_scores?select=grade,created_at&enrollment_id=eq.90`. `student-home.facade.ts:174` pide la columna `grade`, pero la tabla (`20260301000003_03_academy_class_b.sql:182-191`) define la columna como `score`. PostgREST rechaza la query completa, y el fallback silencioso muestra "Pendiente"/"Sin calificación aún" **incluso si la secretaría ya registró una nota real**.

## Alcance sugerido

- Fix simple y acotado: cambiar `.select('grade, created_at')` → `.select('score, created_at')` en `student-home.facade.ts:174`.
- Renombrar/actualizar la variable `examGrade` (línea 265, `examResult.data?.grade`) para leer `.score` en su lugar.
- Verificar en vivo con `alumno@test.com` u otro alumno de Clase B con nota real registrada por la secretaría.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgos H-035 (con causa raíz completa) y H-017 (primera detección, mismo bug).

## Notas para quien la reclame

- El fix en sí es trivial (2 líneas) — el valor de esta asignación es sobre todo la verificación en vivo con datos reales, ya que el bug es 100% reproducible y silencioso (nadie lo notaría sin mirar la consola).
