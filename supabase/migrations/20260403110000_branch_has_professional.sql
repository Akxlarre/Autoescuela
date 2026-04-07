-- Migration: branch_has_professional
-- Marks which branches offer Clase Profesional courses.
-- Branch 1 (Autoescuela Chillán): Clase B only → has_professional = false
-- Branch 2 (Conductores Chillán): Clase B + Profesional → has_professional = true

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS has_professional BOOLEAN NOT NULL DEFAULT false;

UPDATE branches SET has_professional = true WHERE id = 2;
