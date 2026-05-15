create or replace view public.courier_branches_public as
select id, name, lat, lng, courier_id
from public.courier_branches
where is_active = true
  and lat is not null
  and lng is not null;

grant select on public.courier_branches_public to anon, authenticated;