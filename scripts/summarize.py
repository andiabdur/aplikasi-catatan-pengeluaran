#!/usr/bin/env python3
"""Quick summary of parsed data — per month, per category."""
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from parse_historical import parse_date, parse_amount  # noqa: E402

src = Path(__file__).parent / 'historical-data.tsv'
rows = []
current_date = None
with src.open() as f:
    for line in f:
        line = line.rstrip('\n')
        if not line.strip():
            continue
        parts = line.split('\t') + ['', '', '', '']
        date_str, desc, cat, amt_str = parts[0], parts[1], parts[2], parts[3]
        if date_str.strip():
            p = parse_date(date_str)
            if p:
                current_date = p
            else:
                continue
        if not current_date:
            continue
        if not desc.strip() or desc.strip() == '-':
            continue
        if not cat.strip() or cat.strip() == '-':
            continue
        amt = parse_amount(amt_str)
        if amt is None:
            continue
        rows.append((current_date, desc.strip(), cat.strip(), amt))

print(f"Total: {len(rows)} rows, Rp {sum(r[3] for r in rows):,}\n")

print("=== Per month ===")
by_month = defaultdict(lambda: [0, 0])  # count, sum
for d, _, _, a in rows:
    ym = d[:7]
    by_month[ym][0] += 1
    by_month[ym][1] += a
for ym in sorted(by_month):
    c, t = by_month[ym]
    print(f"  {ym}: {c:4d} rows   Rp {t:>15,}")

print("\n=== Per category ===")
by_cat = defaultdict(lambda: [0, 0])
for _, _, c, a in rows:
    by_cat[c][0] += 1
    by_cat[c][1] += a
for c in sorted(by_cat, key=lambda x: -by_cat[x][1]):
    n, t = by_cat[c]
    print(f"  {c:30s} {n:4d} rows   Rp {t:>15,}")
