-- Engineering acceptance is performed by the authenticated organization member.
-- Keep all table access inside existing RLS instead of using service-role bypasses.

grant insert on table public.engineering_results to authenticated;

-- The acceptance validator reads and updates organization-scoped records. Run it
-- as the caller so existing table grants and RLS remain authoritative.
alter function public.validate_design_acceptance_gate(uuid) security invoker;
revoke all on function public.validate_design_acceptance_gate(uuid) from public, anon;
grant execute on function public.validate_design_acceptance_gate(uuid) to authenticated, service_role;
