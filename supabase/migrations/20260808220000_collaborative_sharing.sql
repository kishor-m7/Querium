-- 1. Add is_shared column to public.threads
ALTER TABLE public.threads ADD COLUMN is_shared boolean NOT NULL DEFAULT false;

-- 2. Add RLS policy for select on public.threads for anyone
CREATE POLICY "Anyone can view shared threads" ON public.threads
  FOR SELECT TO public
  USING (is_shared = true);

-- 3. Add RLS policy for select on public.messages for anyone if the thread is shared
CREATE POLICY "Anyone can view messages of shared threads" ON public.messages
  FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = messages.thread_id AND t.is_shared = true
    )
  );
