import csv, os, sys
SRC = sys.argv[1]; S = sys.argv[2]
files = [
    ("stations.csv", ",", "stg.stations", SRC),
    ("prices.csv", ";", "stg.prices", SRC),
    ("competitor_price_clean.csv", ",", "stg.cp", S),
    ("fuel_daily.csv", ",", "stg.fuel", S),
    ("traffic_daily.csv", ",", "stg.traffic", S),
    ("weather_daily.csv", ",", "stg.weather", S),
    ("shop_sales_daily.csv", ",", "stg.shop", S),
    ("promotion_clean.csv", ",", "stg.promo", S),
]
out = ["\\set ON_ERROR_STOP on", "SET search_path TO azs;", "CREATE SCHEMA IF NOT EXISTS stg;"]
for fname, delim, table, folder in files:
    path = os.path.join(folder, fname)
    with open(path, encoding="utf-8-sig", newline="") as f:
        header = next(csv.reader(f, delimiter=delim))
    cols = ", ".join(f'"{h.strip()}" text' for h in header)
    out.append(f"DROP TABLE IF EXISTS {table}; CREATE TABLE {table} ({cols});")
    out.append(f"\\copy {table} FROM '{path}' WITH (FORMAT csv, HEADER true, DELIMITER '{delim}')")
out.append(open(os.path.join(S, "transform.sql"), encoding="utf-8").read())
open(os.path.join(S, "load.sql"), "w", encoding="utf-8").write("\n".join(out))
print("written load.sql")
