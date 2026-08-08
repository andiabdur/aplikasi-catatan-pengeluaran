-- ============================================================
-- Chat Sessions, Chat Messages, and AI Long-Term Memory
-- ============================================================

-- 1. Chat Sessions Table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Percakapan Baru',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_household_idx ON public.chat_sessions(household_id, updated_at DESC);

-- 2. Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  saved_expenses JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON public.chat_messages(session_id, created_at ASC);

-- 3. AI Memories Table (Long-term memory across sessions)
CREATE TABLE IF NOT EXISTS public.ai_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_memories_household_idx ON public.ai_memories(household_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

-- Policies for chat_sessions
CREATE POLICY "Users can view chat sessions of their household"
ON public.chat_sessions FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert chat sessions in their household"
ON public.chat_sessions FOR INSERT
TO authenticated
WITH CHECK (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update chat sessions in their household"
ON public.chat_sessions FOR UPDATE
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete chat sessions in their household"
ON public.chat_sessions FOR DELETE
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

-- Policies for chat_messages
CREATE POLICY "Users can view chat messages of their household sessions"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
  session_id IN (
    SELECT cs.id FROM public.chat_sessions cs
    JOIN public.household_members hm ON hm.household_id = cs.household_id
    WHERE hm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert chat messages in their household sessions"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  session_id IN (
    SELECT cs.id FROM public.chat_sessions cs
    JOIN public.household_members hm ON hm.household_id = cs.household_id
    WHERE hm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete chat messages of their household sessions"
ON public.chat_messages FOR DELETE
TO authenticated
USING (
  session_id IN (
    SELECT cs.id FROM public.chat_sessions cs
    JOIN public.household_members hm ON hm.household_id = cs.household_id
    WHERE hm.user_id = auth.uid()
  )
);

-- Policies for ai_memories
CREATE POLICY "Users can view AI memories of their household"
ON public.ai_memories FOR SELECT
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert AI memories in their household"
ON public.ai_memories FOR INSERT
TO authenticated
WITH CHECK (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update AI memories in their household"
ON public.ai_memories FOR UPDATE
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete AI memories in their household"
ON public.ai_memories FOR DELETE
TO authenticated
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);
