-- Fix relationship between class_b_exam_scores and students/enrollments
-- This ensures the foreign keys exist even if the table was created by a previous incomplete migration.

DO $$
BEGIN
    -- Fix student_id FK
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'class_b_exam_scores' 
        AND constraint_name = 'fk_class_b_exam_scores_student'
    ) THEN
        ALTER TABLE class_b_exam_scores 
        ADD CONSTRAINT fk_class_b_exam_scores_student 
        FOREIGN KEY (student_id) REFERENCES students(id);
    END IF;

    -- Fix enrollment_id FK
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'class_b_exam_scores' 
        AND constraint_name = 'fk_class_b_exam_scores_enrollment'
    ) THEN
        ALTER TABLE class_b_exam_scores 
        ADD CONSTRAINT fk_class_b_exam_scores_enrollment 
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id);
    END IF;
END $$;

COMMENT ON CONSTRAINT fk_class_b_exam_scores_student ON class_b_exam_scores IS 'Relación explícita con alumnos para reportes de ensayos teóricos';
COMMENT ON CONSTRAINT fk_class_b_exam_scores_enrollment ON class_b_exam_scores IS 'Relación explícita con matrículas para reportes de ensayos teóricos';
