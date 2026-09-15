-- ==============================================================================
-- REFER-TOIRE SUPABASE SCHEMA
-- Project ID: ctfxbeltcmmsvagecvyr
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ctfxbeltcmmsvagecvyr/sql
-- ==============================================================================

-- 1. Create instances table (Choir groups)
CREATE TABLE IF NOT EXISTS public.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  director TEXT NOT NULL,
  subtitle TEXT,
  season_name TEXT,
  admin_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- 2. Create scores table (Sheet music catalog)
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_code TEXT NOT NULL REFERENCES public.instances(code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  composer TEXT DEFAULT 'Choral',
  arranger TEXT,
  voicing TEXT DEFAULT 'SATB',
  season TEXT DEFAULT 'General',
  key_signature TEXT,
  tempo TEXT,
  duration TEXT DEFAULT '3:00',
  page_count INT DEFAULT 2,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes for instant code and score lookup
CREATE INDEX IF NOT EXISTS idx_instances_code ON public.instances(code);
CREATE INDEX IF NOT EXISTS idx_scores_instance_code ON public.scores(instance_code);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- 5. Access Policies for instances
CREATE POLICY "Allow public read instances" ON public.instances
  FOR SELECT USING (true);

CREATE POLICY "Allow insert instances" ON public.instances
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update instances" ON public.instances
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete instances" ON public.instances
  FOR DELETE USING (true);

-- 6. Access Policies for scores
CREATE POLICY "Allow public read scores" ON public.scores
  FOR SELECT USING (true);

CREATE POLICY "Allow insert scores" ON public.scores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update scores" ON public.scores
  FOR UPDATE USING (true);

CREATE POLICY "Allow delete scores" ON public.scores
  FOR DELETE USING (true);

-- 7. Storage Bucket for PDF sheet music
INSERT INTO storage.buckets (id, name, public) 
VALUES ('scores', 'scores', true)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage bucket access policies
CREATE POLICY "Allow public score read" ON storage.objects
  FOR SELECT USING (bucket_id = 'scores');

CREATE POLICY "Allow score upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'scores');

CREATE POLICY "Allow score update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'scores');

CREATE POLICY "Allow score delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'scores');
