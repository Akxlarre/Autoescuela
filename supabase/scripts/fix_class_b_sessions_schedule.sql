-- ============================================================================
-- Script: Ajuste de horarios de class_b_sessions existentes al nuevo calendario
-- ============================================================================
-- Ejecutar DESPUÉS de la migración 20260513000001_class_b_schedule_exact_slots.sql
--
-- Qué hace:
--   Para CADA clase (sin importar si está completada, pendiente, reservada, etc.):
--   1. Reemplaza scheduled_at por el inicio del slot más cercano a la hora
--      que tenía originalmente (misma fecha, hora ajustada).
--   2. Si start_time NO era NULL: lo reemplaza por el inicio del slot más cercano.
--      Si end_time   NO era NULL: lo reemplaza por el fin del mismo slot cercano.
--
-- Nuevos slots (hora local America/Santiago, L-V):
--   08:30-09:15 | 09:20-10:05 | 10:10-10:55 | 11:00-11:45 | 11:50-12:35
--   12:40-13:25 | 15:00-15:45 | 15:50-16:35 | 16:40-17:25 | 17:30-18:15
--   18:20-19:05 | 19:10-19:55 | 20:00-20:45
--
-- Criterio de "más cercano": mínimo de |hora_original - slot_start| en segundos.
-- En caso de empate exacto se toma el primer slot (el de menor hora).
--
-- IMPORTANTE: este script es idempotente en el sentido de que volver a correrlo
-- sobre sesiones ya ajustadas deja los mismos valores (cada slot ya coincide con
-- uno de los nuevos slots, cuya distancia es 0).
-- ============================================================================

DO $$
BEGIN

  -- ── Tabla temporal con pares (inicio, fin) de cada slot ──────────────────
  CREATE TEMP TABLE _slots (
    slot_start TIME NOT NULL,
    slot_end   TIME NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _slots (slot_start, slot_end) VALUES
    ('08:30'::TIME, '09:15'::TIME),
    ('09:20'::TIME, '10:05'::TIME),
    ('10:10'::TIME, '10:55'::TIME),
    ('11:00'::TIME, '11:45'::TIME),
    ('11:50'::TIME, '12:35'::TIME),
    ('12:40'::TIME, '13:25'::TIME),
    ('15:00'::TIME, '15:45'::TIME),
    ('15:50'::TIME, '16:35'::TIME),
    ('16:40'::TIME, '17:25'::TIME),
    ('17:30'::TIME, '18:15'::TIME),
    ('18:20'::TIME, '19:05'::TIME),
    ('19:10'::TIME, '19:55'::TIME),
    ('20:00'::TIME, '20:45'::TIME);

  -- ── Función auxiliar interna: slot más cercano a una TIME dada ────────────
  -- Se usa como subconsulta correlacionada en el UPDATE a continuación.

  -- ── UPDATE principal ──────────────────────────────────────────────────────
  -- CTE con el slot más cercano para cada sesión según:
  --   a) scheduled_at  → determina la nueva scheduled_at (misma fecha, nueva hora)
  --   b) start_time    → determina start_time y end_time nuevos (solo si no era NULL)
  WITH resolved AS (
    SELECT
      s.id,

      -- Fecha local de la sesión en Santiago (truncada al día)
      date_trunc('day', s.scheduled_at AT TIME ZONE 'America/Santiago')
        AS local_day,

      -- Hora local actual de scheduled_at
      (s.scheduled_at AT TIME ZONE 'America/Santiago')::TIME
        AS scheduled_time,

      -- Slot más cercano a la hora de scheduled_at
      (
        SELECT sl.slot_start
        FROM _slots sl
        ORDER BY ABS(
          EXTRACT(EPOCH FROM (
            (s.scheduled_at AT TIME ZONE 'America/Santiago')::TIME - sl.slot_start
          ))
        )
        LIMIT 1
      ) AS new_scheduled_slot_start,

      -- Slot más cercano a start_time (solo relevante cuando start_time IS NOT NULL)
      CASE WHEN s.start_time IS NOT NULL
        THEN (
          SELECT sl.slot_start
          FROM _slots sl
          ORDER BY ABS(EXTRACT(EPOCH FROM (s.start_time - sl.slot_start)))
          LIMIT 1
        )
        ELSE NULL
      END AS new_start_time,

      CASE WHEN s.start_time IS NOT NULL
        THEN (
          SELECT sl.slot_end
          FROM _slots sl
          ORDER BY ABS(EXTRACT(EPOCH FROM (s.start_time - sl.slot_start)))
          LIMIT 1
        )
        ELSE NULL
      END AS new_end_time

    FROM class_b_sessions s
  )
  UPDATE class_b_sessions s
  SET
    -- Reconstruir scheduled_at: misma fecha local + nuevo inicio de slot → UTC
    scheduled_at = (r.local_day + r.new_scheduled_slot_start)
                   AT TIME ZONE 'America/Santiago',

    -- start_time y end_time: solo si no eran NULL
    start_time   = r.new_start_time,
    end_time     = r.new_end_time

  FROM resolved r
  WHERE s.id = r.id;

  RAISE NOTICE 'class_b_sessions procesadas: %', (SELECT COUNT(*) FROM class_b_sessions);
  RAISE NOTICE 'Sesiones con start_time ajustado: %',
    (SELECT COUNT(*) FROM class_b_sessions WHERE start_time IS NOT NULL);

END;
$$;
