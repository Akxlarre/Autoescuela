-- Migration: Add UNIQUE constraint on (enrollment_id, type) in student_documents
-- Required for upsert with ON CONFLICT(enrollment_id, type) in EnrollmentDocumentsFacade.
-- RF-082: Each enrollment can have only one document of each type.

ALTER TABLE student_documents
  DROP CONSTRAINT IF EXISTS student_documents_enrollment_type_unique;

ALTER TABLE student_documents
  ADD CONSTRAINT student_documents_enrollment_type_unique
  UNIQUE (enrollment_id, type);
