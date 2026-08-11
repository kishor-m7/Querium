CREATE TABLE public.query_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL,
  purpose text,
  sql text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  error text,
  is_favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.query_history TO authenticated;
GRANT ALL ON public.query_history TO service_role;
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own query history"
  ON public.query_history FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX query_history_user_created_idx ON public.query_history (user_id, created_at DESC);

CREATE TABLE public.dashboard_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL,
  kind text NOT NULL,
  title text NOT NULL DEFAULT 'Untitled tile',
  payload jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_tiles TO authenticated;
GRANT ALL ON public.dashboard_tiles TO service_role;
ALTER TABLE public.dashboard_tiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own dashboard tiles"
  ON public.dashboard_tiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX dashboard_tiles_user_position_idx ON public.dashboard_tiles (user_id, position);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_query_history_updated_at BEFORE UPDATE ON public.query_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_dashboard_tiles_updated_at BEFORE UPDATE ON public.dashboard_tiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();