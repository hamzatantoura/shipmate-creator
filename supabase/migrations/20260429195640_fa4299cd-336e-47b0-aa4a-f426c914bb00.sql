CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _kpis        jsonb;
  _trend       jsonb;
  _couriers    jsonb;
  _start_date  date := (CURRENT_DATE - INTERVAL '29 days')::date;
BEGIN
  -- Strict admin gate
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'غير مصرّح' USING ERRCODE = '42501';
  END IF;

  ----------------------------------------------------------------
  -- 1) Global KPIs
  ----------------------------------------------------------------
  SELECT jsonb_build_object(
    'total_orders',          COUNT(*),
    'total_delivered',       COUNT(*) FILTER (WHERE status = 'delivered'),
    'total_returned',        COUNT(*) FILTER (WHERE status = 'returned'),
    'total_platform_revenue',
        COALESCE(SUM(platform_fee) FILTER (WHERE status = 'delivered'), 0)
  )
  INTO _kpis
  FROM public.orders
  WHERE deleted_at IS NULL;

  ----------------------------------------------------------------
  -- 2) 30-day trend (orders/day + delivered revenue/day)
  --    Includes empty days for a continuous chart.
  ----------------------------------------------------------------
  WITH days AS (
    SELECT generate_series(_start_date, CURRENT_DATE, '1 day'::interval)::date AS day
  ),
  agg AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS day,
      COUNT(*)                                                      AS order_count,
      COALESCE(SUM(platform_fee) FILTER (WHERE status='delivered'),0) AS revenue,
      COUNT(*) FILTER (WHERE status='delivered')                    AS delivered_count
    FROM public.orders
    WHERE deleted_at IS NULL
      AND created_at >= _start_date
    GROUP BY 1
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day',             to_char(d.day, 'YYYY-MM-DD'),
    'order_count',     COALESCE(a.order_count, 0),
    'delivered_count', COALESCE(a.delivered_count, 0),
    'revenue',         COALESCE(a.revenue, 0)
  ) ORDER BY d.day), '[]'::jsonb)
  INTO _trend
  FROM days d
  LEFT JOIN agg a ON a.day = d.day;

  ----------------------------------------------------------------
  -- 3) Courier performance (volume + success rate)
  ----------------------------------------------------------------
  WITH per_courier AS (
    SELECT
      o.courier_id,
      COUNT(*)                                       AS total,
      COUNT(*) FILTER (WHERE o.status = 'delivered') AS delivered,
      COUNT(*) FILTER (WHERE o.status = 'returned')  AS returned
    FROM public.orders o
    WHERE o.deleted_at IS NULL
      AND o.courier_id IS NOT NULL
    GROUP BY o.courier_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'courier_id',     pc.courier_id,
    'courier_name',   COALESCE(c.name, 'غير معروف'),
    'total',          pc.total,
    'delivered',      pc.delivered,
    'returned',       pc.returned,
    'success_rate',
      CASE WHEN pc.total > 0
           THEN ROUND((pc.delivered::numeric / pc.total) * 100, 1)
           ELSE 0
      END
  ) ORDER BY pc.delivered DESC, pc.total DESC), '[]'::jsonb)
  INTO _couriers
  FROM per_courier pc
  LEFT JOIN public.couriers c ON c.id = pc.courier_id;

  RETURN jsonb_build_object(
    'kpis',                _kpis,
    'trend_last_30_days',  _trend,
    'courier_performance', _couriers,
    'generated_at',        now()
  );
END;
$function$;

-- Lock down: only authenticated callers; the function self-checks admin role
REVOKE ALL ON FUNCTION public.get_admin_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;