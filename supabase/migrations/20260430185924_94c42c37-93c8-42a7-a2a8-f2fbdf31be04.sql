
-- 1) Helper: map orders.city (Arabic text) -> shipments.city (shipment_city enum)
create or replace function public.map_order_city_to_shipment(_city text)
returns shipment_city
language sql
immutable
as $$
  select case
    when _city is null then 'Damascus'::shipment_city
    when _city ilike '%دمشق%' or _city ilike '%damascus%' then 'Damascus'::shipment_city
    when _city ilike '%حلب%'  or _city ilike '%aleppo%'   then 'Aleppo'::shipment_city
    when _city ilike '%حمص%'  or _city ilike '%homs%'     then 'Homs'::shipment_city
    when _city ilike '%حماة%' or _city ilike '%حماه%' or _city ilike '%hama%' then 'Hama'::shipment_city
    when _city ilike '%لاذقية%' or _city ilike '%اللاذقية%' or _city ilike '%lattakia%' or _city ilike '%latakia%' then 'Lattakia'::shipment_city
    when _city ilike '%طرطوس%' or _city ilike '%tartous%' or _city ilike '%tartus%' then 'Tartous'::shipment_city
    else 'Damascus'::shipment_city
  end;
$$;

-- 2) AFTER INSERT trigger: auto-create matching shipment for every new order
create or replace function public.create_shipment_for_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_shipment_id uuid;
  _tracking text;
  _cod numeric;
  _fee numeric;
begin
  -- Skip if shipment already linked (defensive — e.g. seed data)
  if new.shipment_id is not null then
    return new;
  end if;

  _cod := coalesce(new.final_sale_price, new.total_amount, 0);
  _fee := coalesce(new.delivery_fee, 0);
  _tracking := 'SL-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));

  insert into public.shipments (
    order_id, merchant_id, courier_id,
    receiver_name, phone_number, city, detailed_address,
    cod_amount, collection_fee, shipping_fee,
    tracking_number, status
  ) values (
    new.id, new.merchant_id, new.courier_id,
    new.receiver_name, new.phone_number,
    public.map_order_city_to_shipment(new.city),
    new.detailed_address,
    _cod, _fee, _fee,
    _tracking, 'pending'
  )
  returning id into _new_shipment_id;

  update public.orders
    set shipment_id = _new_shipment_id
    where id = new.id;

  return new;
end;
$$;

drop trigger if exists orders_create_shipment_aft_ins on public.orders;
create trigger orders_create_shipment_aft_ins
after insert on public.orders
for each row
execute function public.create_shipment_for_order();

-- 3) UPDATE trigger: keep shipment cod_amount / collection_fee in sync
create or replace function public.sync_order_to_shipment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shipment_id is null then
    return new;
  end if;

  if (new.final_sale_price is distinct from old.final_sale_price)
     or (new.total_amount is distinct from old.total_amount)
     or (new.delivery_fee is distinct from old.delivery_fee) then
    update public.shipments
      set cod_amount     = coalesce(new.final_sale_price, new.total_amount, 0),
          collection_fee = coalesce(new.delivery_fee, 0),
          shipping_fee   = coalesce(new.delivery_fee, 0),
          updated_at     = now()
      where id = new.shipment_id;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_to_shipment_aft_upd on public.orders;
create trigger orders_sync_to_shipment_aft_upd
after update on public.orders
for each row
execute function public.sync_order_to_shipment();

-- 4) Backfill existing orphan orders (the 9 currently with shipment_id IS NULL)
do $$
declare
  r record;
  _new_id uuid;
  _tracking text;
begin
  for r in
    select * from public.orders
    where shipment_id is null and deleted_at is null
  loop
    _tracking := 'SL-' || upper(substr(replace(r.id::text, '-', ''), 1, 6));

    insert into public.shipments (
      order_id, merchant_id, courier_id,
      receiver_name, phone_number, city, detailed_address,
      cod_amount, collection_fee, shipping_fee,
      tracking_number, status, created_at
    ) values (
      r.id, r.merchant_id, r.courier_id,
      r.receiver_name, r.phone_number,
      public.map_order_city_to_shipment(r.city),
      r.detailed_address,
      coalesce(r.final_sale_price, r.total_amount, 0),
      coalesce(r.delivery_fee, 0),
      coalesce(r.delivery_fee, 0),
      _tracking,
      case
        when r.status in ('delivered','returned','cancelled') then r.status
        when r.status = 'out_for_delivery' then 'out_for_delivery'
        when r.status = 'shipped' then 'in_transit_intercity'
        when r.status = 'processing' then 'at_warehouse'
        else 'pending'
      end,
      r.created_at
    )
    returning id into _new_id;

    update public.orders set shipment_id = _new_id where id = r.id;
  end loop;
end $$;
