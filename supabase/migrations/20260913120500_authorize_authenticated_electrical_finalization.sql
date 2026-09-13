-- Finalization builds electrical strings as the authenticated project user.
-- Keep organization isolation in RLS; do not bypass it with a service-role client.

grant insert, update, delete on table public.electrical_strings to authenticated;

-- This validator originally ran SECURITY DEFINER and was intentionally hidden
-- from authenticated callers. The release finalization path needs to invoke it,
-- so make it SECURITY INVOKER before granting EXECUTE. All reads/writes then
-- remain subject to the caller's table grants and RLS policies.
alter function public.validate_electrical_topology(uuid) security invoker;
revoke all on function public.validate_electrical_topology(uuid) from public, anon;
grant execute on function public.validate_electrical_topology(uuid) to authenticated, service_role;
