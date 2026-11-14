-- Survey Pay Kenya — Complete Database Schema
-- Run this entire script in the Supabase SQL Editor:
-- https://ugfoapreveoacgdorctw.supabase.co/project/ugfoapreveoacgdorctw/sql/new

-- ─── Extensions ─────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles (one per auth user) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email               TEXT NOT NULL,
  phone               TEXT DEFAULT '0712 345 678',
  plan                TEXT DEFAULT 'Free',
  balance             NUMERIC DEFAULT 0,
  completed_surveys   INTEGER[] DEFAULT '{}',
  unlocked_survey_ids INTEGER[] DEFAULT '{}',
  daily_withdrawn     NUMERIC DEFAULT 0,
  last_withdrawal_date DATE,
  activated           BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Survey completions log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.survey_completions (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  survey_id    INTEGER NOT NULL,
  company      TEXT NOT NULL,
  earned       NUMERIC NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Withdrawal transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount               NUMERIC NOT NULL,
  phone                TEXT NOT NULL,
  status               TEXT DEFAULT 'pending',   -- pending | completed | failed
  checkout_request_id  TEXT,
  mpesa_receipt        TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Survey unlock purchases ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.unlock_purchases (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  survey_ids           INTEGER[] NOT NULL,
  amount_paid          NUMERIC NOT NULL,
  status               TEXT DEFAULT 'pending',
  checkout_request_id  TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Account upgrade purchases ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.upgrade_purchases (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_name            TEXT NOT NULL,
  amount_paid          NUMERIC NOT NULL,
  status               TEXT DEFAULT 'pending',
  checkout_request_id  TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlock_purchases   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upgrade_purchases  ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent re-run)
DROP POLICY IF EXISTS "Users view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users view own completions"   ON public.survey_completions;
DROP POLICY IF EXISTS "Users insert own completions" ON public.survey_completions;

DROP POLICY IF EXISTS "Users view own withdrawals"   ON public.withdrawals;
DROP POLICY IF EXISTS "Users insert own withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users update own withdrawals" ON public.withdrawals;

DROP POLICY IF EXISTS "Users view own unlocks"   ON public.unlock_purchases;
DROP POLICY IF EXISTS "Users insert own unlocks" ON public.unlock_purchases;

DROP POLICY IF EXISTS "Users view own upgrades"   ON public.upgrade_purchases;
DROP POLICY IF EXISTS "Users insert own upgrades" ON public.upgrade_purchases;

-- Profiles
CREATE POLICY "Users view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Survey completions
CREATE POLICY "Users view own completions"   ON public.survey_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own completions" ON public.survey_completions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Withdrawals
CREATE POLICY "Users view own withdrawals"   ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own withdrawals" ON public.withdrawals FOR UPDATE USING (auth.uid() = user_id);

-- Unlock purchases
CREATE POLICY "Users view own unlocks"   ON public.unlock_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own unlocks" ON public.unlock_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Upgrade purchases
CREATE POLICY "Users view own upgrades"   ON public.upgrade_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own upgrades" ON public.upgrade_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── Auto-create profile on user signup ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '0712 345 678')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Auto-update updated_at on profile changes ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
