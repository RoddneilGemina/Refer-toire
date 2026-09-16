-- ==============================================================================
-- REFER-TOIRE SUPABASE SCHEMA
-- Project ID: ctfxbeltcmmsvagecvyr
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/ctfxbeltcmmsvagecvyr/sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. CLEAN SLATE PURGE (Clears all previous test groups, scores, and storage)
-- ------------------------------------------------------------------------------
-- Uncomment to execute a fresh clean slate in Supabase SQL Editor:
-- DELETE FROM public.scores;
-- DELETE FROM public.instances;
-- DELETE FROM storage.objects WHERE bucket_id = 'scores';

-- 1. Create profiles table (links to Supabase Auth auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  voice_part TEXT DEFAULT 'General',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create instances table (Choir groups)
CREATE TABLE IF NOT EXISTS public.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  director TEXT NOT NULL,
  subtitle TEXT,
  season_name TEXT,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- 3. Create ensemble_members table (tracks who joins an ensemble with roles)
CREATE TABLE IF NOT EXISTS public.ensemble_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_code TEXT NOT NULL REFERENCES public.instances(code) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  voice_part TEXT,
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
  season TEXT DEFAULT 'General',
  key_signature TEXT,
  tempo TEXT,
  duration TEXT DEFAULT '3:00',
  page_count INT DEFAULT 2,
  file_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Indexes for instant lookup and sorting
CREATE INDEX IF NOT EXISTS idx_instances_code ON public.instances(code);
CREATE INDEX IF NOT EXISTS idx_scores_instance_code ON public.scores(instance_code);
CREATE INDEX IF NOT EXISTS idx_ensemble_members_code ON public.ensemble_members(instance_code);
CREATE INDEX IF NOT EXISTS idx_ensemble_members_user ON public.ensemble_members(user_id);

-- 6. Automatically sync auth.users into public.profiles
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

-- 8. Access Policies for profiles
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update own profile" ON public.profiles FOR UPDATE USING (true);

-- 9. Access Policies for instances
CREATE POLICY "Allow public read instances" ON public.instances FOR SELECT USING (true);
CREATE POLICY "Allow insert instances" ON public.instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update instances" ON public.instances FOR UPDATE USING (true);
CREATE POLICY "Allow delete instances" ON public.instances FOR DELETE USING (true);

-- 10. Access Policies for ensemble_members
CREATE POLICY "Allow public read ensemble_members" ON public.ensemble_members FOR SELECT USING (true);
CREATE POLICY "Allow insert ensemble_members" ON public.ensemble_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update ensemble_members" ON public.ensemble_members FOR UPDATE USING (true);
CREATE POLICY "Allow delete ensemble_members" ON public.ensemble_members FOR DELETE USING (true);

-- 11. Access Policies for scores
CREATE POLICY "Allow public read scores" ON public.scores FOR SELECT USING (true);
CREATE POLICY "Allow insert scores" ON public.scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update scores" ON public.scores FOR UPDATE USING (true);
CREATE POLICY "Allow delete scores" ON public.scores FOR DELETE USING (true);

-- 12. Storage Bucket for PDF sheet music
INSERT INTO storage.buckets (id, name, public) 
VALUES ('scores', 'scores', true)
ON CONFLICT (id) DO NOTHING;

-- 13. Storage bucket access policies
CREATE POLICY "Allow public score read" ON storage.objects
  FOR SELECT USING (bucket_id = 'scores');

CREATE POLICY "Allow score upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'scores');

CREATE POLICY "Allow score update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'scores');

CREATE POLICY "Allow score delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'scores');
