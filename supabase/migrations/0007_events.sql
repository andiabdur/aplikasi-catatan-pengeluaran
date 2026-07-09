-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add event_id to expenses table
ALTER TABLE public.expenses
ADD COLUMN event_id UUID REFERENCES public.events(id) ON DELETE SET NULL;

-- Enable RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policies for events
CREATE POLICY "Users can view events of their household" 
ON public.events FOR SELECT 
TO authenticated 
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert events in their household" 
ON public.events FOR INSERT 
TO authenticated 
WITH CHECK (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update events in their household" 
ON public.events FOR UPDATE 
TO authenticated 
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete events in their household" 
ON public.events FOR DELETE 
TO authenticated 
USING (
  household_id IN (
    SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
  )
);
