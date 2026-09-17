-- ==============================================================================
-- REFERTOIRE SUPABASE SCHEMA & MULTI-DEVICE CLOUD SYNC MIGRATION
-- Project ID: ctfxbeltcmmsvagecvyr
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ctfxbeltcmmsvagecvyr/sql
-- ==============================================================================

-- 1. Create profiles table (Links with Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  voice_part TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create instances table (Choir groups & ensemble codes)
CREATE TABLE IF NOT EXISTS public.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  director TEXT NOT NULL,
  subtitle TEXT,
  season_name TEXT,
  creator_id UUID,
  admin_key TEXT,
  setlists JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on instances (Migration safety)
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS subtitle TEXT;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS season_name TEXT;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS creator_id UUID;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS admin_key TEXT;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS setlists JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.instances ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ DEFAULT now();

-- 3. Create ensemble_members table (Multi-device account membership & roles)
CREATE TABLE IF NOT EXISTS public.ensemble_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_code TEXT NOT NULL REFERENCES public.instances(code) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  voice_part TEXT DEFAULT 'General',
  joined_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_member_per_ensemble UNIQUE (instance_code, user_id)
);

-- 4. Create scores table (Sheet music catalog)
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_code TEXT NOT NULL REFERENCES public.instances(code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  composer TEXT DEFAULT 'Choral',
  arranger TEXT,
  voicing TEXT DEFAULT 'SATB',
  genre TEXT DEFAULT 'General',
  season TEXT DEFAULT 'General',
  key_signature TEXT,
  tempo TEXT,
  duration TEXT DEFAULT '3:00',
  page_count INT DEFAULT 2,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure all columns exist on scores (Migration safety)
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS arranger TEXT;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS voicing TEXT DEFAULT 'SATB';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS genre TEXT DEFAULT 'General';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS season TEXT DEFAULT 'General';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS key_signature TEXT;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS tempo TEXT;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '3:00';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS page_count INT DEFAULT 2;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT 0;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.scores ADD COLUMN IF NOT EXISTS uploaded_by UUID;

-- 5. Indexes for high-speed cross-device queries
CREATE INDEX IF NOT EXISTS idx_instances_code ON public.instances(code);
CREATE INDEX IF NOT EXISTS idx_scores_instance_code ON public.scores(instance_code);
CREATE INDEX IF NOT EXISTS idx_ensemble_members_code ON public.ensemble_members(instance_code);
CREATE INDEX IF NOT EXISTS idx_ensemble_members_user ON public.ensemble_members(user_id);

-- 6. Automatically sync Supabase Auth users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, voice_part)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'voice_part', 'General')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    voice_part = EXCLUDED.voice_part,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ensemble_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- 8. Permissive RLS Policies for Refertoire App Clients
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
CREATE POLICY "Allow public update profiles" ON public.profiles FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public read instances" ON public.instances;
CREATE POLICY "Allow public read instances" ON public.instances FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert instances" ON public.instances;
CREATE POLICY "Allow insert instances" ON public.instances FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update instances" ON public.instances;
CREATE POLICY "Allow update instances" ON public.instances FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete instances" ON public.instances;
CREATE POLICY "Allow delete instances" ON public.instances FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read ensemble_members" ON public.ensemble_members;
CREATE POLICY "Allow public read ensemble_members" ON public.ensemble_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert ensemble_members" ON public.ensemble_members;
CREATE POLICY "Allow insert ensemble_members" ON public.ensemble_members FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update ensemble_members" ON public.ensemble_members;
CREATE POLICY "Allow update ensemble_members" ON public.ensemble_members FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete ensemble_members" ON public.ensemble_members;
CREATE POLICY "Allow delete ensemble_members" ON public.ensemble_members FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read scores" ON public.scores;
CREATE POLICY "Allow public read scores" ON public.scores FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert scores" ON public.scores;
CREATE POLICY "Allow insert scores" ON public.scores FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update scores" ON public.scores;
CREATE POLICY "Allow update scores" ON public.scores FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete scores" ON public.scores;
CREATE POLICY "Allow delete scores" ON public.scores FOR DELETE USING (true);

-- 9. Storage Bucket for PDF sheet music
INSERT INTO storage.buckets (id, name, public) 
VALUES ('scores', 'scores', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public score read" ON storage.objects;
CREATE POLICY "Allow public score read" ON storage.objects
  FOR SELECT USING (bucket_id = 'scores');

DROP POLICY IF EXISTS "Allow score upload" ON storage.objects;
CREATE POLICY "Allow score upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'scores');

DROP POLICY IF EXISTS "Allow score update" ON storage.objects;
CREATE POLICY "Allow score update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'scores');

DROP POLICY IF EXISTS "Allow score delete" ON storage.objects;
CREATE POLICY "Allow score delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'scores');

-- 10. App Releases & Auto-Update Table
CREATE TABLE IF NOT EXISTS public.app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  build_number INT NOT NULL,
  release_notes TEXT,
  apk_url TEXT,
  file_size BIGINT DEFAULT 0,
  is_mandatory BOOLEAN DEFAULT false,
  min_supported_version TEXT,
  published_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read app_releases" ON public.app_releases;
CREATE POLICY "Allow public read app_releases" ON public.app_releases FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin insert app_releases" ON public.app_releases;
CREATE POLICY "Allow admin insert app_releases" ON public.app_releases FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin update app_releases" ON public.app_releases;
CREATE POLICY "Allow admin update app_releases" ON public.app_releases FOR UPDATE USING (true);

