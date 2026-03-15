-- Enable Supabase Realtime on class_b_sessions table.
-- This allows authenticated users (secretary/admin) to receive live updates
-- when slots are booked by other users during enrollment.
-- RLS policies already grant SELECT to secretary/admin roles,
-- so realtime events will flow correctly to authorized users.

ALTER PUBLICATION supabase_realtime ADD TABLE class_b_sessions;
