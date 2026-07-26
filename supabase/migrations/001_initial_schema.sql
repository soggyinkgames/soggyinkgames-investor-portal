-- ============================================================
-- Soggy Ink Games — Investor Portal Database Schema
-- Migration: 001_initial_schema.sql
--
-- Run this in your Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste & run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- investors: core table for all investor accounts
CREATE TABLE IF NOT EXISTS public.investors (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  --todo: ian 2 security added
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'prospective'
                CHECK (role IN ('prospective', 'invested')),
  approved    BOOLEAN NOT NULL DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'archived', 'revoked')), -- 👈 ADDED HERE
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.investors IS 'Investor accounts. Role and approval are set manually by the founder.';
COMMENT ON COLUMN public.investors.approved IS 'Must be true before investor can access gated content.';
COMMENT ON COLUMN public.investors.role IS 'prospective = pitch deck + milestones; invested = everything including legal + results.';
COMMENT ON COLUMN public.investors.status IS 'Soft-delete status: active, archived, or revoked.';

-- documents: pitch decks, legal docs, research, team bios
CREATE TABLE IF NOT EXISTS public.documents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'prospective'
                 CHECK (access_level IN ('prospective', 'invested')),
  category     TEXT NOT NULL DEFAULT 'deck'
                 CHECK (category IN ('deck', 'legal', 'research', 'team')),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.documents IS 'Documents served via short-lived signed URLs. file_url is the Supabase Storage path.';

