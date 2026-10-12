import sys
import pandas as pd

OUT = sys.argv[1]
p = pd.read_csv("promotions.csv", dtype=str, encoding="utf-8-sig")
p.columns = [c.replace("﻿", "") for c in p.columns]
# Все строки CSV берутся как есть: пустые ВИНК и даты остаются пустыми (NULL в БД)
out = pd.DataFrame({
    "source_no": p["№п/п"].astype(float).astype(int),
    "company": p["ВИНК"].str.strip(),
    "name": p["Акция"].str.strip(),
    "start_date": pd.to_datetime(p["Дата начала"]).dt.strftime("%Y-%m-%d"),
    "end_date": pd.to_datetime(p["Дата конца"]).dt.strftime("%Y-%m-%d"),
    "duration_days": pd.to_numeric(p["Продолжительность (дней)"]).astype("Int64"),
    "category": p["Категория"],
    "coverage": p["Охват (нормализованный)"],
    "description": p["Описание"].str.strip(),
    # Колонка «Срок действия» есть не во всех выгрузках: если её нет, поле остаётся пустым
    "validity": p["Срок действия"].str.strip() if "Срок действия" in p.columns else None,
})
out.to_csv(OUT, index=False)
print("promotions loaded:", len(out), "| without dates:", int(out["start_date"].isna().sum()))
