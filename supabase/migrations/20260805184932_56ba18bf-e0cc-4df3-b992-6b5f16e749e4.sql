-- =========================================================
-- 1. DEMO ANALYTICS DATABASE (agent's read-only playground)
-- =========================================================
CREATE SCHEMA IF NOT EXISTS demo;

CREATE TABLE demo.customers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  segment text NOT NULL,
  signup_date date NOT NULL
);

CREATE TABLE demo.products (
  id serial PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  price numeric(10,2) NOT NULL,
  cost numeric(10,2) NOT NULL
);

CREATE TABLE demo.orders (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES demo.customers(id),
  order_date date NOT NULL,
  status text NOT NULL,
  channel text NOT NULL
);

CREATE TABLE demo.order_items (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES demo.orders(id),
  product_id integer NOT NULL REFERENCES demo.products(id),
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  revenue numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX ON demo.orders (order_date);
CREATE INDEX ON demo.orders (customer_id);
CREATE INDEX ON demo.order_items (order_id);
CREATE INDEX ON demo.order_items (product_id);

-- Products
INSERT INTO demo.products (name, category, price, cost) VALUES
  ('Aurora Wireless Headphones','Audio',249.00,96.00),
  ('Nimbus Bluetooth Speaker','Audio',129.00,48.00),
  ('Vertex 14" Laptop','Computers',1399.00,940.00),
  ('Vertex 16" Laptop Pro','Computers',2199.00,1520.00),
  ('Kestrel Mechanical Keyboard','Accessories',159.00,58.00),
  ('Kestrel Wireless Mouse','Accessories',69.00,21.00),
  ('Lumen 27" 4K Monitor','Displays',549.00,330.00),
  ('Lumen 32" Ultrawide','Displays',899.00,570.00),
  ('Pulse Fitness Watch','Wearables',329.00,142.00),
  ('Pulse Earbuds Mini','Audio',149.00,52.00),
  ('Atlas Docking Station','Accessories',199.00,74.00),
  ('Atlas USB-C Hub','Accessories',79.00,24.00),
  ('Halo Smart Lamp','Home',119.00,41.00),
  ('Halo Air Purifier','Home',389.00,180.00),
  ('Orbit Drone Mini','Cameras',699.00,410.00),
  ('Orbit Action Camera','Cameras',449.00,238.00),
  ('Cobalt Tablet 11','Computers',799.00,510.00),
  ('Cobalt Stylus Pen','Accessories',99.00,29.00),
  ('Ember Espresso Machine','Home',649.00,352.00),
  ('Ember Travel Mug','Home',59.00,17.00);

-- Customers (240, deterministic spread)
INSERT INTO demo.customers (name, email, country, segment, signup_date)
SELECT
  (ARRAY['Ava','Liam','Noah','Emma','Olivia','Ethan','Mia','Lucas','Sofia','Leo',
         'Aria','Kai','Zoe','Ivan','Nora','Hugo','Maya','Felix','Iris','Omar'])[1 + (g % 20)]
    || ' ' ||
  (ARRAY['Bennett','Okafor','Nakamura','Silva','Kowalski','Haddad','Meyer','Rossi','Dubois','Andersen',
         'Patel','Kim','Novak','Costa','Fischer','Moreau','Lindgren','Ferreira','Yilmaz','Walsh'])[1 + ((g * 7) % 20)],
  'customer' || g || '@example.com',
  (ARRAY['United States','Germany','India','Brazil','Japan','United Kingdom','Canada','France','Australia','Sweden'])[1 + ((g * 3) % 10)],
  (ARRAY['Consumer','SMB','Enterprise','Education'])[1 + ((g * 5) % 4)],
  DATE '2024-01-01' + ((g * 3) % 730)
FROM generate_series(1, 240) AS g;

-- Orders (~3200 across 2025-2026, with seasonality)
INSERT INTO demo.orders (customer_id, order_date, status, channel)
SELECT
  1 + ((g * 37) % 240),
  DATE '2025-01-01' + ((g * 173) % 700),
  (ARRAY['completed','completed','completed','completed','completed','shipped','pending','cancelled'])[1 + ((g * 11) % 8)],
  (ARRAY['web','web','web','mobile','mobile','retail','partner'])[1 + ((g * 13) % 7)]
FROM generate_series(1, 3200) AS g;

-- Order items (1-3 per order), price drawn from the product catalog
INSERT INTO demo.order_items (order_id, product_id, quantity, unit_price)
SELECT
  o.id,
  p.id,
  1 + ((o.id * n * 7) % 3),
  p.price
FROM demo.orders o
CROSS JOIN LATERAL generate_series(1, 1 + ((o.id * 5) % 3)) AS n
JOIN demo.products p ON p.id = 1 + ((o.id * 17 + n * 29) % 20);

GRANT USAGE ON SCHEMA demo TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA demo TO service_role;

-- =========================================================
-- 2. AGENT TOOLING FUNCTIONS (service_role only)
-- =========================================================

-- get_schema(): tables, columns, types, relationships
CREATE OR REPLACE FUNCTION public.demo_get_schema()
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public, demo, information_schema
AS $$
  SELECT json_build_object(
    'schema', 'demo',
    'tables', (
      SELECT coalesce(json_agg(t ORDER BY t->>'table'), '[]'::json)
      FROM (
        SELECT json_build_object(
          'table', c.table_name,
          'columns', (
            SELECT json_agg(json_build_object(
              'name', col.column_name,
              'type', col.data_type,
              'nullable', col.is_nullable = 'YES'
            ) ORDER BY col.ordinal_position)
            FROM information_schema.columns col
            WHERE col.table_schema = 'demo' AND col.table_name = c.table_name
          )
        ) AS t
        FROM information_schema.tables c
        WHERE c.table_schema = 'demo' AND c.table_type = 'BASE TABLE'
      ) s
    ),
    'relationships', (
      SELECT coalesce(json_agg(json_build_object(
        'from_table', src.relname,
        'from_column', att.attname,
        'to_table', tgt.relname,
        'to_column', fatt.attname
      )), '[]'::json)
      FROM pg_constraint con
      JOIN pg_class src ON src.oid = con.conrelid
      JOIN pg_class tgt ON tgt.oid = con.confrelid
      JOIN pg_namespace ns ON ns.oid = src.relnamespace
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      JOIN pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND ns.nspname = 'demo'
    )
  );
$$;

-- execute_query(): single read-only SELECT against the demo schema
CREATE OR REPLACE FUNCTION public.demo_run_select(query_text text)
RETURNS json
LANGUAGE plpgsql
VOLATILE
SET search_path = demo, public
AS $$
DECLARE
  cleaned text := btrim(query_text);
  result json;
BEGIN
  cleaned := btrim(cleaned, ';');

  IF cleaned !~* '^\s*(select|with)\s' THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are allowed.';
  END IF;

  IF cleaned ~ ';' THEN
    RAISE EXCEPTION 'Only a single statement is allowed.';
  END IF;

  IF cleaned ~* '\y(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|call|do|merge|set|reset|listen|notify|pg_sleep|pg_read_file|lo_import|lo_export|dblink)\y' THEN
    RAISE EXCEPTION 'Query contains a disallowed keyword.';
  END IF;

  IF cleaned ~* '\y(auth|storage|vault|pg_catalog|information_schema|pg_authid|pg_shadow|threads|messages|profiles)\y' THEN
    RAISE EXCEPTION 'Query references a restricted object.';
  END IF;

  SET LOCAL statement_timeout = '10s';

  EXECUTE format(
    'SELECT coalesce(json_agg(row_to_json(sub)), ''[]''::json) FROM (SELECT * FROM (%s) inner_q LIMIT 5000) sub',
    cleaned
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.demo_get_schema() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demo_run_select(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_get_schema() TO service_role;
GRANT EXECUTE ON FUNCTION public.demo_run_select(text) TO service_role;

-- =========================================================
-- 3. CHAT PERSISTENCE
-- =========================================================
CREATE TABLE public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_message_id text,
  role text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.threads (user_id, updated_at DESC);
CREATE INDEX ON public.messages (thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own threads" ON public.threads
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage their own messages" ON public.messages
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());