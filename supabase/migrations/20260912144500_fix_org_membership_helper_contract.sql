-- Restore the RLS helper contract without exposing a SECURITY DEFINER RPC.
-- Policies historically call public.is_org_member(uuid). Keep that stable public
-- name as a SECURITY INVOKER wrapper around the non-exposed private helper.

GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = private, pg_catalog
AS $$
  SELECT private.is_org_member(org_id);
$$;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_org_member(uuid) IS
  'RLS-safe invoker wrapper. Delegates to private.is_org_member; not executable by anon.';