-- milestones: company progress timeline
CREATE TABLE IF NOT EXISTS public.milestones (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date        DATE NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'prospective'
                CHECK (visibility IN ('prospective', 'invested')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.milestones IS 'Company milestones shown on the timeline. All prospective+ by default.';

-- events: investor engagement tracking
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL
                CHECK (event_type IN ('login', 'page_view', 'document_view')),
  target      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.events IS 'Investor engagement log. Powers the admin dashboard and interaction history.';

-- team_members: team bios shown to prospective+ investors
CREATE TABLE IF NOT EXISTS public.team_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  bio         TEXT NOT NULL DEFAULT '',
  photo_url   TEXT,
  linkedin_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.team_members IS 'Team member profiles shown on the /team page.';

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_investors_email ON public.investors(email);
CREATE INDEX IF NOT EXISTS idx_investors_role ON public.investors(role);
CREATE INDEX IF NOT EXISTS idx_investors_status ON public.investors(status);
CREATE INDEX IF NOT EXISTS idx_documents_access_level ON public.documents(access_level);
CREATE INDEX IF NOT EXISTS idx_documents_category ON public.documents(category);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON public.milestones(date DESC);
CREATE INDEX IF NOT EXISTS idx_events_investor_id ON public.events(investor_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON public.events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);


--todo: ian 3 security added
-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Helper function: bypasses RLS on public.investors to safely check approval/role.
-- SECURITY DEFINER allows it to read public.investors even if the caller's RLS would normally block it
CREATE OR REPLACE FUNCTION public.is_approved_investor(required_role TEXT DEFAULT 'prospective')
RETURNS BOOLEAN 
LANGUAGE plpgsql 
SECURITY DEFINER 
-- 🔒 HARD-SECURITY FIX: Prevents search path hijacking
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.investors
    WHERE id = auth.uid()
      AND approved = TRUE
      AND status = 'active' -- 🔒 SOFT DELETE FIX: Rejects archived/revoked accounts
      AND (
        required_role = 'prospective' 
        OR role = 'invested'
      )
  );
END;
$$;
--todo: ian 3 security added

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- 
-- IMPORTANT: RLS is the last line of defence.
-- The application layer (middleware) also enforces role checks,
-- but RLS ensures the database itself rejects unauthorised queries
-- even if application code has a bug.
--
-- Pattern: anon key can only read their own investor row.
-- Service role key (server-side only) has full access.

ALTER TABLE public.investors    ENABLE ROW LEVEL SECURITY; 
ALTER TABLE public.documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "investors_self_read"       ON public.investors;
DROP POLICY IF EXISTS "investors_self_insert"     ON public.investors;
DROP POLICY IF EXISTS "documents_prospective_read" ON public.documents;
DROP POLICY IF EXISTS "documents_invested_read"   ON public.documents;
DROP POLICY IF EXISTS "milestones_prospective_read" ON public.milestones;
DROP POLICY IF EXISTS "events_self_insert"        ON public.events;
DROP POLICY IF EXISTS "events_self_read"          ON public.events;
DROP POLICY IF EXISTS "team_members_read"         ON public.team_members;

-- 1. INVESTORS POLICIES
-- investors: each investor can only read/update their own row
CREATE POLICY "investors_self_read" ON public.investors
  FOR SELECT
  USING (
    auth.uid() = id
    AND status = 'active'
    ); --todo: ian 2 security added

-- investors: allow insert for new access requests (unapproved)
-- Note: the application layer validates the data before inserting
CREATE POLICY "investors_self_insert" ON public.investors
  FOR INSERT
  WITH CHECK (
    auth.uid() = id
    AND approved = FALSE 
    AND role = 'prospective'
  ); --todo:ian 1 security added


-- 2. DOCUMENTS (Prospective) prospective investors can read prospective-level docs
CREATE POLICY "documents_prospective_read" ON public.documents
  FOR SELECT
  USING (
    access_level = 'prospective'
    AND (SELECT public.is_approved_investor('prospective'))
  );

-- 2. DOCUMENTS (Invested) invested investors can read all docs
CREATE POLICY "documents_invested_read" ON public.documents
  FOR SELECT
  USING (
    access_level = 'invested'
    AND (SELECT public.is_approved_investor('invested'))
  );

-- 3. MILESTONES approved investors can read milestones
CREATE POLICY "milestones_prospective_read" ON public.milestones
  FOR SELECT
  USING (
    (SELECT public.is_approved_investor('prospective'))
  );

-- 4. EVENTS: investors can insert their own events
CREATE POLICY "events_self_insert" ON public.events
  FOR INSERT
  WITH CHECK (
    (SELECT public.is_approved_investor('prospective')) --todo: ian 3 security added
    AND investor_id = auth.uid()
  );

-- 4. events: investors can read their own events
CREATE POLICY "events_self_read" ON public.events
  FOR SELECT
  USING (
    (SELECT public.is_approved_investor('prospective')) --todo: ian 3 security added
    AND investor_id = auth.uid()
  );

-- 5. TEAM MEMBERS
CREATE POLICY "team_members_read" ON public.team_members
  FOR SELECT
  USING (
    (SELECT public.is_approved_investor('prospective'))
  );

-- ============================================================
-- 6. TABLE PERMISSIONS (GRANTS)
-- ============================================================

-- Service role (Admin/Backend) full access
GRANT ALL ON public.investors    TO service_role;
GRANT ALL ON public.documents    TO service_role;
GRANT ALL ON public.milestones   TO service_role;
GRANT ALL ON public.events       TO service_role;
GRANT ALL ON public.team_members TO service_role;

-- Authenticated (Logged-in Users) coarse access
GRANT SELECT, INSERT ON public.investors    TO authenticated;
GRANT SELECT         ON public.documents    TO authenticated;
GRANT SELECT         ON public.milestones   TO authenticated;
GRANT SELECT, INSERT ON public.events       TO authenticated;
GRANT SELECT         ON public.team_members TO authenticated;

-- Sequences access for auto-increments
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

-- ============================================================
-- SUPABASE STORAGE BUCKET
-- ============================================================
-- Run this separately in the Supabase dashboard if needed,
-- or via the Storage section.
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('investor-documents', 'investor-documents', FALSE);
--
-- Storage RLS is handled separately. Documents are served via
-- short-lived signed URLs generated server-side, never public links.

-- ============================================================
-- SAMPLE DATA (remove before production)
-- ============================================================

-- INSERT INTO public.milestones (title, description, date, visibility) VALUES
--   ('Company incorporated', 'Soggy Ink Games Pty Ltd registered in Australia.', '2022-01-15', 'prospective'),
--   ('First playable prototype', 'Core gameplay loop complete and internally tested.', '2022-06-01', 'prospective'),
--   ('Pre-order campaign launched', 'Gumroad pre-order page live with initial traction.', '2023-03-01', 'prospective');
