-- Migration: drop region and district columns from students
-- The address field is sufficient; region/district were causing incorrect
-- contract output (numeric region code + hardcoded city "chillan").

ALTER TABLE students
  DROP COLUMN IF EXISTS region,
  DROP COLUMN IF EXISTS district;
