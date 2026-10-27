import csv
import json
import sys
from pathlib import Path

COL_ID = "UNITID"
COL_NAME = "INSTNM"
COL_CITY = "CITY"
COL_STATE = "STABBR"
COL_HIGHEST_DEGREE = "HIGHDEG"
COL_CURRENTLY_OPERATING = "CURROPER"
COL_ADMIT_RATE = "ADM_RATE"
COL_SAT_25 = "SATVR25"
COL_SAT_75 = "SATVR75"
COL_SATMT_25 = "SATMT25"
COL_SATMT_75 = "SATMT75"
COL_ACT_25 = "ACTCM25"
COL_ACT_75 = "ACTCM75"
COL_SIZE = "UGDS"
COL_COST_IN = "NPT4_PUB"
COL_COST_OUT = "NPT4_PRIV"
COL_PREDOMINANT_DEGREE = "PREDDEG"

CIP_FAMILIES = [
    "01", "03", "04", "05", "09", "10", "11", "12", "13", "14", "15", "16",
    "19", "22", "23", "24", "25", "26", "27", "29", "30", "31", "38", "39",
    "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51",
    "52", "54",
]

SPOT_CHECK_NAMES = [
    "Harvard University",
    "Stanford University",
    "University of North Carolina at Chapel Hill",
    "University of Michigan-Ann Arbor",
    "The University of Texas at Austin",
]


def to_number(value):
    if value is None:
        return None
    value = value.strip()
    if value == "" or value.upper() == "NULL" or value == "PrivacySuppressed":
        return None
    try:
        num = float(value)
    except ValueError:
        return None
    return int(num) if num.is_integer() else num


def round_percent(fraction):
    percent = fraction * 100
    return round(percent, 1) if percent < 1 else round(percent)


def bachelor_fields(row):
    predominantly_bachelors = to_number(row.get(COL_PREDOMINANT_DEGREE)) == 3
    percents = {}
    offered = []
    for family in CIP_FAMILIES:
        if to_number(row.get(f"CIP{family}BACHL")) not in (1, 2):
            continue
        share = to_number(row.get(f"PCIP{family}"))
        if not share:
            continue
        if predominantly_bachelors:
            percents[family] = round_percent(share)
        else:
            offered.append(family)
    return (percents or None), (offered or None)


def build(csv_path):
    colleges = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get(COL_NAME, "").strip()
            state = row.get(COL_STATE, "").strip()
            if not name or not state:
                continue

            if to_number(row.get(COL_HIGHEST_DEGREE)) not in (3, 4):
                continue
            if to_number(row.get(COL_CURRENTLY_OPERATING)) != 1:
                continue

            sat_lo_parts = [to_number(row.get(COL_SAT_25)), to_number(row.get(COL_SATMT_25))]
            sat_hi_parts = [to_number(row.get(COL_SAT_75)), to_number(row.get(COL_SATMT_75))]
            sat_lo = sum(p for p in sat_lo_parts if p is not None) or None
            sat_hi = sum(p for p in sat_hi_parts if p is not None) or None
            major_percents, majors_offered = bachelor_fields(row)

            college = {
                "id": to_number(row.get(COL_ID)),
                "name": name,
                "city": row.get(COL_CITY, "").strip(),
                "state": state,
                "admitRate": to_number(row.get(COL_ADMIT_RATE)),
                "satLo": sat_lo,
                "satHi": sat_hi,
                "actLo": to_number(row.get(COL_ACT_25)),
                "actHi": to_number(row.get(COL_ACT_75)),
                "size": to_number(row.get(COL_SIZE)),
                "costIn": to_number(row.get(COL_COST_IN)),
                "costOut": to_number(row.get(COL_COST_OUT)),
                "m": major_percents,
                "mo": majors_offered,
            }

            college = {k: v for k, v in college.items() if v is not None}
            if "id" not in college or "name" not in college:
                continue

            colleges.append(college)

    return colleges


def print_spot_check(colleges):
    by_name = {c["name"]: c for c in colleges}
    print("\nSpot-check these against collegescorecard.ed.gov:")
    for name in SPOT_CHECK_NAMES:
        college = by_name.get(name)
        if not college:
            print(f"  {name}: NOT FOUND in the filtered data")
            continue
        admit = college.get("admitRate")
        admit_str = f"{admit * 100:.0f}%" if admit is not None else "n/a"
        sat = f"{college.get('satLo', 'n/a')}-{college.get('satHi', 'n/a')}"
        act = f"{college.get('actLo', 'n/a')}-{college.get('actHi', 'n/a')}"
        top_fields = sorted(college.get("m", {}).items(), key=lambda kv: -kv[1])[:3]
        fields = ", ".join(f"CIP {code}: {pct}%" for code, pct in top_fields) or "n/a"
        print(f"  {name} ({college['city']}, {college['state']}): "
              f"admit rate {admit_str}, SAT {sat}, ACT {act}, top fields {fields}")


def main():
    project_root = Path(__file__).resolve().parent.parent
    default_csv = Path(__file__).resolve().parent / "Most-Recent-Cohorts-Institution.csv"

    if len(sys.argv) == 2:
        csv_path = Path(sys.argv[1])
    elif len(sys.argv) == 1 and default_csv.exists():
        csv_path = default_csv
    else:
        print("Usage: python scripts/build_data.py [path/to/scorecard.csv]")
        print(f"(with no path, looks for {default_csv})")
        sys.exit(1)

    colleges = build(csv_path)
    output = {
        "sample": False,
        "source": "U.S. Dept. of Education College Scorecard (https://collegescorecard.ed.gov/data/)",
        "colleges": colleges,
    }

    out_path = project_root / "data" / "colleges.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"))

    print(f"Wrote {len(colleges)} colleges (bachelor's-degree-granting, currently operating) to {out_path}")
    print_spot_check(colleges)


if __name__ == "__main__":
    main()
