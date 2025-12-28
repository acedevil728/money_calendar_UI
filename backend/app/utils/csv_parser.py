import csv
from io import StringIO
from datetime import datetime, date
from typing import List, Dict, Optional

DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y")

def _parse_date(date_str: str, row_no: int) -> date:
    s = date_str.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            continue
    raise ValueError(f"Row {row_no}: invalid date '{date_str}'")

def _parse_amount(amount_str: str, row_no: int) -> float:
    s = (amount_str or "").strip().replace(",", "")
    try:
        return float(s)
    except Exception:
        raise ValueError(f"Row {row_no}: invalid amount '{amount_str}'")

def _extract_categories(row: Dict[str, str]) -> (Optional[str], Optional[str], Optional[str]):
    major = (row.get("major_category") or "").strip() or None
    sub = (row.get("sub_category") or "").strip() or None
    cat = (row.get("category") or "").strip() or None
    if not major and cat:
        if "/" in cat:
            parts = [p.strip() for p in cat.split("/", 1)]
            major = parts[0] or None
            sub = parts[1] or None
        else:
            major = cat or None
    return cat, major, sub

def parse_csv_transactions(text: str) -> List[Dict]:
    """
    Expect CSV with at least columns: date, amount
    Optional columns: category, major_category, sub_category, direction, description, account, type, remarks
    """
    f = StringIO(text)
    reader = csv.DictReader(f)
    required = ["date", "amount"]
    out: List[Dict] = []
    for i, row in enumerate(reader, start=1):
        # validate required presence
        if not all(col in row and (row[col] is not None and row[col].strip() != "") for col in required):
            raise ValueError(f"Row {i}: missing required columns {required}")
        parsed_date = _parse_date(row["date"], i)
        amount = _parse_amount(row["amount"], i)
        cat, major, sub = _extract_categories(row)

        direction = (row.get("direction") or row.get("type") or "").strip() or None
        description = (row.get("description") or "").strip() or None
        account = (row.get("account") or "").strip() or None
        remarks = (row.get("remarks") or row.get("note") or "").strip() or None

        tx_type = (row.get("type") or direction or "").strip() or None

        out.append({
            "date": parsed_date,
            "amount": amount,
            "category": cat or None,
            "major_category": major,
            "sub_category": sub,
            "type": tx_type,
            "description": description,
            "account": account,
            "remarks": remarks,
            "raw_source": None
        })
    return out
