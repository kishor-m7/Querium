-- Migration: Grant RPC execution permissions and configure SECURITY DEFINER for demo agent tools
-- Fixes "permission denied for function demo_get_schema" and "permission denied for function demo_run_select"

-- 1. Set SECURITY DEFINER on demo_get_schema so catalog introspection executes cleanly
ALTER FUNCTION public.demo_get_schema() SECURITY DEFINER;
ALTER FUNCTION public.demo_get_schema() SET search_path = public, demo, information_schema;

-- 2. Set SECURITY DEFINER on demo_run_select so read-only analytics queries execute cleanly
ALTER FUNCTION public.demo_run_select(text) SECURITY DEFINER;
ALTER FUNCTION public.demo_run_select(text) SET search_path = demo, public;

-- 3. Grant schema usage and table SELECT access on demo schema
GRANT USAGE ON SCHEMA demo TO authenticated, anon, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA demo TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA demo GRANT SELECT ON TABLES TO authenticated, anon, service_role;

-- 4. Grant explicit EXECUTE permissions on both agent functions
GRANT EXECUTE ON FUNCTION public.demo_get_schema() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.demo_run_select(text) TO authenticated, anon, service_role;
