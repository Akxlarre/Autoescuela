-- ============================================================================
-- Migration: Drop enrolled_students from promotion_courses
-- Date: 2026-03-26
-- Description: Remove redundant enrolled_students column from promotion_courses.
--   Student counts are now derived at query time from the enrollments table
--   via promotion_course_id FK, excluding cancelled/draft enrollments.
-- ============================================================================

ALTER TABLE promotion_courses DROP COLUMN IF EXISTS enrolled_students;
