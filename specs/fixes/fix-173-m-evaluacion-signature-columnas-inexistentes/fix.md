# Fix: Guardar evaluación práctica falla por columnas de firma inexistentes
> id: fix-173-m-evaluacion-signature-columnas-inexistentes
> refs: —
> status: done
> created: 2026-08-13

## Root Cause
`InstructorClasesFacade.saveEvaluation()` hace `PATCH` sobre `class_b_sessions` escribiendo
`student_signature_url` e `instructor_signature_url` — columnas que nunca existieron en el
schema. La tabla real (`supabase/migrations/20260301000003_03_academy_class_b.sql:112-113`)
solo define `student_signature` e `instructor_signature` como `BOOLEAN`. PostgREST rechaza el
`PATCH` con 400 `PGRST204` ("Could not find the 'instructor_signature_url' column"), y ninguna
evaluación con firma puede guardarse.

## ACs Afectados
Ninguno — fix autónomo (bug funcional reportado directamente por el usuario, sin spec asociada).
- AC-1: Al finalizar una Evaluación Práctica con firmas, el `PATCH` a `class_b_sessions` debe
  usar las columnas reales `student_signature`/`instructor_signature` (booleanas) y guardar
  exitosamente (sin 400/PGRST204).

## Cambio
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts`
- **Qué cambia:** En `saveEvaluation()`, reemplazar `student_signature_url` /
  `instructor_signature_url` en el payload del `.update()` por `student_signature` /
  `instructor_signature`, derivados como booleano (`!!studentSignatureUrl` /
  `!!instructorSignatureUrl`) a partir de si hubo firma capturada y subida a storage.

## Test de Regresión
- Verificación manual/visual (Playwright `/verify` o confirmación directa del usuario): iniciar
  sesión como instructor, completar una Evaluación Práctica con al menos una firma, finalizar y
  confirmar que se guarda sin error 400 y la clase queda `completed`.
- ✓ `src/app/core/facades/instructor-clases.facade.spec.ts > saveEvaluation > actualiza
  evaluación sin firmas y refresca` actualizado para esperar `student_signature`/
  `instructor_signature` (boolean) en vez de las columnas `_url` inexistentes — 22/22 tests
  verdes (`npx vitest run instructor-clases.facade.spec.ts`).
