# Fix: Portal Alumno nunca muestra la nota del Examen Final
> id: fix-059-b-nota-examen-final
> refs: ASG-b-017 (specs/assignments/ASG-b-017-fix-h035-h017-nota-examen-final.md)
> status: done
> closed: 2026-07-28
> created: 2026-07-28

## Root Cause
**[Heredado de ASG-b-017, a confirmar]:** Mismo bug encontrado 2 veces en iteraciones distintas
del audit (H-017 en Fase 1, H-035 con causa raíz confirmada en Fase 3). Consola muestra `400`
permanente: `GET .../class_b_exam_scores?select=grade,created_at&enrollment_id=eq.90`.
`student-home.facade.ts:174` pide la columna `grade`, pero la tabla
(`20260301000003_03_academy_class_b.sql:182-191`) define la columna como `score`. PostgREST
rechaza la query completa, y el fallback silencioso muestra "Pendiente"/"Sin calificación aún"
**incluso si la secretaría ya registró una nota real**.

## ACs Afectados
Ninguno — fix autónomo (bug real detectado en Auditoría QA de Flujos, hallazgos H-017/H-035).

## Cambio
- `src/app/core/facades/student-home.facade.ts:174` — `.select('grade, created_at')` →
  `.select('score, created_at')` en la query a `class_b_exam_scores`.
- `src/app/core/facades/student-home.facade.ts:265` — `examResult.data?.grade` →
  `examResult.data?.score`.

## Test de Regresión
- `src/app/core/facades/student-home.facade.spec.ts` — nuevo caso: mock de
  `class_b_exam_scores` devolviendo `{ score: 85, created_at: ... }`, verifica que
  `facade.grades()?.finalExamGrade` sea `85` (no `null`), reproduciendo el escenario real de
  H-035/H-017 donde una nota registrada quedaba invisible por el nombre de columna incorrecto.

## Notas
- Asignación original ASG-b-017 marcaba el valor principal de esta tarea como la verificación en
  vivo (bug 100% reproducible y silencioso). Se agrega también test unitario de regresión
  porque `core/facades/` es capa obligatoria de tests (`.claude/rules/testing-tdd.md`).
