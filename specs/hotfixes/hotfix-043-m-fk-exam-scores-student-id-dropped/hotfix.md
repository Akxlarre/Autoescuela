# Hotfix: FK sobre columna student_id ya eliminada bloquea replay de migraciones
> id: hotfix-043-m-fk-exam-scores-student-id-dropped
> status: done
> closed: 2026-07-24
> created: 2026-07-23

## Problema
<!-- Qué está roto o mal. Una línea clara. -->
`supabase/migrations/20260406000000_fix_exam_scores_relationship.sql` intenta agregar una FK sobre `class_b_exam_scores.student_id`, pero esa columna fue eliminada 2 días antes (en orden de timestamp) por `20260404120000_academic_alter_remove_redundant_student_id.sql`. En un replay completo de migraciones desde cero (`npx supabase start` / `supabase db reset`), Postgres falla con `ERROR: column "student_id" referenced in foreign key constraint does not exist (SQLSTATE 42703)`. No afecta bases ya migradas (remoto/producción — ahí probablemente se aplicó en un orden histórico distinto al de los timestamps actuales de los archivos).

## Cambios
<!-- Listar todos los archivos afectados. Sin límite, pero cada línea debe ser obvia. -->
- **Archivo:** `supabase/migrations/20260406000000_fix_exam_scores_relationship.sql` — el bloque que agrega `fk_class_b_exam_scores_student` ahora primero verifica que la columna `student_id` exista (`information_schema.columns`) antes de intentar el `ALTER TABLE ... ADD CONSTRAINT`. En un replay desde cero es un no-op inofensivo (la columna ya no existe); se conserva el bloque por fidelidad histórica del archivo.
