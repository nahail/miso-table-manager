-- ==========================================================
-- MISO RESTAURANT - SUPABASE DATABASE SETUP & REALTIME SYNC
-- ==========================================================
-- Copy and run this script in your Supabase Project's SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Create the 'tables' table
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    floor INTEGER NOT NULL CHECK (floor >= 1 AND floor <= 10),
    seats INTEGER NOT NULL DEFAULT 4 CHECK (seats > 0),
    is_occupied BOOLEAN NOT NULL DEFAULT false,
    seated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- 3. Create open access policies for staff devices (using Supabase Anon Key)
DROP POLICY IF EXISTS "Allow public read access" ON public.tables;
CREATE POLICY "Allow public read access" ON public.tables
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON public.tables;
CREATE POLICY "Allow public insert access" ON public.tables
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access" ON public.tables;
CREATE POLICY "Allow public update access" ON public.tables
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access" ON public.tables;
CREATE POLICY "Allow public delete access" ON public.tables
    FOR DELETE USING (true);

-- 4. Enable Supabase Realtime for this table
-- This allows instant multi-device syncing across receptionist & floor waiters!
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;

-- 5. Seed initial tables for all 5 floors (5 tables per floor = 25 initial tables)
INSERT INTO public.tables (name, floor, seats, is_occupied) VALUES
-- Floor 1
('Table 101', 1, 2, false),
('Table 102', 1, 4, false),
('Table 103', 1, 4, false),
('Table 104', 1, 6, false),
('Table 105', 1, 8, false),

-- Floor 2
('Table 201', 2, 2, false),
('Table 202', 2, 4, false),
('Table 203', 2, 4, false),
('Table 204', 2, 6, false),
('Table 205', 2, 6, false),

-- Floor 3
('Table 301', 3, 2, false),
('Table 302', 3, 4, false),
('Table 303', 3, 4, false),
('Table 304', 3, 4, false),
('Table 305', 3, 8, false),

-- Floor 4
('Table 401', 4, 2, false),
('Table 402', 4, 4, false),
('Table 403', 4, 4, false),
('Table 404', 4, 6, false),
('Table 405', 4, 10, false),

-- Floor 5 (Rooftop / Penthouse)
('Table 501', 5, 2, false),
('Table 502', 5, 4, false),
('Table 503', 5, 4, false),
('Table 504', 5, 6, false),
('Table 505', 5, 8, false)
ON CONFLICT DO NOTHING;
