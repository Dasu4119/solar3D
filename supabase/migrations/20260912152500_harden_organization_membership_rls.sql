-- Prevent authenticated users from self-joining arbitrary organizations.
-- Organization provisioning/onboarding must create the initial membership through
-- a trusted backend/service-role path; subsequent membership changes are admin-only.

drop policy if exists org_members_manage on public.organization_members;

drop policy if exists org_members_select on public.organization_members;
create policy org_members_select
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or private.is_org_admin(organization_id)
);

drop policy if exists org_members_insert_admin_only on public.organization_members;
create policy org_members_insert_admin_only
on public.organization_members
for insert
to authenticated
with check (private.is_org_admin(organization_id));

drop policy if exists org_members_update_admin_only on public.organization_members;
create policy org_members_update_admin_only
on public.organization_members
for update
to authenticated
using (private.is_org_admin(organization_id))
with check (private.is_org_admin(organization_id));

drop policy if exists org_members_delete_admin_or_self on public.organization_members;
create policy org_members_delete_admin_or_self
on public.organization_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or private.is_org_admin(organization_id)
);
