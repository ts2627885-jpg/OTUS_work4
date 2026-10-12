import sys
import pandas as pd

SRC = sys.argv[1]
OUT = sys.argv[2]

MONTHS = {"янв": "01", "апр": "04", "сен": "09", "ноя": "11"}

def parse_price(raw):
    if pd.isna(raw):
        return None
    s = str(raw).strip().replace(",", ".")
    if "." in s and s.split(".")[1].isalpha():
        day, mon = s.split(".")
        return float(f"{day}.{MONTHS[mon]}")
    return float(s)

df = pd.read_csv(SRC, sep=";", encoding="utf-8-sig", dtype=str)
df.columns = ["group", "var", "desc", "station_id", "station_name", "ts", "value", "brand", "number"]
df["source_row_no"] = range(1, len(df) + 1)
df["slot"] = df["desc"].str.extract(r"конкурента (\d+)")[0].astype(int)
df["is_brand_price"] = df["var"].str.contains("brend|Brend")
df["fuel_code"] = (df["var"].str.replace(r"^competitor_price_", "", regex=True)
                           .str.replace(r"_?[Bb]rend$", "", regex=True))
df["observed_at"] = pd.to_datetime(df["ts"], format="%d.%m.%Y_%H:%M:%S")
df["price"] = df["value"].map(parse_price)
df["is_offered"] = df["price"].fillna(0) > 0
df.loc[~df["is_offered"], "price"] = None

out = df[["source_row_no", "station_id", "brand", "number", "slot", "fuel_code",
          "is_brand_price", "observed_at", "price", "is_offered"]]
out.to_csv(OUT, index=False)

print("rows:", len(out))
print("offered:", int(out["is_offered"].sum()), " not offered:", int((~out["is_offered"]).sum()))
print("fuel codes:", sorted(out["fuel_code"].unique()))
print("parsed 27.апр-style values:", int(df["value"].str.contains(r"\.[а-я]", regex=True).sum()))
