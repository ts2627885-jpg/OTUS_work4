import re, sys
import pandas as pd

OUT = sys.argv[1]
num = lambda s: pd.to_numeric(s.astype(str).str.replace(",", ".", regex=False), errors="coerce")

def code(s):  # last 3 digits identify the station
    return re.search(r"(\d{3})\D*$", str(s)).group(1)

# 1. prices.csv -> fuel_daily (wide -> long), station by name
p = pd.read_csv("prices.csv", sep=";", dtype=str, encoding="utf-8-sig")
p["station_code"] = p["Название АЗС"].map(code)
p["sale_date"] = pd.to_datetime(p["Временная метка"]).dt.date
fuels = [c[len("sales_"):] for c in p.columns if c.startswith("sales_")]
rows = []
for f in fuels:
    if f"price_{f}" not in p.columns: continue
    part = p[["station_code", "sale_date"]].copy()
    part["fuel_code"] = f
    part["sales_volume"] = num(p[f"sales_{f}"])
    part["price"] = num(p[f"price_{f}"])
    rows.append(part)
fuel_daily = pd.concat(rows)
fuel_daily["is_offered"] = fuel_daily["price"].fillna(0) > 0
fuel_daily.loc[~fuel_daily["is_offered"], "price"] = None
fuel_daily.to_csv(f"{OUT}/fuel_daily.csv", index=False)
print("fuel_daily rows:", len(fuel_daily), "| fuels:", sorted(fuel_daily.fuel_code.unique()))
print("  not offered:", int((~fuel_daily.is_offered).sum()), "| null sales:", int(fuel_daily.sales_volume.isna().sum()))

# 2. traffic_data.csv
t = pd.read_csv("traffic_data.csv", sep=",", dtype=str, encoding="utf-8-sig")
t.columns = [c.replace("﻿", "") for c in t.columns]
t["station_code"] = t["Название АЗС"].map(code)
for c in t.columns:
    if c.startswith("traffic_") and c != "traffic_uroven_jbslugi":
        t[c] = num(t[c])
t.rename(columns={"Дата": "traffic_date"}).to_csv(f"{OUT}/traffic_daily.csv", index=False)
print("traffic rows:", len(t), "| nulls in numeric:", int(t.filter(like="traffic_").drop(columns=["traffic_uroven_jbslugi"], errors="ignore").isna().sum().sum()))

# 3. weather_data.csv
w = pd.read_csv("weather_data.csv", sep=",", dtype=str, encoding="utf-8-sig")
w["station_code"] = w["station_name"].map(code)
w.to_csv(f"{OUT}/weather_daily.csv", index=False)
print("weather rows:", len(w))

# 4. shop_sales.csv: wide dates -> long, decimal comma
s = pd.read_csv("shop_sales.csv", sep=";", dtype=str, encoding="utf-8-sig")
s.columns = [c.replace("﻿", "") for c in s.columns]
s["station_code"] = s["АЗС"].map(code)
dates = [c for c in s.columns if re.match(r"\d{2}\.\d{2}\.\d{4}$", c)]
long = s.melt(id_vars=["Переменная", "station_code"], value_vars=dates,
              var_name="sale_date", value_name="revenue_rub")
long["sale_date"] = pd.to_datetime(long["sale_date"], format="%d.%m.%Y").dt.date
long["revenue_rub"] = num(long["revenue_rub"])
long.to_csv(f"{OUT}/shop_sales_daily.csv", index=False)
print("shop rows:", len(long), "| null revenue:", int(long.revenue_rub.isna().sum()), "| zero:", int((long.revenue_rub==0).sum()))

# 5. station codes consistency across all sources
ids = pd.read_csv("stations.csv", dtype=str, encoding="utf-8-sig")
comp = pd.read_csv("competitor_prices.csv", sep=";", dtype=str, encoding="utf-8-sig")
print("\nstation codes:")
print("  stations.csv:", sorted(ids["station_id"].map(code).unique()))
print("  competitor_prices:", sorted(comp.iloc[:,3].map(code).unique()))
print("  prices/traffic/weather/shop:", sorted(set(fuel_daily.station_code)|set(t.station_code)|set(w.station_code)|set(long.station_code)))
