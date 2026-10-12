-- План контролируемого теста цен (A/B, PRICE-004). Черновик: цены на станциях этим не меняются.
CREATE TABLE IF NOT EXISTS price_test_plan (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_code  char(3) NOT NULL,
  fuel_code     varchar(20) NOT NULL,
  block_no      smallint NOT NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  base_price    numeric(10,2) NOT NULL,
  offset_rub    numeric(6,2) NOT NULL,
  target_price  numeric(10,2) NOT NULL,
  status        varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'applied')),
  created_at    timestamp NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (station_code, fuel_code, block_no)
);
